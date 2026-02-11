/**
 * BdProxy wraps the `bd` CLI to provide typed CRUD operations for beads issues.
 */
import {
  exec,
  resolveExecOptions,
  type ExecOptions,
  type ResolvedExecOptions,
} from "./lib/bdExec.js"
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

export type { SpawnFn } from "./lib/bdExec.js"
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

/**
 * Typed client for the beads issue tracker.
 * Spawns `bd` subprocesses for each operation.
 */
export class BdProxy {
  private execOptions: ResolvedExecOptions

  constructor(options: BdProxyOptions = {}) {
    this.execOptions = resolveExecOptions(options)
  }

  /** List issues with optional filters. */
  async list(options: BdListOptions = {}): Promise<BdIssue[]> {
    const args = ["list", "--json"]
    if (options.limit) args.push("--limit", String(options.limit))
    if (options.status) args.push("--status", options.status)
    if (options.priority !== undefined) args.push("--priority", String(options.priority))
    if (options.type) args.push("--type", options.type)
    if (options.assignee) args.push("--assignee", options.assignee)
    if (options.parent) args.push("--parent", options.parent)
    if (options.ready) args.push("--ready")
    if (options.all) args.push("--all")
    const result = await this.exec(args)
    return JSON.parse(result) as BdIssue[]
  }

  /** List blocked issues. */
  async blocked(parent?: string): Promise<BdIssue[]> {
    const args = ["blocked", "--json"]
    if (parent) args.push("--parent", parent)
    const result = await this.exec(args)
    return JSON.parse(result) as BdIssue[]
  }

  /** Show details for one or more issues. */
  async show(ids: string | string[]): Promise<BdIssue[]> {
    const idList = Array.isArray(ids) ? ids : [ids]
    const args = ["show", "--json", ...idList]
    const result = await this.exec(args)
    return JSON.parse(result) as BdIssue[]
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
    const args = ["create", "--json", options.title]
    if (options.description) args.push("--description", options.description)
    if (options.priority !== undefined) args.push("--priority", String(options.priority))
    if (options.type) args.push("--type", options.type)
    if (options.assignee) args.push("--assignee", options.assignee)
    if (options.parent) args.push("--parent", options.parent)
    if (options.labels && options.labels.length > 0) args.push("--labels", options.labels.join(","))
    const result = await this.exec(args)
    const parsed = JSON.parse(result)
    const issue: BdIssue = Array.isArray(parsed) ? parsed[0] : parsed
    if (!issue || !issue.id) throw new Error("bd create did not return an issue")
    return issue
  }

  /** Update one or more issues. */
  async update(ids: string | string[], options: BdUpdateOptions): Promise<BdIssue[]> {
    const idList = Array.isArray(ids) ? ids : [ids]
    const args = ["update", "--json", ...idList]
    if (options.title) args.push("--title", options.title)
    if (options.description) args.push("--description", options.description)
    if (options.priority !== undefined) args.push("--priority", String(options.priority))
    if (options.status) args.push("--status", options.status)
    if (options.type) args.push("--type", options.type)
    if (options.assignee) args.push("--assignee", options.assignee)
    if (options.parent !== undefined) args.push("--parent", options.parent)
    if (options.addLabels?.length)
      for (const label of options.addLabels) args.push("--add-label", label)
    if (options.removeLabels?.length)
      for (const label of options.removeLabels) args.push("--remove-label", label)
    const result = await this.exec(args)
    return JSON.parse(result) as BdIssue[]
  }

  /** Delete one or more issues. */
  async delete(ids: string | string[]): Promise<void> {
    const idList = Array.isArray(ids) ? ids : [ids]
    const args = ["delete", "--force", ...idList]
    await this.exec(args)
  }

  /** Add a comment to an issue. */
  async addComment(id: string, comment: string, author?: string): Promise<void> {
    const args = ["comments", "add", id, comment]
    if (author) args.push("--author", author)
    await this.exec(args)
  }

  /** Get comments for an issue. */
  async getComments(id: string): Promise<BdComment[]> {
    const args = ["comments", id, "--json"]
    const result = await this.exec(args)
    return JSON.parse(result) as BdComment[]
  }

  /** Get database info. */
  async getInfo(): Promise<BdInfo> {
    const args = ["info", "--json"]
    const result = await this.exec(args)
    return JSON.parse(result) as BdInfo
  }

  /** Get labels for an issue. */
  async getLabels(id: string): Promise<string[]> {
    const args = ["label", "list", id, "--json"]
    const result = await this.exec(args)
    return JSON.parse(result) as string[]
  }

  /** Add a label to an issue. */
  async addLabel(id: string, label: string): Promise<BdLabelResult> {
    const args = ["label", "add", id, label, "--json"]
    const result = await this.exec(args)
    const results = JSON.parse(result) as BdLabelResult[]
    return results[0]
  }

  /** Remove a label from an issue. */
  async removeLabel(id: string, label: string): Promise<BdLabelResult> {
    const args = ["label", "remove", id, label, "--json"]
    const result = await this.exec(args)
    const results = JSON.parse(result) as BdLabelResult[]
    return results[0]
  }

  /** List all unique labels in the database. */
  async listAllLabels(): Promise<string[]> {
    const args = ["label", "list-all", "--json"]
    const result = await this.exec(args)
    return JSON.parse(result) as string[]
  }

  /** Add a blocking dependency between two issues. */
  async addBlocker(blockedId: string, blockerId: string): Promise<BdDepResult> {
    const args = ["dep", "add", blockedId, blockerId, "--json"]
    const result = await this.exec(args)
    return JSON.parse(result) as BdDepResult
  }

  /** Remove a blocking dependency between two issues. */
  async removeBlocker(blockedId: string, blockerId: string): Promise<BdDepResult> {
    const args = ["dep", "remove", blockedId, blockerId, "--json"]
    const result = await this.exec(args)
    return JSON.parse(result) as BdDepResult
  }

  /** Execute a bd command and return stdout. */
  private exec(args: string[]): Promise<string> {
    return exec(args, this.execOptions)
  }
}

/** Options for creating a BdProxy. */
export interface BdProxyOptions extends ExecOptions {}
