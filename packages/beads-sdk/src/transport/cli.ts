import { execFile } from "node:child_process"
import type {
  BlockedFilter,
  Comment,
  CreateInput,
  DepResult,
  DepType,
  HealthStatus,
  Info,
  Issue,
  LabelResult,
  ListFilter,
  ReadyFilter,
  Transport,
  UpdateInput,
} from "../types.js"

/** Transport that communicates with beads v1 through the supported `bd` CLI. */
export class CliTransport implements Transport {
  /** Workspace where `bd` commands should run. */
  private workspaceRoot: string
  /** Path or command name for the beads executable. */
  private bdPath: string
  /** Timeout per CLI request in milliseconds. */
  private requestTimeout: number
  /** Actor name sent to beads through `BEADS_ACTOR`. */
  private actor: string
  /** Promise chain used to avoid embedded-Dolt lock contention inside one client. */
  private queue: Promise<void> = Promise.resolve()

  constructor(
    /** Workspace root directory */
    workspaceRoot: string,
    /** Transport options */
    options: CliTransportOptions = {},
  ) {
    this.workspaceRoot = workspaceRoot
    this.bdPath = options.bdPath ?? "bd"
    this.requestTimeout = options.requestTimeout ?? 10000
    this.actor = options.actor ?? "sdk"
  }

  /** Send an operation to the v1 CLI and return the response data. */
  async send(
    /** Operation name */
    operation: string,
    /** Operation arguments */
    args: Record<string, unknown> = {},
  ): Promise<unknown> {
    const result = this.queue.then(
      () => this.sendQueued(operation, args),
      () => this.sendQueued(operation, args),
    )
    this.queue = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  /** No-op; CLI calls do not hold persistent resources. */
  close(): void {
    this.queue = Promise.resolve()
  }

  /** Run an operation once it reaches the front of the local queue. */
  private async sendQueued(
    /** Operation name */
    operation: string,
    /** Operation arguments */
    args: Record<string, unknown>,
  ): Promise<unknown> {
    switch (operation) {
      case "ping":
        return this.ping()
      case "health":
        return this.health()
      case "list":
        return this.normalizeIssues(await this.runJson(this.listArgs(args as ListFilter)))
      case "show":
        return this.normalizeIssue(await this.runJson(["show", String(args.id), "--json"]))
      case "ready":
        return this.normalizeIssues(await this.runJson(this.readyArgs(args as ReadyFilter)))
      case "blocked":
        return this.normalizeIssues(await this.runJson(this.blockedArgs(args as BlockedFilter)))
      case "stats":
        return this.runJson(["status", "--json", "--no-activity"])
      case "info":
        return this.info()
      case "create":
        return this.normalizeIssue(
          await this.runJson(this.createArgs(args as unknown as CreateInput)),
        )
      case "update":
        return this.normalizeIssue(
          await this.runJson(this.updateArgs(args as unknown as UpdateInput & { id: string })),
        )
      case "close":
        return this.normalizeIssue(await this.runJson(this.closeArgs(args)))
      case "delete":
        await this.runJson(["delete", String(args.id), "--force", "--json"])
        return undefined
      case "comment_add":
        await this.runJson(this.commentAddArgs(args))
        return undefined
      case "comment_list":
        return this.runJson(["comments", String(args.id), "--json"]) as Promise<Comment[]>
      case "label_list":
        return this.runJson(["label", "list", String(args.id), "--json"])
      case "label_add":
        await this.runJson(["label", "add", String(args.id), String(args.label), "--json"])
        return this.labelResult(args, "added")
      case "label_remove":
        await this.runJson(["label", "remove", String(args.id), String(args.label), "--json"])
        return this.labelResult(args, "removed")
      case "label_list_all":
        return this.normalizeLabels(await this.runJson(["label", "list-all", "--json"]))
      case "dep_add":
        await this.runJson(this.depAddArgs(args))
        return this.depResult(args, "added")
      case "dep_remove":
        await this.runJson(["dep", "remove", String(args.from_id), String(args.to_id), "--json"])
        return this.depResult(args, "removed")
      case "get_mutations":
        throw new Error('Operation "get_mutations" is not supported by the v1 CLI transport')
      default:
        throw new Error(`Operation "${operation}" is not supported by the v1 CLI transport`)
    }
  }

  /** Check that the CLI is available and return the version. */
  private async ping(): Promise<{ message: string; version: string }> {
    const version = (await this.runJson(["version", "--json"])) as { version?: string }
    return { message: "pong", version: version.version ?? "unknown" }
  }

  /** Return a synthetic health status for the process-per-call v1 CLI. */
  private async health(): Promise<HealthStatus> {
    const ping = await this.ping()
    return {
      status: "ok",
      version: ping.version,
      uptime: 0,
      db_response_time_ms: 0,
      active_connections: 0,
      memory_bytes: 0,
    }
  }

  /** Return database info, parsing text output because `bd info --json` is currently text. */
  private async info(): Promise<Info> {
    const output = await this.runText(["info"])
    const databasePath = output.match(/^Database:\s+(.+)$/m)?.[1] ?? ""
    const mode = output.match(/^Mode:\s+(.+)$/m)?.[1] ?? "unknown"
    const issueCount = Number(output.match(/^Issue Count:\s+(\d+)$/m)?.[1] ?? 0)
    return {
      database_path: databasePath,
      issue_count: issueCount,
      mode,
      daemon_connected: false,
    }
  }

  /** Build CLI arguments for `bd list`. */
  private listArgs(
    /** List filters */
    filter: ListFilter,
  ): string[] {
    const cliArgs = ["list", "--json", "--all"]
    this.pushCommonIssueFilters(cliArgs, filter)
    this.pushString(cliArgs, "--title", filter.query)
    this.pushBoolean(cliArgs, "--no-assignee", filter.unassigned)
    this.pushNumber(cliArgs, "--limit", filter.limit)
    return cliArgs
  }

  /** Build CLI arguments for `bd ready`. */
  private readyArgs(
    /** Ready filters */
    filter: ReadyFilter,
  ): string[] {
    const cliArgs = ["ready", "--json"]
    this.pushString(cliArgs, "--assignee", filter.assignee)
    this.pushNumber(cliArgs, "--priority", filter.priority)
    this.pushString(cliArgs, "--type", filter.issue_type)
    this.pushStringArray(cliArgs, "--label", filter.labels)
    this.pushStringArray(cliArgs, "--label-any", filter.labels_any)
    this.pushBoolean(cliArgs, "--unassigned", filter.unassigned)
    this.pushString(cliArgs, "--sort", filter.sort_policy)
    this.pushNumber(cliArgs, "--limit", filter.limit)
    this.pushString(cliArgs, "--parent", filter.parent_id)
    return cliArgs
  }

  /** Build CLI arguments for `bd blocked`. */
  private blockedArgs(
    /** Blocked filters */
    filter: BlockedFilter,
  ): string[] {
    const cliArgs = ["blocked", "--json"]
    this.pushString(cliArgs, "--parent", filter.parent_id)
    return cliArgs
  }

  /** Build CLI arguments for `bd create`. */
  private createArgs(
    /** Create input */
    input: CreateInput,
  ): string[] {
    const cliArgs = ["create", input.title, "--json"]
    this.pushString(cliArgs, "--description", input.description)
    this.pushString(cliArgs, "--design", input.design)
    this.pushString(cliArgs, "--acceptance", input.acceptance_criteria)
    this.pushNumber(cliArgs, "--priority", input.priority)
    this.pushString(cliArgs, "--type", input.issue_type)
    this.pushString(cliArgs, "--assignee", input.assignee)
    this.pushStringArray(cliArgs, "--labels", input.labels)
    this.pushStringArray(cliArgs, "--deps", input.dependencies)
    this.pushString(cliArgs, "--id", input.id)
    return cliArgs
  }

  /** Build CLI arguments for `bd update`. */
  private updateArgs(
    /** Update input with an issue ID */
    input: UpdateInput & { id: string },
  ): string[] {
    const cliArgs = ["update", input.id, "--json"]
    this.pushString(cliArgs, "--title", input.title)
    this.pushString(cliArgs, "--description", input.description)
    this.pushString(cliArgs, "--design", input.design)
    this.pushString(cliArgs, "--acceptance", input.acceptance_criteria)
    this.pushString(cliArgs, "--notes", input.notes)
    this.pushString(cliArgs, "--status", input.status)
    this.pushNumber(cliArgs, "--priority", input.priority)
    this.pushString(cliArgs, "--assignee", input.assignee)
    this.pushString(cliArgs, "--type", input.issue_type)
    this.pushString(cliArgs, "--parent", input.parent)
    this.pushRepeatedStrings(cliArgs, "--add-label", input.add_labels)
    this.pushRepeatedStrings(cliArgs, "--remove-label", input.remove_labels)
    return cliArgs
  }

  /** Build CLI arguments for `bd close`. */
  private closeArgs(
    /** Close operation arguments */
    args: Record<string, unknown>,
  ): string[] {
    const cliArgs = ["close", String(args.id), "--json"]
    this.pushString(cliArgs, "--reason", args.reason as string | undefined)
    return cliArgs
  }

  /** Build CLI arguments for `bd comments add`. */
  private commentAddArgs(
    /** Comment operation arguments */
    args: Record<string, unknown>,
  ): string[] {
    const cliArgs = ["comments", "add", String(args.id), String(args.text), "--json"]
    this.pushString(cliArgs, "--author", args.author as string | undefined)
    return cliArgs
  }

  /** Build CLI arguments for `bd dep add`. */
  private depAddArgs(
    /** Dependency operation arguments */
    args: Record<string, unknown>,
  ): string[] {
    const cliArgs = ["dep", "add", String(args.from_id), String(args.to_id), "--json"]
    this.pushString(cliArgs, "--type", (args.dep_type as string | undefined) ?? "blocks")
    return cliArgs
  }

  /** Push common list/search filters into a CLI argument array. */
  private pushCommonIssueFilters(
    /** CLI argument array to mutate */
    cliArgs: string[],
    /** Filter values */
    filter: ListFilter,
  ): void {
    this.pushString(cliArgs, "--status", filter.status)
    this.pushNumber(cliArgs, "--priority", filter.priority)
    this.pushString(cliArgs, "--type", filter.issue_type)
    this.pushString(cliArgs, "--assignee", filter.assignee)
    this.pushStringArray(cliArgs, "--label", filter.labels)
    this.pushStringArray(cliArgs, "--label-any", filter.labels_any)
  }

  /** Push a string flag when the value is present. */
  private pushString(
    /** CLI argument array to mutate */
    cliArgs: string[],
    /** Flag name */
    flag: string,
    /** Optional value */
    value?: string,
  ): void {
    if (value !== undefined && value !== "") cliArgs.push(flag, value)
  }

  /** Push a numeric flag when the value is present. */
  private pushNumber(
    /** CLI argument array to mutate */
    cliArgs: string[],
    /** Flag name */
    flag: string,
    /** Optional value */
    value?: number,
  ): void {
    if (value !== undefined) cliArgs.push(flag, String(value))
  }

  /** Push a boolean flag when the value is true. */
  private pushBoolean(
    /** CLI argument array to mutate */
    cliArgs: string[],
    /** Flag name */
    flag: string,
    /** Optional value */
    value?: boolean,
  ): void {
    if (value) cliArgs.push(flag)
  }

  /** Push a comma-separated string-array flag when values are present. */
  private pushStringArray(
    /** CLI argument array to mutate */
    cliArgs: string[],
    /** Flag name */
    flag: string,
    /** Optional values */
    values?: string[],
  ): void {
    if (values?.length) cliArgs.push(flag, values.join(","))
  }

  /** Push a repeatable string flag once for each value. */
  private pushRepeatedStrings(
    /** CLI argument array to mutate */
    cliArgs: string[],
    /** Flag name */
    flag: string,
    /** Optional values */
    values?: string[],
  ): void {
    for (const value of values ?? []) cliArgs.push(flag, value)
  }

  /** Run a command and parse a JSON value from stdout. */
  private async runJson(
    /** CLI arguments */
    args: string[],
  ): Promise<unknown> {
    return this.parseJson(await this.runText(args))
  }

  /** Run a command and return stdout text. */
  private async runText(
    /** CLI arguments */
    args: string[],
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        this.bdPath,
        args,
        {
          cwd: this.workspaceRoot,
          timeout: this.requestTimeout,
          env: {
            ...process.env,
            BEADS_ACTOR: this.actor,
          },
          maxBuffer: 10 * 1024 * 1024,
        },
        (error, stdout, stderr) => {
          if (error) {
            const message = this.extractCliError(stdout, stderr, error.message)
            reject(new Error(message))
            return
          }
          resolve(stdout)
        },
      )
    })
  }

  /** Parse the last JSON value in stdout so setup messages do not break consumers. */
  private parseJson(
    /** Raw stdout */
    stdout: string,
  ): unknown {
    const trimmed = stdout.trim()
    if (!trimmed) return undefined
    try {
      return JSON.parse(trimmed) as unknown
    } catch {
      for (let i = 0; i < trimmed.length; i++) {
        const char = trimmed[i]
        if (char !== "{" && char !== "[") continue
        try {
          return JSON.parse(trimmed.slice(i)) as unknown
        } catch {
          // Keep scanning for a later JSON payload.
        }
      }
    }
    throw new Error(`Failed to parse bd JSON output: ${trimmed}`)
  }

  /** Extract a readable error from CLI stderr/stdout. */
  private extractCliError(
    /** Raw stdout */
    stdout: string,
    /** Raw stderr */
    stderr: string,
    /** Fallback error message */
    fallback: string,
  ): string {
    const fromStdout = this.tryParseError(stdout)
    if (fromStdout) return fromStdout
    const fromStderr = this.tryParseError(stderr)
    if (fromStderr) return fromStderr
    return stderr.trim() || stdout.trim() || fallback
  }

  /** Try to parse a structured CLI error payload. */
  private tryParseError(
    /** Raw command output */
    output: string,
  ): string | null {
    try {
      const parsed = this.parseJson(output) as { error?: string }
      return parsed?.error ?? null
    } catch {
      return null
    }
  }

  /** Normalize issue-like JSON into the SDK issue shape. */
  private normalizeIssue(
    /** Raw issue JSON */
    value: unknown,
  ): Issue {
    const issue = value as Partial<Issue>
    return {
      ...issue,
      id: issue.id ?? "",
      title: issue.title ?? "",
      description: issue.description ?? "",
      status: issue.status ?? "open",
      priority: issue.priority ?? 2,
      issue_type: issue.issue_type ?? "task",
      labels: issue.labels ?? [],
      created_at: issue.created_at ?? "",
      updated_at: issue.updated_at ?? "",
      dependency_count: issue.dependency_count ?? issue.dependencies?.length ?? 0,
      dependent_count: issue.dependent_count ?? issue.dependents?.length ?? 0,
      dependencies: issue.dependencies ?? [],
      dependents: issue.dependents ?? [],
    }
  }

  /** Normalize an array of issue-like JSON records. */
  private normalizeIssues(
    /** Raw issue array */
    value: unknown,
  ): Issue[] {
    if (!Array.isArray(value)) return []
    return value.map(issue => this.normalizeIssue(issue))
  }

  /** Normalize `bd label list-all --json` output to the SDK string array. */
  private normalizeLabels(
    /** Raw label output */
    value: unknown,
  ): string[] {
    if (!Array.isArray(value)) return []
    return value
      .map(label => (typeof label === "string" ? label : (label as { label?: string }).label))
      .filter((label): label is string => typeof label === "string")
  }

  /** Build a label operation result for CLI commands that do not need custom parsing. */
  private labelResult(
    /** Operation arguments */
    args: Record<string, unknown>,
    /** Result status */
    status: LabelResult["status"],
  ): LabelResult {
    return {
      issue_id: String(args.id),
      label: String(args.label),
      status,
    }
  }

  /** Build a dependency operation result for CLI commands that do not need custom parsing. */
  private depResult(
    /** Operation arguments */
    args: Record<string, unknown>,
    /** Result status */
    status: DepResult["status"],
  ): DepResult {
    return {
      issue_id: String(args.from_id),
      depends_on_id: String(args.to_id),
      status,
      type: (args.dep_type as DepType | undefined) ?? "blocks",
    }
  }
}

/** Options for CliTransport. */
export interface CliTransportOptions {
  /** Path or command name for the beads executable (default: "bd") */
  bdPath?: string
  /** Timeout per CLI request in ms (default: 10000) */
  requestTimeout?: number
  /** Actor name sent with each request (default: "sdk") */
  actor?: string
}
