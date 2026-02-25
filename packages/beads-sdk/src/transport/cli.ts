import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { findBeadsDir } from "./discovery.js"
import type { Transport } from "../types.js"

const execFileAsync = promisify(execFile)

/**
 * Transport that communicates with beads by shelling out to the `bd` CLI.
 * Replaces DaemonTransport now that the bd daemon has been removed (v0.50.0+).
 * Each operation maps to a `bd` subcommand with `--json` output.
 */
export class CliTransport implements Transport {
  private workspaceRoot: string
  private requestTimeout: number
  private actor: string

  constructor(
    /** Workspace root directory */
    workspaceRoot: string,
    /** Transport options */
    options: CliTransportOptions = {},
  ) {
    this.workspaceRoot = workspaceRoot
    this.requestTimeout = options.requestTimeout ?? 30000
    this.actor = options.actor ?? "sdk"
  }

  /** Execute a bd CLI operation and return the parsed JSON result. */
  async send(
    /** Operation name (maps to a bd subcommand) */
    operation: string,
    /** Operation arguments */
    args: Record<string, unknown> = {},
  ): Promise<unknown> {
    // get_mutations has no CLI equivalent; return empty array
    if (operation === "get_mutations") {
      return []
    }

    const cmdArgs = this.buildCommand(operation, args)
    return this.exec(cmdArgs)
  }

  /** No-op; CLI transport has no persistent connections. */
  close(): void {}

  /** Execute a bd CLI command and parse the JSON output. */
  private async exec(
    /** Command-line arguments for bd */
    args: string[],
  ): Promise<unknown> {
    const { stdout, stderr } = await execFileAsync("bd", args, {
      cwd: this.workspaceRoot,
      timeout: this.requestTimeout,
      maxBuffer: 50 * 1024 * 1024, // 50MB to handle large issue databases
      env: {
        ...process.env,
        BD_ACTOR: this.actor,
      },
    })

    const trimmed = stdout.trim()
    if (!trimmed) {
      // Some commands (delete, close) may not produce JSON output
      return undefined
    }

    try {
      return JSON.parse(trimmed)
    } catch {
      // If stderr has content, it might be an error message
      if (stderr.trim()) {
        throw new Error(`bd command failed: ${stderr.trim()}`)
      }
      throw new Error(`Failed to parse bd output: ${trimmed.slice(0, 200)}`)
    }
  }

  /** Map an operation name + args to bd CLI arguments. */
  private buildCommand(
    /** Operation name */
    operation: string,
    /** Operation arguments */
    args: Record<string, unknown>,
  ): string[] {
    switch (operation) {
      case "ping":
        return ["info", "--json"]

      case "health":
        return ["info", "--json"]

      case "info":
        return ["info", "--json"]

      case "stats":
        return ["status", "--json"]

      case "list":
        return this.buildListCommand(args)

      case "show":
        return ["show", String(args.id), "--json"]

      case "ready":
        return this.buildReadyCommand(args)

      case "blocked":
        return this.buildBlockedCommand(args)

      case "create":
        return this.buildCreateCommand(args)

      case "update":
        return this.buildUpdateCommand(args)

      case "close":
        return this.buildCloseCommand(args)

      case "delete":
        return this.buildDeleteCommand(args)

      case "comment_add":
        return ["comments", "add", String(args.id), String(args.text), "--json"]

      case "comment_list":
        return ["comments", String(args.id), "--json"]

      case "label_list":
        return ["label", "list", String(args.id), "--json"]

      case "label_add":
        return ["label", "add", String(args.id), String(args.label), "--json"]

      case "label_remove":
        return ["label", "remove", String(args.id), String(args.label), "--json"]

      case "label_list_all":
        return ["label", "list-all", "--json"]

      case "dep_add":
        return ["dep", "add", String(args.from_id), String(args.to_id), "--json"]

      case "dep_remove":
        return ["dep", "remove", String(args.from_id), String(args.to_id), "--json"]

      default:
        throw new Error(`Unknown operation: ${operation}`)
    }
  }

  /** Build arguments for the list command. */
  private buildListCommand(args: Record<string, unknown>): string[] {
    const cmd = ["list", "--json"]
    if (args.status) cmd.push("--status", String(args.status))
    if (args.priority !== undefined) cmd.push("--priority", String(args.priority))
    if (args.issue_type) cmd.push("--type", String(args.issue_type))
    if (args.assignee) cmd.push("--assignee", String(args.assignee))
    if (args.parent) cmd.push("--parent", String(args.parent))
    if (args.ready) cmd.push("--ready")
    if (args.all) cmd.push("--all")
    if (args.limit !== undefined) cmd.push("--limit", String(args.limit))
    return cmd
  }

  /** Build arguments for the ready command. */
  private buildReadyCommand(args: Record<string, unknown>): string[] {
    const cmd = ["ready", "--json"]
    if (args.assignee) cmd.push("--assignee", String(args.assignee))
    if (args.priority !== undefined) cmd.push("--priority", String(args.priority))
    if (args.parent_id) cmd.push("--parent", String(args.parent_id))
    if (args.limit !== undefined) cmd.push("--limit", String(args.limit))
    return cmd
  }

  /** Build arguments for the blocked command. */
  private buildBlockedCommand(args: Record<string, unknown>): string[] {
    const cmd = ["blocked", "--json"]
    if (args.parent_id) cmd.push("--parent", String(args.parent_id))
    return cmd
  }

  /** Build arguments for the create command. */
  private buildCreateCommand(args: Record<string, unknown>): string[] {
    const cmd = ["create", "--json"]
    if (args.title) cmd.push("--title", String(args.title))
    if (args.description) cmd.push("--description", String(args.description))
    if (args.priority !== undefined) cmd.push("--priority", String(args.priority))
    if (args.issue_type) cmd.push("--type", String(args.issue_type))
    if (args.assignee) cmd.push("--assignee", String(args.assignee))
    if (args.parent) cmd.push("--parent", String(args.parent))
    if (Array.isArray(args.labels) && args.labels.length > 0) {
      cmd.push("--labels", args.labels.join(","))
    }
    if (args.id) cmd.push("--id", String(args.id))
    return cmd
  }

  /** Build arguments for the update command. */
  private buildUpdateCommand(args: Record<string, unknown>): string[] {
    const cmd = ["update", String(args.id), "--json"]
    if (args.title) cmd.push("--title", String(args.title))
    if (args.description) cmd.push("--description", String(args.description))
    if (args.priority !== undefined) cmd.push("--priority", String(args.priority))
    if (args.status) cmd.push("--status", String(args.status))
    if (args.issue_type) cmd.push("--type", String(args.issue_type))
    if (args.assignee) cmd.push("--assignee", String(args.assignee))
    if (args.parent !== undefined) cmd.push("--parent", String(args.parent))
    if (Array.isArray(args.add_labels)) {
      for (const label of args.add_labels) {
        cmd.push("--add-label", String(label))
      }
    }
    if (Array.isArray(args.remove_labels)) {
      for (const label of args.remove_labels) {
        cmd.push("--remove-label", String(label))
      }
    }
    return cmd
  }

  /** Build arguments for the close command. */
  private buildCloseCommand(args: Record<string, unknown>): string[] {
    const cmd = ["close", String(args.id), "--json"]
    if (args.reason) cmd.push("--reason", String(args.reason))
    return cmd
  }

  /** Build arguments for the delete command. */
  private buildDeleteCommand(args: Record<string, unknown>): string[] {
    const cmd = ["delete", String(args.id), "--json"]
    if (args.force) cmd.push("--force")
    return cmd
  }
}

/** Options for CliTransport. */
export interface CliTransportOptions {
  /** Timeout per CLI invocation in ms (default: 30000) */
  requestTimeout?: number
  /** Actor name passed via BD_ACTOR env var (default: "sdk") */
  actor?: string
}
