/**
 * CodexAdapter - AgentAdapter implementation for OpenAI Codex CLI
 *
 * Wraps the Codex CLI (codex exec --json) and translates its native JSONL
 * events into normalized AgentEvent types.
 */

import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process"
import {
  AgentAdapter,
  type AgentInfo,
  type AgentMessage,
  type AgentStartOptions,
  type AgentMessageEvent,
  type AgentToolUseEvent,
  type AgentToolResultEvent,
  type AgentResultEvent,
  type AgentErrorEvent,
} from "./AgentAdapter.js"

// Types

export type SpawnFn = (command: string, args: string[], options: SpawnOptions) => ChildProcess

export interface CodexAdapterOptions {
  /** Command to spawn (default: "codex") */
  command?: string
  /** Custom spawn function (for testing) */
  spawn?: SpawnFn
}

/**
 * Codex CLI native event types from JSONL output.
 * These are the raw events before normalization.
 */
interface CodexNativeEvent {
  type: string
  [key: string]: unknown
}

interface CodexItem {
  id: string
  type: string
  text?: string
  command?: string
  aggregated_output?: string
  exit_code?: number | null
  status?: string
  [key: string]: unknown
}

interface CodexUsage {
  input_tokens?: number
  cached_input_tokens?: number
  output_tokens?: number
}

// CodexAdapter

/**
 * AgentAdapter implementation for the Codex CLI.
 *
 * Spawns the Codex CLI with `codex exec --json` and translates
 * the native JSONL events to normalized AgentEvent types.
 *
 * @example
 * ```ts
 * const adapter = new CodexAdapter()
 *
 * adapter.on("event", (event) => {
 *   if (event.type === "message") {
 *     console.log("Codex says:", event.content)
 *   }
 * })
 *
 * await adapter.start({ cwd: "/project" })
 * adapter.send({ type: "user_message", content: "Hello!" })
 * ```
 */
export class CodexAdapter extends AgentAdapter {
  private process: ChildProcess | null = null
  private buffer = ""
  private accumulatedMessage = ""
  private options: {
    command: string
    spawn: SpawnFn
  }

  constructor(options: CodexAdapterOptions = {}) {
    super()
    this.options = {
      command: options.command ?? "codex",
      spawn: options.spawn ?? spawn,
    }
  }

  /**
   * Get information about this adapter.
   */
  getInfo(): AgentInfo {
    return {
      id: "codex",
      name: "Codex",
      description: "OpenAI Codex via CLI",
      features: {
        streaming: true,
        tools: true,
        pauseResume: false, // Codex CLI doesn't support pause/resume in exec mode
        systemPrompt: false, // Codex doesn't support custom system prompts via CLI
      },
    }
  }

  /**
   * Check if Codex CLI is available.
   */
  async isAvailable(): Promise<boolean> {
    return new Promise(resolve => {
      try {
        const proc = this.options.spawn(this.options.command, ["--version"], {
          stdio: ["ignore", "pipe", "ignore"],
        })

        proc.on("error", () => resolve(false))
        proc.on("exit", code => resolve(code === 0))
      } catch {
        resolve(false)
      }
    })
  }

  /**
   * Start the Codex agent.
   *
   * Spawns the Codex CLI with JSONL output.
   */
  async start(options?: AgentStartOptions): Promise<void> {
    if (this.process) {
      throw new Error("Codex adapter is already running")
    }

    this.setStatus("starting")
    this.buffer = ""
    this.accumulatedMessage = ""

    // Build CLI arguments
    const args = this.buildArgs(options)

    return new Promise((resolve, reject) => {
      try {
        this.process = this.options.spawn(this.options.command, args, {
          cwd: options?.cwd,
          env: { ...process.env, ...options?.env },
          stdio: ["pipe", "pipe", "pipe"],
        })

        this.process.on("error", err => {
          this.handleProcessError(err)
          reject(err)
        })

        this.process.on("spawn", () => {
          this.setStatus("running")
          resolve()
        })

        this.process.on("exit", (code, signal) => {
          this.handleProcessExit(code, signal)
        })

        // Handle stdout - parse JSONL
        this.process.stdout?.on("data", (data: Buffer) => {
          this.handleStdout(data)
        })

        // Handle stderr
        this.process.stderr?.on("data", (data: Buffer) => {
          const message = data.toString().trim()
          if (message) {
            // Log but don't fail - stderr often has warnings
            console.error("[codex-adapter] stderr:", message)
          }
        })
      } catch (err) {
        this.setStatus("stopped")
        this.process = null
        reject(err)
      }
    })
  }

  /**
   * Send a message to Codex.
   */
  send(message: AgentMessage): void {
    if (!this.process?.stdin?.writable) {
      throw new Error("Codex adapter is not running or stdin is not writable")
    }

    if (message.type === "user_message" && message.content) {
      // Send user message via stdin
      this.process.stdin.write(message.content + "\n")
    } else if (message.type === "control") {
      // Handle control commands
      switch (message.command) {
        case "stop":
          this.stop()
          break
        // pause/resume not supported
      }
    }
  }

  /**
   * Stop the Codex agent.
   */
  async stop(force?: boolean): Promise<void> {
    if (!this.process) {
      return
    }

    this.setStatus("stopping")

    return new Promise(resolve => {
      const timeout = force ? 1000 : 5000

      const forceKillTimer = setTimeout(() => {
        if (this.process) {
          this.process.kill("SIGKILL")
        }
      }, timeout)

      const cleanup = () => {
        clearTimeout(forceKillTimer)
        resolve()
      }

      this.process!.once("exit", cleanup)
      this.process!.kill(force ? "SIGKILL" : "SIGTERM")
    })
  }

  /**
   * Build CLI arguments from start options.
   */
  private buildArgs(options?: AgentStartOptions): string[] {
    const args: string[] = ["exec", "--json"]

    if (options?.model) {
      args.push("--model", options.model)
    }

    if (options?.maxIterations !== undefined) {
      // Codex doesn't have a max iterations flag in the same way
      // but we could potentially handle this differently
    }

    // Add --skip-git-repo-check to allow running in any directory
    args.push("--skip-git-repo-check")

    // Use full-auto mode for automatic execution
    args.push("--full-auto")

    return args
  }

  /**
   * Handle stdout data, parsing JSONL.
   */
  private handleStdout(data: Buffer): void {
    this.buffer += data.toString()

    // Process complete lines (JSONL outputs newline-delimited JSON)
    let newlineIndex: number
    while ((newlineIndex = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, newlineIndex).trim()
      this.buffer = this.buffer.slice(newlineIndex + 1)

      if (line) {
        this.parseJsonLine(line)
      }
    }
  }

  /**
   * Parse a JSONL line from Codex CLI and emit normalized events.
   */
  private parseJsonLine(line: string): void {
    try {
      const nativeEvent = JSON.parse(line) as CodexNativeEvent
      this.translateEvent(nativeEvent)
    } catch {
      // Not valid JSON - ignore
    }
  }

  /**
   * Translate a native Codex CLI event to normalized AgentEvent(s).
   */
  private translateEvent(nativeEvent: CodexNativeEvent): void {
    const timestamp = this.now()

    switch (nativeEvent.type) {
      case "thread.started": {
        // Thread initialized - no specific event needed
        break
      }

      case "turn.started": {
        // New turn started - reset accumulated message
        this.accumulatedMessage = ""
        break
      }

      case "turn.completed": {
        // Turn completed - emit result if we have accumulated content
        const usage = nativeEvent.usage as CodexUsage | undefined

        if (this.accumulatedMessage) {
          const event: AgentResultEvent = {
            type: "result",
            timestamp,
            content: this.accumulatedMessage,
            usage:
              usage ?
                {
                  inputTokens: (usage.input_tokens ?? 0) + (usage.cached_input_tokens ?? 0),
                  outputTokens: usage.output_tokens,
                  totalTokens:
                    (usage.input_tokens ?? 0) +
                    (usage.cached_input_tokens ?? 0) +
                    (usage.output_tokens ?? 0),
                }
              : undefined,
          }
          this.emit("event", event)
        }
        break
      }

      case "item.started": {
        const item = nativeEvent.item as CodexItem | undefined
        if (!item) break

        if (item.type === "command_execution" && item.command) {
          // Tool use started
          const event: AgentToolUseEvent = {
            type: "tool_use",
            timestamp,
            toolUseId: item.id,
            tool: "bash",
            input: { command: item.command },
          }
          this.emit("event", event)
        }
        break
      }

      case "item.completed": {
        const item = nativeEvent.item as CodexItem | undefined
        if (!item) break

        if (item.type === "agent_message" && item.text) {
          // Agent message
          this.accumulatedMessage += item.text + "\n"
          const event: AgentMessageEvent = {
            type: "message",
            timestamp,
            content: item.text,
            isPartial: false,
          }
          this.emit("event", event)
        } else if (item.type === "reasoning" && item.text) {
          // Reasoning is similar to a message
          const event: AgentMessageEvent = {
            type: "message",
            timestamp,
            content: item.text,
            isPartial: false,
          }
          this.emit("event", event)
        } else if (item.type === "command_execution") {
          // Tool result
          const output = item.aggregated_output ?? ""
          const exitCode = item.exit_code
          const isError = exitCode !== 0

          const event: AgentToolResultEvent = {
            type: "tool_result",
            timestamp,
            toolUseId: item.id,
            output: isError ? undefined : output,
            error: isError ? output || `Command failed with exit code ${exitCode}` : undefined,
            isError,
          }
          this.emit("event", event)
        }
        break
      }

      case "error": {
        // Error event
        const message =
          typeof nativeEvent.error === "string" ? nativeEvent.error
          : typeof nativeEvent.message === "string" ? nativeEvent.message
          : "Unknown error"

        const event: AgentErrorEvent = {
          type: "error",
          timestamp,
          message,
          code: nativeEvent.code as string | undefined,
          fatal: true, // Assume errors from Codex CLI are fatal
        }
        this.emit("event", event)
        this.emit("error", new Error(message))
        break
      }

      default:
        // Unknown event type - ignore
        break
    }
  }

  /**
   * Handle process error.
   */
  private handleProcessError(err: Error): void {
    this.process = null
    this.setStatus("stopped")

    const errorEvent: AgentErrorEvent = {
      type: "error",
      timestamp: this.now(),
      message: err.message,
      fatal: true,
    }
    this.emit("event", errorEvent)
    this.emit("error", err)
  }

  /**
   * Handle process exit.
   */
  private handleProcessExit(code: number | null, signal: string | null): void {
    this.process = null
    this.setStatus("stopped")
    this.emit("exit", { code: code ?? undefined, signal: signal ?? undefined })
  }
}
