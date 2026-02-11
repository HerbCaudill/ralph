/**
 * BdProxy provides typed CRUD operations for beads issues via the daemon socket.
 */
import { DaemonTransport } from "@herbcaudill/beads-sdk"
import type {
  BdIssue,
  BdInfo,
  BdLabelResult,
  BdDepResult,
  BdComment,
  BdListOptions,
  BdCreateOptions,
  BdUpdateOptions,
} from "./lib/bdTypes.js"

export type {
  IssueStatus,
  BdIssue,
  BdDependency,
  BdListOptions,
  BdCreateOptions,
  BdUpdateOptions,
  BdInfo,
  BdLabelResult,
  BdDepResult,
  BdComment,
  MutationType,
  MutationEvent,
} from "./lib/bdTypes.js"

/** Typed client for the beads issue tracker via daemon RPC. */
export class BdProxy {
  private transport: DaemonTransport

  constructor(options: BdProxyOptions = {}) {
    this.transport = new DaemonTransport(options.cwd ?? process.cwd(), {
      requestTimeout: options.requestTimeout,
      actor: options.actor ?? "beads-server",
    })
  }

  /** List issues with optional filters. */
  async list(options: BdListOptions = {}): Promise<BdIssue[]> {
    const args: Record<string, unknown> = {}
    if (options.limit) args.limit = options.limit
    if (options.status) args.status = options.status
    if (options.priority !== undefined) args.priority = options.priority
    if (options.type) args.issue_type = options.type
    if (options.assignee) args.assignee = options.assignee
    if (options.parent) args.parent = options.parent
    if (options.ready) args.ready = true
    if (options.all) args.all = true
    return (await this.send("list", args)) as BdIssue[]
  }

  /** List blocked issues. */
  async blocked(parent?: string): Promise<BdIssue[]> {
    const args: Record<string, unknown> = {}
    if (parent) args.parent_id = parent
    return (await this.send("blocked", args)) as BdIssue[]
  }

  /** Show details for one or more issues. */
  async show(ids: string | string[]): Promise<BdIssue[]> {
    const idList = Array.isArray(ids) ? ids : [ids]
    return (await this.send("show", { ids: idList })) as BdIssue[]
  }

  /** List issues enriched with parent and dependency fields. */
  async listWithParents(options: BdListOptions = {}): Promise<BdIssue[]> {
    const issues = await this.list(options)
    if (issues.length === 0) return issues
    const ids = issues.map(issue => issue.id)
    const detailedIssues = await this.show(ids)
    const detailsMap = new Map<string, BdIssue>()
    for (const issue of detailedIssues) detailsMap.set(issue.id, issue)

    return issues.map(issue => {
      const details = detailsMap.get(issue.id)
      if (!details) return issue
      const enriched = { ...issue }
      if (details.parent) enriched.parent = details.parent
      if (details.dependencies) {
        enriched.dependencies = details.dependencies
        const blockers = details.dependencies.filter(
          dep => dep.dependency_type === "blocks" && dep.status !== "closed",
        )
        if (blockers.length > 0) {
          enriched.blocked_by_count = blockers.length
          enriched.blocked_by = blockers.map(b => b.id)
          if (enriched.status === "open") {
            enriched.status = "blocked"
          }
        }
      }
      return enriched
    })
  }

  /** Create a new issue. */
  async create(options: BdCreateOptions): Promise<BdIssue> {
    const args: Record<string, unknown> = { title: options.title }
    if (options.description) args.description = options.description
    if (options.priority !== undefined) args.priority = options.priority
    if (options.type) args.issue_type = options.type
    if (options.assignee) args.assignee = options.assignee
    if (options.parent) args.parent = options.parent
    if (options.labels?.length) args.labels = options.labels
    const result = await this.send("create", args)
    const issue: BdIssue = Array.isArray(result) ? result[0] : (result as BdIssue)
    if (!issue || !issue.id) throw new Error("create did not return an issue")
    return issue
  }

  /** Update one or more issues. */
  async update(ids: string | string[], options: BdUpdateOptions): Promise<BdIssue[]> {
    const idList = Array.isArray(ids) ? ids : [ids]
    const args: Record<string, unknown> = { ids: idList }
    if (options.title) args.title = options.title
    if (options.description) args.description = options.description
    if (options.priority !== undefined) args.priority = options.priority
    if (options.status) args.status = options.status
    if (options.type) args.issue_type = options.type
    if (options.assignee) args.assignee = options.assignee
    if (options.parent !== undefined) args.parent = options.parent
    if (options.addLabels?.length) args.add_labels = options.addLabels
    if (options.removeLabels?.length) args.remove_labels = options.removeLabels
    return (await this.send("update", args)) as BdIssue[]
  }

  /** Delete one or more issues. */
  async delete(ids: string | string[]): Promise<void> {
    const idList = Array.isArray(ids) ? ids : [ids]
    await this.send("delete", { ids: idList, force: true })
  }

  /** Add a comment to an issue. */
  async addComment(id: string, comment: string, author?: string): Promise<void> {
    const args: Record<string, unknown> = { id, text: comment }
    if (author) args.author = author
    await this.send("comment_add", args)
  }

  /** Get comments for an issue. */
  async getComments(id: string): Promise<BdComment[]> {
    return (await this.send("comments", { id })) as BdComment[]
  }

  /** Get database info. */
  async getInfo(): Promise<BdInfo> {
    return (await this.send("info", {})) as BdInfo
  }

  /** Get labels for an issue. */
  async getLabels(id: string): Promise<string[]> {
    return (await this.send("label_list", { id })) as string[]
  }

  /** Add a label to an issue. */
  async addLabel(id: string, label: string): Promise<BdLabelResult> {
    const result = (await this.send("label_add", { id, label })) as BdLabelResult[]
    return result[0]
  }

  /** Remove a label from an issue. */
  async removeLabel(id: string, label: string): Promise<BdLabelResult> {
    const result = (await this.send("label_remove", { id, label })) as BdLabelResult[]
    return result[0]
  }

  /** List all unique labels in the database. */
  async listAllLabels(): Promise<string[]> {
    return (await this.send("label_list_all", {})) as string[]
  }

  /** Add a blocking dependency between two issues. */
  async addBlocker(blockedId: string, blockerId: string): Promise<BdDepResult> {
    return (await this.send("dep_add", {
      from_id: blockedId,
      to_id: blockerId,
    })) as BdDepResult
  }

  /** Remove a blocking dependency between two issues. */
  async removeBlocker(blockedId: string, blockerId: string): Promise<BdDepResult> {
    return (await this.send("dep_remove", {
      from_id: blockedId,
      to_id: blockerId,
    })) as BdDepResult
  }

  /** Send an RPC request to the daemon. */
  private send(operation: string, args: Record<string, unknown>): Promise<unknown> {
    return this.transport.send(operation, args)
  }
}

/** Options for creating a BdProxy. */
export interface BdProxyOptions {
  /** Working directory (used to locate .beads/bd.sock) */
  cwd?: string
  /** Request timeout in ms (default: 5000) */
  requestTimeout?: number
  /** Actor name sent with requests (default: "beads-server") */
  actor?: string
}
