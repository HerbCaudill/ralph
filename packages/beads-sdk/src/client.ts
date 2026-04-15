import { CliTransport, type CliTransportOptions } from "./transport/cli.js"
import { JsonlTransport } from "./transport/jsonl.js"
import { ChangePoller } from "./poller.js"
import type { WatchMutationsOptions } from "./mutation-poller.js"
import { batched, MAX_CONCURRENT_REQUESTS } from "./batch.js"
import type {
  Transport,
  Issue,
  BlockedIssue,
  Stats,
  HealthStatus,
  ListFilter,
  ReadyFilter,
  BlockedFilter,
  CreateInput,
  UpdateInput,
  DepType,
  Comment,
  LabelResult,
  DepResult,
  Info,
  MutationEvent,
} from "./types.js"

/**
 * High-level client for the beads issue tracker.
 * Connects through the beads v1 CLI, with JSONL fallback for reads.
 */
export class BeadsClient {
  private cli: CliTransport | null = null
  private jsonl: JsonlTransport | null = null
  private transport: Transport | null = null
  private poller: ChangePoller | null = null
  private changeCallbacks: Array<() => void> = []
  private jsonlUnsubscribe: (() => void) | null = null
  private connected = false
  private workspaceRoot: string | null = null
  private options: BeadsClientOptions

  constructor(
    /** Client options */
    options: BeadsClientOptions = {},
  ) {
    this.options = options
  }

  /**
   * Connect to beads at the given workspace root.
   * Tries the v1 CLI first; falls back to JSONL for read-only access.
   * Idempotent: cleans up previous connections before reconnecting.
   */
  async connect(
    /** Path to the workspace root (directory containing or above `.beads/`) */
    workspaceRoot: string,
  ): Promise<void> {
    // Clean up any previous connection to prevent leaked pollers/watchers
    this.cleanupResources()

    this.workspaceRoot = workspaceRoot

    // Try the supported beads v1 CLI first.
    const cli = new CliTransport(workspaceRoot, {
      requestTimeout: this.options.requestTimeout,
      actor: this.options.actor,
      bdPath: this.options.bdPath,
    })

    try {
      await cli.send("info", {})
      this.cli = cli
      this.transport = cli
      this.connected = true

      // Start change polling unless explicitly disabled with pollInterval: 0.
      if (this.options.pollInterval !== 0) {
        this.poller = new ChangePoller(cli)
        this.poller.onChange(() => this.notifyChange())
        this.poller.start(this.options.pollInterval ?? 2000)
      }
      return
    } catch {
      cli.close()
      // CLI not available or no v1 database found; try JSONL fallback.
    }

    // Fall back to JSONL
    const jsonl = new JsonlTransport(workspaceRoot)
    const loaded = jsonl.load()
    if (!loaded) {
      throw new Error(
        "Could not connect to beads through the CLI or find JSONL file. " +
          "Make sure `bd` can read this workspace or .beads/issues.jsonl exists.",
      )
    }

    this.jsonl = jsonl
    this.transport = jsonl
    this.connected = true

    // Watch JSONL for changes
    jsonl.startWatching()
    this.jsonlUnsubscribe = jsonl.onChange(() => this.notifyChange())
  }

  /** Disconnect and clean up all resources. */
  async disconnect(): Promise<void> {
    this.cleanupResources()
    this.connected = false
    this.changeCallbacks = []
  }

  /** Check if the client is connected. */
  isConnected(): boolean {
    return this.connected
  }

  /**
   * Subscribe to data changes (driven by polling + JSONL file watching).
   * Returns an unsubscribe function.
   */
  onChange(
    /** Callback invoked when data changes */
    callback: () => void,
  ): () => void {
    this.changeCallbacks.push(callback)
    return () => {
      const idx = this.changeCallbacks.indexOf(callback)
      if (idx >= 0) this.changeCallbacks.splice(idx, 1)
    }
  }

  // Read operations

  /** List issues with optional filters. */
  async list(
    /** Filter options */
    filter: ListFilter = {},
  ): Promise<Issue[]> {
    return (await this.send("list", { ...filter })) as Issue[]
  }

  /** Show a single issue by ID (with full dependencies/dependents). */
  async show(
    /** Issue ID */
    id: string,
  ): Promise<Issue> {
    return (await this.send("show", { id })) as Issue
  }

  /** Show details for multiple issues, with bounded concurrency. */
  async showMany(
    /** Issue IDs */
    ids: string[],
  ): Promise<Issue[]> {
    return batched(ids, MAX_CONCURRENT_REQUESTS, id => this.show(id))
  }

  /** Show ready work (open issues with no blockers). */
  async ready(
    /** Filter options */
    filter: ReadyFilter = {},
  ): Promise<Issue[]> {
    return (await this.send("ready", { ...filter })) as Issue[]
  }

  /** Show blocked issues. */
  async blocked(
    /** Filter options */
    filter: BlockedFilter = {},
  ): Promise<BlockedIssue[]> {
    return (await this.send("blocked", { ...filter })) as BlockedIssue[]
  }

  /** Get database statistics. */
  async stats(): Promise<Stats> {
    return (await this.send("stats", {})) as Stats
  }

  /** Ping the active beads transport. */
  async ping(): Promise<{ message: string; version: string }> {
    return (await this.send("ping", {})) as { message: string; version: string }
  }

  /** Get active transport health status. */
  async health(): Promise<HealthStatus> {
    return (await this.send("health", {})) as HealthStatus
  }

  /** Get database info. */
  async info(): Promise<Info> {
    return (await this.send("info", {})) as Info
  }

  /** Get mutations since a given timestamp. Unsupported by the v1 CLI transport. */
  async getMutations(
    /** Unix timestamp in ms to get mutations since */
    since: number = 0,
  ): Promise<MutationEvent[]> {
    const result = (await this.send("get_mutations", { since })) as MutationEvent[]
    return result ?? []
  }

  // Write operations

  /** Create a new issue. Requires writable CLI access, not JSONL fallback. */
  async create(
    /** Issue creation input */
    input: CreateInput,
  ): Promise<Issue> {
    this.requireWritableTransport("create")
    return (await this.send("create", input as unknown as Record<string, unknown>)) as Issue
  }

  /** Update an existing issue. Requires writable CLI access. */
  async update(
    /** Issue ID */
    id: string,
    /** Fields to update */
    changes: UpdateInput,
  ): Promise<Issue> {
    this.requireWritableTransport("update")
    return (await this.send("update", {
      id,
      ...changes,
    })) as Issue
  }

  /** Update multiple issues with the same changes, with bounded concurrency. */
  async updateMany(
    /** Issue IDs to update */
    ids: string[],
    /** Fields to update */
    changes: UpdateInput,
  ): Promise<Issue[]> {
    this.requireWritableTransport("update (batched)")
    return batched(ids, MAX_CONCURRENT_REQUESTS, id => this.update(id, changes))
  }

  /** Close an issue. Requires writable CLI access. */
  async close(
    /** Issue ID */
    id: string,
    /** Optional close reason */
    reason?: string,
  ): Promise<Issue> {
    this.requireWritableTransport("close")
    const args: Record<string, unknown> = { id }
    if (reason) args.reason = reason
    return (await this.send("close", args)) as Issue
  }

  /** Delete an issue. Requires writable CLI access. */
  async delete(
    /** Issue ID */
    id: string,
  ): Promise<void> {
    this.requireWritableTransport("delete")
    await this.send("delete", { id, force: true })
  }

  /** Delete multiple issues, with bounded concurrency. */
  async deleteMany(
    /** Issue IDs to delete */
    ids: string[],
  ): Promise<void> {
    this.requireWritableTransport("delete (batched)")
    await batched(ids, MAX_CONCURRENT_REQUESTS, id => this.delete(id))
  }

  // Comments

  /** Add a comment to an issue. Requires writable CLI access. */
  async addComment(
    /** Issue ID */
    id: string,
    /** Comment text */
    text: string,
    /** Optional comment author */
    author?: string,
  ): Promise<void> {
    this.requireWritableTransport("comment_add")
    const args: Record<string, unknown> = { id, text }
    if (author) args.author = author
    await this.send("comment_add", args)
  }

  /** Get comments for an issue. Requires CLI access. */
  async getComments(
    /** Issue ID */
    id: string,
  ): Promise<Comment[]> {
    return (await this.send("comment_list", { id })) as Comment[]
  }

  // Labels

  /** Get labels for an issue. Requires CLI access. */
  async getLabels(
    /** Issue ID */
    id: string,
  ): Promise<string[]> {
    return (await this.send("label_list", { id })) as string[]
  }

  /** Add a label to an issue. Requires writable CLI access. */
  async addLabel(
    /** Issue ID */
    id: string,
    /** Label to add */
    label: string,
  ): Promise<LabelResult> {
    this.requireWritableTransport("label_add")
    return (await this.send("label_add", { id, label })) as LabelResult
  }

  /** Remove a label from an issue. Requires writable CLI access. */
  async removeLabel(
    /** Issue ID */
    id: string,
    /** Label to remove */
    label: string,
  ): Promise<LabelResult> {
    this.requireWritableTransport("label_remove")
    return (await this.send("label_remove", { id, label })) as LabelResult
  }

  /** List all unique labels in the database. Requires CLI access. */
  async listAllLabels(): Promise<string[]> {
    return (await this.send("label_list_all", {})) as string[]
  }

  // Dependencies

  /** Add a dependency between two issues. Requires writable CLI access. */
  async addDependency(
    /** Source issue ID */
    fromId: string,
    /** Target issue ID */
    toId: string,
    /** Dependency type */
    type: DepType,
  ): Promise<void> {
    this.requireWritableTransport("dep_add")
    await this.send("dep_add", {
      from_id: fromId,
      to_id: toId,
      dep_type: type,
    })
  }

  /** Add a blocking dependency between two issues. Requires writable CLI access. */
  async addBlocker(
    /** ID of the issue being blocked */
    blockedId: string,
    /** ID of the blocking issue */
    blockerId: string,
  ): Promise<DepResult> {
    this.requireWritableTransport("dep_add")
    return (await this.send("dep_add", {
      from_id: blockedId,
      to_id: blockerId,
    })) as DepResult
  }

  /** Remove a blocking dependency between two issues. Requires writable CLI access. */
  async removeBlocker(
    /** ID of the issue being blocked */
    blockedId: string,
    /** ID of the blocking issue */
    blockerId: string,
  ): Promise<DepResult> {
    this.requireWritableTransport("dep_remove")
    return (await this.send("dep_remove", {
      from_id: blockedId,
      to_id: blockerId,
    })) as DepResult
  }

  // Internals

  /** Release internal transport resources (poller, watcher, subscriptions). */
  private cleanupResources(): void {
    this.poller?.stop()
    this.poller = null
    this.jsonlUnsubscribe?.()
    this.jsonlUnsubscribe = null
    this.cli?.close()
    this.cli = null
    this.jsonl?.close()
    this.jsonl = null
    this.transport = null
  }

  /** Send an operation through the active transport. */
  private async send(
    /** Operation name */
    operation: string,
    /** Operation arguments */
    args: Record<string, unknown>,
  ): Promise<unknown> {
    if (!this.transport) {
      throw new Error("Not connected. Call connect() first.")
    }
    return this.transport.send(operation, args)
  }

  /** Throw if connected through the read-only JSONL fallback. */
  private requireWritableTransport(
    /** Operation name for error message */
    operation: string,
  ): void {
    if (this.transport === this.jsonl) {
      throw new Error(
        `Operation "${operation}" requires a writable beads connection. ` +
          `JSONL fallback is read-only.`,
      )
    }
  }

  /** Notify all change subscribers. */
  private notifyChange(): void {
    for (const cb of this.changeCallbacks) cb()
  }
}

/**
 * Watch for legacy daemon mutation events.
 * Beads v1 CLI transport does not expose detailed mutation events.
 * Returns a cleanup function to stop watching.
 */
export function watchMutations(
  /** Callback for each mutation event */
  _onMutation: (event: MutationEvent) => void,
  /** Watch options */
  _options: WatchMutationsOptions = {},
): () => void {
  throw new Error("watchMutations is not supported by beads v1 CLI transport")
}

/** Options for creating a BeadsClient. */
export interface BeadsClientOptions extends Pick<CliTransportOptions, "bdPath"> {
  /** Timeout per CLI request in ms (default: 10000) */
  requestTimeout?: number
  /** Actor name sent with requests (default: "sdk") */
  actor?: string
  /** Change polling interval in ms (default: 2000) */
  pollInterval?: number
}
