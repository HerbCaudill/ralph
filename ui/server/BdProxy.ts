import { spawn, type SpawnOptions } from "node:child_process"
import type {
  BdIssue,
  BdListOptions,
  BdCreateOptions,
  BdUpdateOptions,
  BdInfo,
  BdLabelResult,
  BdDepResult,
  BdComment,
} from "@herbcaudill/ralph-shared"

/**
 * Re-export beads domain types from shared package for backward compatibility.
 */
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
} from "@herbcaudill/ralph-shared"

/**
 * Local types specific to BdProxy.
 */
export type SpawnFn = (
  command: string,
  args: string[],
  options: SpawnOptions,
) => ReturnType<typeof spawn>

export interface BdProxyOptions {
  /** Command to run (default: "bd") */
  command?: string
  /** Working directory for bd commands */
  cwd?: string
  /** Additional environment variables */
  env?: Record<string, string>
  /** Custom spawn function (for testing) */
  spawn?: SpawnFn
  /** Timeout in ms (default: 30000) */
  timeout?: number
}

/**
 * Proxy class to spawn bd commands and parse JSON output.
 *
 * Provides typed methods for common bd operations: list, show, create, update.
 */
export class BdProxy {
  private options: {
    command: string
    cwd: string
    env: Record<string, string>
    spawn: SpawnFn
    timeout: number
  }

  constructor(options: BdProxyOptions = {}) {
    this.options = {
      command: options.command ?? "bd",
      cwd: options.cwd ?? process.cwd(),
      env: options.env ?? {},
      spawn: options.spawn ?? spawn,
      timeout: options.timeout ?? 30_000,
    }
  }

  /**
   * List issues with optional filters.
   */
  async list(options: BdListOptions = {}): Promise<BdIssue[]> {
    const args = ["list", "--json"]

    if (options.limit !== undefined) {
      args.push("--limit", String(options.limit))
    }
    if (options.status) {
      args.push("--status", options.status)
    }
    if (options.priority !== undefined) {
      args.push("--priority", String(options.priority))
    }
    if (options.type) {
      args.push("--type", options.type)
    }
    if (options.assignee) {
      args.push("--assignee", options.assignee)
    }
    if (options.parent) {
      args.push("--parent", options.parent)
    }
    if (options.ready) {
      args.push("--ready")
    }
    if (options.all) {
      args.push("--all")
    }

    const result = await this.exec(args)
    return JSON.parse(result) as BdIssue[]
  }

  /**
   * List blocked issues.
   *
   * This includes both issues with status="blocked" AND open issues that have
   * unsatisfied blocking dependencies (open issues that depend on other open issues).
   */
  async blocked(
    /** Optional parent to filter descendants */
    parent?: string,
  ): Promise<BdIssue[]> {
    const args = ["blocked", "--json"]

    if (parent) {
      args.push("--parent", parent)
    }

    const result = await this.exec(args)
    return JSON.parse(result) as BdIssue[]
  }

  /**
   * Show details for one or more issues.
   */
  async show(ids: string | string[]): Promise<BdIssue[]> {
    const idList = Array.isArray(ids) ? ids : [ids]
    const args = ["show", "--json", ...idList]

    const result = await this.exec(args)
    return JSON.parse(result) as BdIssue[]
  }

  /**
   * List issues with parent and dependencies fields from detailed issue data.
   *
   * This method fetches all issues matching the filters and then enriches them
   * with the `parent` and `dependencies` fields from the full issue details.
   * The `bd show` command returns these fields for issues that have dependency
   * relationships. This supports hierarchical task structures and blocking
   * relationship detection.
   */
  async listWithParents(options: BdListOptions = {}): Promise<BdIssue[]> {
    // First, get the filtered list of issues
    const issues = await this.list(options)

    if (issues.length === 0) {
      return issues
    }

    // Get full details for all issues to access their dependents
    const ids = issues.map(issue => issue.id)
    const detailedIssues = await this.show(ids)

    // Create a map for quick lookup
    const detailsMap = new Map<string, BdIssue>()
    for (const issue of detailedIssues) {
      detailsMap.set(issue.id, issue)
    }

    // Enrich each issue with parent, dependencies, and blocked_by_count fields
    // The `bd show` command returns these fields directly when an issue
    // has dependency relationships
    return issues.map(issue => {
      const details = detailsMap.get(issue.id)
      if (!details) {
        return issue
      }

      const enriched = { ...issue }
      if (details.parent) {
        enriched.parent = details.parent
      }
      if (details.dependencies) {
        enriched.dependencies = details.dependencies

        // Compute blocked_by_count: count dependencies with type "blocks" that are not closed
        // A task is blocked if it has any open blocking dependencies
        const blockers = details.dependencies.filter(
          dep => dep.dependency_type === "blocks" && dep.status !== "closed",
        )
        if (blockers.length > 0) {
          enriched.blocked_by_count = blockers.length
          enriched.blocked_by = blockers.map(b => b.id)
          // Set status to "blocked" for display purposes if the task is open but has blockers
          // This allows the UI to show the correct blocked status icon
          if (enriched.status === "open") {
            enriched.status = "blocked"
          }
        }
      }
      return enriched
    })
  }

  /**
   * Create a new issue.
   */
  async create(
    /** Create options */
    options: BdCreateOptions,
  ): Promise<BdIssue> {
    const args = ["create", "--json", options.title]

    if (options.description) {
      args.push("--description", options.description)
    }
    if (options.priority !== undefined) {
      args.push("--priority", String(options.priority))
    }
    if (options.type) {
      args.push("--type", options.type)
    }
    if (options.assignee) {
      args.push("--assignee", options.assignee)
    }
    if (options.parent) {
      args.push("--parent", options.parent)
    }
    if (options.labels && options.labels.length > 0) {
      args.push("--labels", options.labels.join(","))
    }

    const result = await this.exec(args)
    const parsed = JSON.parse(result)
    // bd create returns a single object, not an array
    const issue: BdIssue = Array.isArray(parsed) ? parsed[0] : parsed
    if (!issue || !issue.id) {
      throw new Error("bd create did not return an issue")
    }
    return issue
  }

  /**
   * Update one or more issues.
   */
  async update(
    /** Issue ID(s) to update */
    ids: string | string[],
    /** Fields to update */
    options: BdUpdateOptions,
  ): Promise<BdIssue[]> {
    const idList = Array.isArray(ids) ? ids : [ids]
    const args = ["update", "--json", ...idList]

    if (options.title) {
      args.push("--title", options.title)
    }
    if (options.description) {
      args.push("--description", options.description)
    }
    if (options.priority !== undefined) {
      args.push("--priority", String(options.priority))
    }
    if (options.status) {
      args.push("--status", options.status)
    }
    if (options.type) {
      args.push("--type", options.type)
    }
    if (options.assignee) {
      args.push("--assignee", options.assignee)
    }
    if (options.parent !== undefined) {
      args.push("--parent", options.parent)
    }
    if (options.addLabels && options.addLabels.length > 0) {
      for (const label of options.addLabels) {
        args.push("--add-label", label)
      }
    }
    if (options.removeLabels && options.removeLabels.length > 0) {
      for (const label of options.removeLabels) {
        args.push("--remove-label", label)
      }
    }

    const result = await this.exec(args)
    return JSON.parse(result) as BdIssue[]
  }

  /**
   * Close one or more issues.
   */
  async close(
    /** Issue ID(s) to close */
    ids: string | string[],
  ): Promise<BdIssue[]> {
    const idList = Array.isArray(ids) ? ids : [ids]
    const args = ["close", "--json", ...idList]

    const result = await this.exec(args)
    return JSON.parse(result) as BdIssue[]
  }

  /**
   * Delete one or more issues.
   */
  async delete(
    /** Issue ID(s) to delete */
    ids: string | string[],
  ): Promise<void> {
    const idList = Array.isArray(ids) ? ids : [ids]
    const args = ["delete", "--force", ...idList]

    await this.exec(args)
  }

  /**
   * Add a comment to an issue.
   */
  async addComment(
    /** Issue ID to add comment to */
    id: string,
    /** The comment text */
    comment: string,
    /** Optional author name (defaults to git user) */
    author?: string,
  ): Promise<void> {
    const args = ["comments", "add", id, comment]
    if (author) {
      args.push("--author", author)
    }
    await this.exec(args)
  }

  /**
   * Get comments for an issue.
   */
  async getComments(
    /** Issue ID to get comments for */
    id: string,
  ): Promise<BdComment[]> {
    const args = ["comments", id, "--json"]
    const result = await this.exec(args)
    return JSON.parse(result) as BdComment[]
  }

  /**
   * Get database info.
   */
  async getInfo(): Promise<BdInfo> {
    const args = ["info", "--json"]
    const result = await this.exec(args)
    return JSON.parse(result) as BdInfo
  }

  /**
   * Get labels for an issue.
   */
  async getLabels(
    /** Issue ID to get labels for */
    id: string,
  ): Promise<string[]> {
    const args = ["label", "list", id, "--json"]
    const result = await this.exec(args)
    return JSON.parse(result) as string[]
  }

  /**
   * Add a label to an issue.
   */
  async addLabel(
    /** Issue ID to add label to */
    id: string,
    /** Label to add */
    label: string,
  ): Promise<BdLabelResult> {
    const args = ["label", "add", id, label, "--json"]
    const result = await this.exec(args)
    const results = JSON.parse(result) as BdLabelResult[]
    return results[0]
  }

  /**
   * Remove a label from an issue.
   */
  async removeLabel(
    /** Issue ID to remove label from */
    id: string,
    /** Label to remove */
    label: string,
  ): Promise<BdLabelResult> {
    const args = ["label", "remove", id, label, "--json"]
    const result = await this.exec(args)
    const results = JSON.parse(result) as BdLabelResult[]
    return results[0]
  }

  /**
   * List all unique labels in the database.
   */
  async listAllLabels(): Promise<string[]> {
    const args = ["label", "list-all", "--json"]
    const result = await this.exec(args)
    return JSON.parse(result) as string[]
  }

  /**
   * Add a blocking dependency between two issues.
   * The blocker issue blocks the blocked issue (blocked depends on blocker).
   */
  async addBlocker(
    /** Issue ID that will be blocked */
    blockedId: string,
    /** Issue ID that blocks the first issue */
    blockerId: string,
  ): Promise<BdDepResult> {
    const args = ["dep", "add", blockedId, blockerId, "--json"]
    const result = await this.exec(args)
    return JSON.parse(result) as BdDepResult
  }

  /**
   * Remove a blocking dependency between two issues.
   */
  async removeBlocker(
    /** Issue ID that was blocked */
    blockedId: string,
    /** Issue ID that was blocking */
    blockerId: string,
  ): Promise<BdDepResult> {
    const args = ["dep", "remove", blockedId, blockerId, "--json"]
    const result = await this.exec(args)
    return JSON.parse(result) as BdDepResult
  }

  /**
   * Execute a bd command and return stdout.
   */
  private exec(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = this.options.spawn(this.options.command, args, {
        cwd: this.options.cwd,
        env: { ...process.env, ...this.options.env },
        stdio: ["ignore", "pipe", "pipe"],
      })

      let stdout = ""
      let stderr = ""

      const timeoutId = setTimeout(() => {
        proc.kill("SIGKILL")
        reject(new Error(`bd command timed out after ${this.options.timeout}ms`))
      }, this.options.timeout)

      proc.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString()
      })

      proc.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString()
      })

      proc.on("error", err => {
        clearTimeout(timeoutId)
        reject(err)
      })

      proc.on("close", code => {
        clearTimeout(timeoutId)
        if (code === 0) {
          resolve(stdout)
        } else {
          reject(new Error(`bd exited with code ${code}: ${stderr.trim() || stdout.trim()}`))
        }
      })
    })
  }
}
