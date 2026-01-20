/**
 * ClaudeAdapter - AgentAdapter implementation for Claude Agent SDK
 *
 * Uses the Claude Agent SDK and translates its streaming events into
 * normalized AgentEvent types.
 */

import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk"
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

export type QueryFn = typeof query

export interface ClaudeAdapterOptions {
  /** Override the SDK query function (for testing) */
  queryFn?: QueryFn
  /** Override API key (optional) */
  apiKey?: string
}

/**
 * Claude SDK native event types from stream-json output.
 * These are the raw events before normalization.
 */
interface ClaudeNativeEvent {
  type: string
  timestamp?: number
  [key: string]: unknown
}

// ClaudeAdapter

/**
 * AgentAdapter implementation for the Claude Agent SDK.
 *
 * Uses the SDK `query()` stream and translates
 * native events to normalized AgentEvent types.
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
  private currentMessageContent = ""
  private pendingToolUses = new Map<string, { tool: string; input: Record<string, unknown> }>()
  private inFlight: Promise<void> | null = null
  private abortController: AbortController | null = null
  private startOptions: AgentStartOptions | undefined
  private options: Required<Pick<ClaudeAdapterOptions, "queryFn">> &
    Omit<ClaudeAdapterOptions, "queryFn">

  constructor(options: ClaudeAdapterOptions = {}) {
    super()
    this.options = {
      queryFn: options.queryFn ?? query,
      ...options,
    }
  }

  /**
   * Get information about this adapter.
   */
  getInfo(): AgentInfo {
    return {
      id: "claude",
      name: "Claude",
      description: "Anthropic Claude via SDK",
      features: {
        streaming: true,
        tools: true,
        pauseResume: false, // Claude SDK doesn't support pause/resume in this mode
        systemPrompt: true,
      },
    }
  }

  /**
   * Check if Claude SDK is available (API key present).
   */
  async isAvailable(): Promise<boolean> {
    return Boolean(
      this.options.apiKey ??
      process.env.ANTHROPIC_API_KEY ??
      process.env.CLAUDE_API_KEY ??
      process.env.CLAUDE_CODE_API_KEY,
    )
  }

  /**
   * Start the Claude agent.
   */
  async start(options?: AgentStartOptions): Promise<void> {
    if (this.startOptions) {
      throw new Error("Claude adapter is already running")
    }

    this.setStatus("starting")
    this.currentMessageContent = ""
    this.pendingToolUses.clear()
    this.startOptions = options ?? {}
    this.setStatus("running")
  }

  /**
   * Send a message to Claude.
   */
  send(message: AgentMessage): void {
    if (!this.startOptions) {
      throw new Error("Claude adapter is not running")
    }

    if (message.type === "user_message" && message.content) {
      if (this.inFlight) {
        throw new Error("Claude adapter already has a request in flight")
      }

      this.inFlight = this.runQuery(message.content)
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
   * Stop the Claude agent.
   */
  async stop(force?: boolean): Promise<void> {
    if (!this.startOptions) {
      return
    }

    this.setStatus("stopping")

    if (this.abortController) {
      this.abortController.abort()
    }

    if (this.inFlight) {
      await this.inFlight.catch(() => {})
    }

    this.abortController = null
    this.inFlight = null
    this.startOptions = undefined

    if (force) {
      this.emit("exit", { code: 1, signal: "SIGKILL" })
    } else {
      this.emit("exit", { code: 0 })
    }

    this.setStatus("stopped")
  }

  private async runQuery(prompt: string): Promise<void> {
    const options = this.startOptions
    if (!options) {
      throw new Error("Claude adapter is not running")
    }

    this.abortController = new AbortController()

    try {
      for await (const message of this.options.queryFn({
        prompt,
        options: {
          model: options.model,
          cwd: options.cwd,
          env: {
            ...options.env,
            ...(this.options.apiKey ? { ANTHROPIC_API_KEY: this.options.apiKey } : {}),
          },
          systemPrompt: options.systemPrompt,
          tools:
            Array.isArray(options.allowedTools) ? (options.allowedTools as string[]) : undefined,
          permissionMode: "bypassPermissions",
          allowDangerouslySkipPermissions: true,
          includePartialMessages: true,
          maxTurns: options.maxIterations ?? 1,
          abortController: this.abortController,
        },
      })) {
        this.handleSDKMessage(message)
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Claude query failed")
      this.handleProcessError(error)
    } finally {
      this.abortController = null
      this.inFlight = null
    }
  }

  /**
   * Handle SDK message from query() and emit appropriate events.
   */
  private handleSDKMessage(message: SDKMessage): void {
    switch (message.type) {
      case "assistant":
        this.translateEvent({ type: "assistant", message: message.message })
        break
      case "stream_event":
        this.translateEvent(message.event as ClaudeNativeEvent)
        break
      case "result":
        if (message.subtype === "success") {
          const usage = message.usage
          const event: AgentResultEvent = {
            type: "result",
            timestamp: this.now(),
            content: message.result,
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
        } else {
          const event: AgentErrorEvent = {
            type: "error",
            timestamp: this.now(),
            message: `Query failed: ${message.subtype}`,
            fatal: true,
          }
          this.emit("event", event)
          this.emit("error", new Error(event.message))
        }
        break
      default:
        break
    }
  }

  /**
   * Translate a native Claude SDK event to normalized AgentEvent(s).
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
          fatal: true, // Assume errors from Claude SDK are fatal
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
