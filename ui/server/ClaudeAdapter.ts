/**
 * ClaudeAdapter - AgentAdapter implementation for Claude CLI
 *
 * Wraps the Claude CLI (claude command) and translates its native streaming JSON
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

export interface ClaudeAdapterOptions {
  /** Command to spawn (default: "claude") */
  command?: string
  /** Custom spawn function (for testing) */
  spawn?: SpawnFn
}

/**
 * Claude CLI native event types from stream-json output.
 * These are the raw events before normalization.
 */
interface ClaudeNativeEvent {
  type: string
  timestamp?: number
  [key: string]: unknown
}

// ClaudeAdapter

/**
 * AgentAdapter implementation for the Claude CLI.
 *
 * Spawns the Claude CLI with `--output-format stream-json` and translates
 * the native events to normalized AgentEvent types.
 *
 * @example
 * ```ts
 * const adapter = new ClaudeAdapter()
 *
 * adapter.on("event", (event) => {
 *   if (event.type === "message") {
 *     console.log("Claude says:", event.content)
 *   }
 * })
 *
 * await adapter.start({ cwd: "/project", systemPrompt: "You are helpful." })
 * adapter.send({ type: "user_message", content: "Hello!" })
 * ```
 */
export class ClaudeAdapter extends AgentAdapter {
  private process: ChildProcess | null = null
  private buffer = ""
  private currentMessageContent = ""
  private pendingToolUses = new Map<string, { tool: string; input: Record<string, unknown> }>()
  private options: {
    command: string
    spawn: SpawnFn
  }

  constructor(options: ClaudeAdapterOptions = {}) {
    super()
    this.options = {
      command: options.command ?? "claude",
      spawn: options.spawn ?? spawn,
    }
  }

  /**
   * Get information about this adapter.
   */
  getInfo(): AgentInfo {
    return {
      id: "claude",
      name: "Claude",
      description: "Anthropic Claude via CLI",
      features: {
        streaming: true,
        tools: true,
        pauseResume: false, // Claude CLI doesn't support pause/resume in this mode
        systemPrompt: true,
      },
    }
  }

  /**
   * Check if Claude CLI is available.
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
   * Start the Claude agent.
   *
   * Spawns the Claude CLI with streaming JSON output.
   */
  async start(options?: AgentStartOptions): Promise<void> {
    if (this.process) {
      throw new Error("Claude adapter is already running")
    }

    this.setStatus("starting")
    this.buffer = ""
    this.currentMessageContent = ""
    this.pendingToolUses.clear()

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

        // Handle stdout - parse streaming JSON
        this.process.stdout?.on("data", (data: Buffer) => {
          this.handleStdout(data)
        })

        // Handle stderr
        this.process.stderr?.on("data", (data: Buffer) => {
          const message = data.toString().trim()
          if (message) {
            // Log but don't fail - stderr often has warnings
            console.error("[claude-adapter] stderr:", message)
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
   * Send a message to Claude.
   */
  send(message: AgentMessage): void {
    if (!this.process?.stdin?.writable) {
      throw new Error("Claude adapter is not running or stdin is not writable")
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
   * Stop the Claude agent.
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
    const args: string[] = ["--verbose", "--output-format", "stream-json"]

    if (options?.model) {
      args.push("--model", options.model)
    }

    if (options?.systemPrompt) {
      args.push("--system-prompt", options.systemPrompt)
    }

    if (options?.maxIterations !== undefined) {
      args.push("--max-turns", String(options.maxIterations))
    }

    // Add any additional CLI arguments from options
    if (options?.allowedTools && Array.isArray(options.allowedTools)) {
      args.push("--tools", (options.allowedTools as string[]).join(","))
    }

    return args
  }

  /**
   * Handle stdout data, parsing streaming JSON.
   */
  private handleStdout(data: Buffer): void {
    this.buffer += data.toString()

    // Process complete lines (stream-json outputs newline-delimited JSON)
    let newlineIndex: number
    while ((newlineIndex = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, newlineIndex).trim()
      this.buffer = this.buffer.slice(newlineIndex + 1)

      if (line) {
        this.parseStreamLine(line)
      }
    }
  }

  /**
   * Parse a streaming JSON line from Claude CLI and emit normalized events.
   */
  private parseStreamLine(line: string): void {
    try {
      const nativeEvent = JSON.parse(line) as ClaudeNativeEvent
      this.translateEvent(nativeEvent)
    } catch {
      // Not valid JSON - ignore
    }
  }

  /**
   * Translate a native Claude CLI event to normalized AgentEvent(s).
   */
  private translateEvent(nativeEvent: ClaudeNativeEvent): void {
    const timestamp = this.now()

    switch (nativeEvent.type) {
      case "assistant": {
        // Assistant message with content blocks
        const message = nativeEvent.message as {
          content?: Array<{
            type: string
            text?: string
            id?: string
            name?: string
            input?: unknown
          }>
        }
        if (message?.content) {
          for (const block of message.content) {
            if (block.type === "text" && block.text) {
              this.currentMessageContent = block.text
              const event: AgentMessageEvent = {
                type: "message",
                timestamp,
                content: block.text,
                isPartial: false,
              }
              this.emit("event", event)
            } else if (block.type === "tool_use" && block.id && block.name) {
              const input = (block.input as Record<string, unknown>) ?? {}
              this.pendingToolUses.set(block.id, { tool: block.name, input })
              const event: AgentToolUseEvent = {
                type: "tool_use",
                timestamp,
                toolUseId: block.id,
                tool: block.name,
                input,
              }
              this.emit("event", event)
            }
          }
        }
        break
      }

      case "content_block_start": {
        // Start of a new content block
        const contentBlock = nativeEvent.content_block as {
          type?: string
          id?: string
          name?: string
          text?: string
        }
        if (contentBlock?.type === "tool_use" && contentBlock.id && contentBlock.name) {
          this.pendingToolUses.set(contentBlock.id, { tool: contentBlock.name, input: {} })
        }
        break
      }

      case "content_block_delta": {
        // Streaming delta for a content block
        const delta = nativeEvent.delta as { type?: string; text?: string; partial_json?: string }

        if (delta?.type === "text_delta" && delta.text) {
          this.currentMessageContent += delta.text
          const event: AgentMessageEvent = {
            type: "message",
            timestamp,
            content: delta.text,
            isPartial: true,
          }
          this.emit("event", event)
        } else if (delta?.type === "input_json_delta" && delta.partial_json !== undefined) {
          // Tool input being streamed - we'll get the full input later
        }
        break
      }

      case "content_block_stop": {
        // Content block finished - if it was a message, emit complete message
        break
      }

      case "tool_use": {
        // Tool use event (alternative format)
        const toolUseId = nativeEvent.id as string
        const tool = nativeEvent.name as string
        const input = (nativeEvent.input as Record<string, unknown>) ?? {}

        if (toolUseId && tool) {
          this.pendingToolUses.set(toolUseId, { tool, input })
          const event: AgentToolUseEvent = {
            type: "tool_use",
            timestamp,
            toolUseId,
            tool,
            input,
          }
          this.emit("event", event)
        }
        break
      }

      case "tool_result": {
        // Tool result
        const toolUseId = nativeEvent.tool_use_id as string
        const output = nativeEvent.content as string | undefined
        const isError = (nativeEvent.is_error as boolean) ?? false
        const error = isError ? (output ?? "Unknown error") : undefined

        const event: AgentToolResultEvent = {
          type: "tool_result",
          timestamp,
          toolUseId,
          output: isError ? undefined : output,
          error,
          isError,
        }
        this.emit("event", event)
        this.pendingToolUses.delete(toolUseId)
        break
      }

      case "result": {
        // Final result
        const content =
          typeof nativeEvent.result === "string" ? nativeEvent.result : this.currentMessageContent

        // Extract usage if available
        const usage = nativeEvent.usage as
          | { input_tokens?: number; output_tokens?: number }
          | undefined

        const event: AgentResultEvent = {
          type: "result",
          timestamp,
          content,
          usage:
            usage ?
              {
                inputTokens: usage.input_tokens,
                outputTokens: usage.output_tokens,
                totalTokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
              }
            : undefined,
        }
        this.emit("event", event)
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
          fatal: true, // Assume errors from Claude CLI are fatal
        }
        this.emit("event", event)
        this.emit("error", new Error(message))
        break
      }

      case "message_start":
      case "message_delta":
      case "message_stop":
        // These are streaming lifecycle events - we handle the actual content elsewhere
        break

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
