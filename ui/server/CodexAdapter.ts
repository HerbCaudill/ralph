/**
 * CodexAdapter - AgentAdapter implementation for OpenAI Codex SDK
 *
 * Uses the Codex SDK to stream thread events and translates them into
 * normalized AgentEvent types.
 */

import { Codex, type CodexOptions, type Thread, type ThreadEvent } from "@openai/codex-sdk"
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

export type CodexFactory = (options?: CodexOptions) => Codex

export interface CodexAdapterOptions {
  /** Codex instance override (for testing) */
  codex?: Codex
  /** Custom Codex factory (for testing) */
  createCodex?: CodexFactory
  /** Override API key for Codex SDK */
  apiKey?: string
  /** Override base URL for Codex SDK */
  baseUrl?: string
  /** Override Codex binary path */
  codexPathOverride?: string
}

type CodexNativeEvent = ThreadEvent
type CodexItem = ThreadEvent extends { item: infer Item } ? Item : never

// CodexAdapter

/**
 * AgentAdapter implementation for the Codex SDK.
 *
 * Uses the Codex SDK to stream thread events and translates
 * the native events to normalized AgentEvent types.
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
  private accumulatedMessage = ""
  private codex: Codex | null = null
  private thread: Thread | null = null
  private inFlight: Promise<void> | null = null
  private abortController: AbortController | null = null
  private options: Required<Pick<CodexAdapterOptions, "createCodex">> &
    Omit<CodexAdapterOptions, "createCodex">

  constructor(options: CodexAdapterOptions = {}) {
    super()
    this.options = {
      createCodex: options.createCodex ?? (opts => new Codex(opts)),
      ...options,
    }
  }

  /**
   * Get information about this adapter.
   */
  getInfo(): AgentInfo {
    return {
      id: "codex",
      name: "Codex",
      description: "OpenAI Codex via SDK",
      features: {
        streaming: true,
        tools: true,
        pauseResume: false, // Codex doesn't support pause/resume per thread
        systemPrompt: false, // Codex doesn't support custom system prompts
      },
    }
  }

  /**
   * Check if Codex SDK is available (API key present).
   */
  async isAvailable(): Promise<boolean> {
    return Boolean(this.options.apiKey ?? process.env.OPENAI_API_KEY ?? process.env.CODEX_API_KEY)
  }

  /**
   * Start the Codex agent and prepare a thread.
   */
  async start(options?: AgentStartOptions): Promise<void> {
    if (this.thread) {
      throw new Error("Codex adapter is already running")
    }

    this.setStatus("starting")
    this.accumulatedMessage = ""

    const codexOptions = this.buildCodexOptions(options)
    this.codex = this.options.codex ?? this.options.createCodex(codexOptions)
    this.thread = this.codex.startThread(this.buildThreadOptions(options))

    this.setStatus("running")
  }

  /**
   * Send a message to Codex.
   */
  send(message: AgentMessage): void {
    if (!this.thread) {
      throw new Error("Codex adapter is not running")
    }

    if (message.type === "user_message" && message.content) {
      if (this.inFlight) {
        throw new Error("Codex adapter already has a request in flight")
      }

      this.inFlight = this.runTurn(message.content)
    } else if (message.type === "control") {
      // Handle control commands
      switch (message.command) {
        case "stop":
          void this.stop()
          break
        // pause/resume not supported
      }
    }
  }

  /**
   * Stop the Codex agent.
   */
  async stop(force?: boolean): Promise<void> {
    if (!this.thread) {
      return
    }

    this.setStatus("stopping")

    if (this.abortController) {
      this.abortController.abort()
    }

    if (this.inFlight) {
      await this.inFlight.catch(() => {})
    }

    this.thread = null
    this.codex = null
    this.inFlight = null
    this.abortController = null

    if (force) {
      this.emit("exit", { code: 1, signal: "SIGKILL" })
    } else {
      this.emit("exit", { code: 0 })
    }

    this.setStatus("stopped")
  }

  /**
   * Build Codex SDK options from start options.
   */
  private buildCodexOptions(options?: AgentStartOptions): CodexOptions {
    return {
      apiKey: this.options.apiKey,
      baseUrl: this.options.baseUrl,
      codexPathOverride: this.options.codexPathOverride,
      env: { ...process.env, ...options?.env },
    }
  }

  /**
   * Build thread options from start options.
   */
  private buildThreadOptions(options?: AgentStartOptions): {
    model?: string
    workingDirectory?: string
    skipGitRepoCheck: boolean
    sandboxMode: "danger-full-access"
    approvalPolicy: "never"
    networkAccessEnabled: boolean
  } {
    return {
      model: options?.model,
      workingDirectory: options?.cwd,
      skipGitRepoCheck: true,
      sandboxMode: "danger-full-access",
      approvalPolicy: "never",
      networkAccessEnabled: true,
    }
  }

  /**
   * Run a single turn with the Codex SDK.
   */
  private async runTurn(prompt: string): Promise<void> {
    if (!this.thread) {
      throw new Error("Codex adapter is not running")
    }

    this.abortController = new AbortController()

    try {
      const { events } = await this.thread.runStreamed(prompt, {
        signal: this.abortController.signal,
      })

      for await (const event of events) {
        this.translateEvent(event as CodexNativeEvent)
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Codex run failed")
      this.handleProcessError(error)
    } finally {
      this.abortController = null
      this.inFlight = null
    }
  }

  /**
   * Translate a native Codex SDK event to normalized AgentEvent(s).
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
        const usage = "usage" in nativeEvent ? nativeEvent.usage : undefined

        if (this.accumulatedMessage) {
          const event: AgentResultEvent = {
            type: "result",
            timestamp,
            content: this.accumulatedMessage,
            usage:
              usage ?
                {
                  inputTokens: (usage?.input_tokens ?? 0) + (usage?.cached_input_tokens ?? 0),
                  outputTokens: usage?.output_tokens ?? 0,
                  totalTokens:
                    (usage?.input_tokens ?? 0) +
                    (usage?.cached_input_tokens ?? 0) +
                    (usage?.output_tokens ?? 0),
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

      case "turn.failed": {
        const errorMessage =
          "error" in nativeEvent && nativeEvent.error?.message ?
            nativeEvent.error.message
          : "Codex turn failed"

        const event: AgentErrorEvent = {
          type: "error",
          timestamp,
          message: errorMessage,
          fatal: true,
        }
        this.emit("event", event)
        this.emit("error", new Error(errorMessage))
        break
      }

      case "error": {
        // Error event
        const message =
          typeof nativeEvent.message === "string" ? nativeEvent.message : "Unknown error"

        const event: AgentErrorEvent = {
          type: "error",
          timestamp,
          message,
          code: nativeEvent.code as string | undefined,
          fatal: true, // Assume errors from Codex SDK are fatal
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
    this.thread = null
    this.codex = null
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
}
