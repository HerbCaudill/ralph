import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk"
import {
  AgentAdapter,
  type AgentInfo,
  type AgentMessage,
  type AgentStartOptions,
  type ConversationContext,
  type ConversationMessage,
} from "./agentTypes.js"
import type {
  AgentMessageEvent,
  AgentThinkingEvent,
  AgentToolUseEvent,
  AgentToolResultEvent,
  AgentResultEvent,
  AgentErrorEvent,
} from "./agentTypes.js"
import { isRetryableError } from "./lib/isRetryableError.js"
import { calculateBackoffDelay } from "./lib/calculateBackoffDelay.js"

export type QueryFn = typeof query

/** Retry configuration for API connection errors */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 5) */
  maxRetries: number
  /** Initial delay between retries in ms (default: 1000) */
  initialDelayMs: number
  /** Maximum delay between retries in ms (default: 30000) */
  maxDelayMs: number
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier: number
}

/** Default retry configuration */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
}

/** Default thinking budget in tokens. Set to 0 to disable extended thinking. */
const DEFAULT_MAX_THINKING_TOKENS = 0

/**
 * Build the working directory context string for system prompts.
 * Provides explicit instructions to prevent Claude from constructing incorrect absolute paths.
 */
export function buildCwdContext(cwd: string): string {
  return [
    `## Environment`,
    ``,
    `Working directory: ${cwd}`,
    ``,
    `IMPORTANT: All file paths MUST be relative to the working directory above, or absolute paths starting with exactly \`${cwd}/\`.`,
    `Never construct absolute paths by guessing usernames, directory structures, or paths from code snippets.`,
    `If a file path fails, retry using a path relative to the working directory.`,
    ``,
  ].join("\n")
}

export interface ClaudeAdapterOptions {
  /** Override the SDK query function (for testing) */
  queryFn?: QueryFn
  /** Override API key (optional) */
  apiKey?: string
  /** Retry configuration for connection errors */
  retryConfig?: Partial<RetryConfig>
  /**
   * Maximum number of tokens for extended thinking.
   * When set to a positive number, enables extended thinking with the specified token budget.
   * Can also be set via the CLAUDE_MAX_THINKING_TOKENS environment variable.
   * Default: 0 (extended thinking disabled)
   */
  maxThinkingTokens?: number
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
  private retryConfig: RetryConfig
  private maxThinkingTokens: number
  private options: Required<Pick<ClaudeAdapterOptions, "queryFn">> &
    Omit<ClaudeAdapterOptions, "queryFn">

  // Conversation context tracking
  private conversationMessages: ConversationMessage[] = []
  private currentAssistantMessage: ConversationMessage | null = null
  private lastPrompt: string | undefined
  private totalUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }

  // Session tracking for retry/resume
  private currentSessionId: string | undefined

  constructor(options: ClaudeAdapterOptions = {}) {
    super()
    this.options = {
      queryFn: options.queryFn ?? query,
      ...options,
    }
    this.retryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      ...options.retryConfig,
    }
    // Resolve thinking tokens: explicit option > env var > default
    const envThinkingTokens = process.env.CLAUDE_MAX_THINKING_TOKENS
    this.maxThinkingTokens =
      options.maxThinkingTokens ??
      (envThinkingTokens ? parseInt(envThinkingTokens, 10) : DEFAULT_MAX_THINKING_TOKENS)
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
    return Boolean(this.options.apiKey ?? process.env.ANTHROPIC_API_KEY)
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
    // Reset conversation context on fresh start
    this.conversationMessages = []
    this.currentAssistantMessage = null
    this.lastPrompt = undefined
    this.totalUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
    // Reset session tracking
    this.currentSessionId = undefined
    this.startOptions = options ?? {}
    this.setStatus("running")
  }

  /**
   * Get the current conversation context for saving/restoring.
   * Returns a serializable snapshot of the conversation state.
   */
  getConversationContext(): ConversationContext {
    return {
      messages: [...this.conversationMessages],
      lastPrompt: this.lastPrompt,
      usage: { ...this.totalUsage },
      timestamp: this.now(),
    }
  }

  /**
   * Set the conversation context from a previously saved state.
   * Use this to restore context after a reconnection.
   * Note: This does not replay the conversation; it only sets the tracked state.
   */
  setConversationContext(context: ConversationContext): void {
    this.conversationMessages = [...context.messages]
    this.lastPrompt = context.lastPrompt
    this.totalUsage = { ...context.usage }
  }

  /**
   * Clear the conversation context, starting fresh.
   */
  clearConversationContext(): void {
    this.conversationMessages = []
    this.currentAssistantMessage = null
    this.lastPrompt = undefined
    this.totalUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
  }

  /**
   * Get the current session ID if one has been established.
   * This is the SDK session ID that can be used for resuming interrupted sessions.
   */
  getSessionId(): string | undefined {
    return this.currentSessionId
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

      // Track user message in conversation context
      this.lastPrompt = message.content
      this.conversationMessages.push({
        role: "user",
        content: message.content,
        timestamp: this.now(),
      })

      // Prepare to track the assistant's response
      this.currentAssistantMessage = {
        role: "assistant",
        content: "",
        timestamp: this.now(),
        toolUses: [],
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

    const { maxRetries, initialDelayMs, maxDelayMs, backoffMultiplier } = this.retryConfig
    let attempt = 0
    let lastError: Error | null = null

    // Build system prompt with working directory context
    let systemPrompt = options.systemPrompt
    if (options.cwd) {
      const cwdContext = buildCwdContext(options.cwd)
      systemPrompt = systemPrompt ? cwdContext + systemPrompt : cwdContext.trim()
    }

    while (attempt <= maxRetries) {
      this.abortController = new AbortController()

      // On retry attempts with an existing session, use resume to continue from where we left off
      const isRetry = attempt > 0
      const sessionToResume = isRetry && this.currentSessionId ? this.currentSessionId : undefined

      try {
        // If resuming, emit a status event to inform the UI
        if (sessionToResume) {
          const resumingEvent: AgentErrorEvent = {
            type: "error",
            timestamp: this.now(),
            message: `Resuming session ${sessionToResume} from last checkpoint...`,
            code: "RESUMING",
            fatal: false,
          }
          this.emit("event", resumingEvent)
        }

        for await (const message of this.options.queryFn({
          prompt: sessionToResume ? "" : prompt, // Empty prompt when resuming - SDK continues from last state
          options: {
            model: options.model,
            cwd: options.cwd,
            ...(options.env || this.options.apiKey ?
              {
                env: {
                  ...process.env,
                  ...options.env,
                  ...(this.options.apiKey ? { ANTHROPIC_API_KEY: this.options.apiKey } : {}),
                },
              }
            : {}),
            systemPrompt,
            tools:
              Array.isArray(options.allowedTools) ? (options.allowedTools as string[]) : undefined,
            permissionMode: "bypassPermissions",
            allowDangerouslySkipPermissions: true,
            includePartialMessages: true,
            maxTurns: options.maxSessions ?? 1,
            abortController: this.abortController,
            // Resume from the session if we have one from a previous attempt
            resume: sessionToResume,
            // Enable extended thinking with the configured token budget (0 = disabled)
            ...(this.maxThinkingTokens > 0 && { maxThinkingTokens: this.maxThinkingTokens }),
          },
        })) {
          this.handleSDKMessage(message)
        }
        // Success - reset inFlight and exit the retry loop
        this.inFlight = null
        return
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Claude query failed")
        lastError = error

        // Check if we should abort (request was cancelled)
        if (this.abortController?.signal.aborted) {
          // Don't retry if manually aborted
          break
        }

        // Check if this error is retryable
        if (!isRetryableError(error) || attempt >= maxRetries) {
          // Not retryable or max retries reached
          break
        }

        // Calculate backoff delay
        const delayMs = calculateBackoffDelay(
          attempt,
          initialDelayMs,
          maxDelayMs,
          backoffMultiplier,
        )

        // Emit a non-fatal error event to inform the UI about the retry
        const retryEvent: AgentErrorEvent = {
          type: "error",
          timestamp: this.now(),
          message: `Connection error: ${error.message}. Retrying in ${Math.round(delayMs / 1000)} seconds... (attempt ${attempt + 1}/${maxRetries})`,
          code: "RETRY",
          fatal: false, // Non-fatal so the UI shows it as a warning, not a failure
        }
        this.emit("event", retryEvent)

        // Wait before retrying
        await this.sleep(delayMs)
        attempt++
      } finally {
        this.abortController = null
      }
    }

    // All retries exhausted or non-retryable error
    if (lastError) {
      this.handleProcessError(lastError)
    }
    this.inFlight = null
  }

  /**
   * Sleep for a specified duration (allows mocking in tests).
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Handle SDK message from query() and emit appropriate events.
   */
  private handleSDKMessage(message: SDKMessage): void {
    // Capture session ID from any message that has it
    if ("session_id" in message && message.session_id) {
      this.currentSessionId = message.session_id
    }

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

          // Finalize and save the current assistant message to conversation context
          if (this.currentAssistantMessage) {
            if (message.result) {
              this.currentAssistantMessage.content = message.result
            }
            this.conversationMessages.push(this.currentAssistantMessage)
            this.currentAssistantMessage = null
          }

          // Update total usage
          if (usage) {
            this.totalUsage.inputTokens += usage.input_tokens ?? 0
            this.totalUsage.outputTokens += usage.output_tokens ?? 0
            this.totalUsage.totalTokens = this.totalUsage.inputTokens + this.totalUsage.outputTokens
          }

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
            thinking?: string
            id?: string
            name?: string
            input?: unknown
          }>
        }
        if (message?.content) {
          for (const block of message.content) {
            if (block.type === "thinking" && block.thinking) {
              const event: AgentThinkingEvent = {
                type: "thinking",
                timestamp,
                content: block.thinking,
                isPartial: false,
              }
              this.emit("event", event)
            } else if (block.type === "text" && block.text) {
              this.currentMessageContent = block.text
              // Track in conversation context
              if (this.currentAssistantMessage) {
                this.currentAssistantMessage.content = block.text
              }
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
              // Track in conversation context
              if (this.currentAssistantMessage) {
                this.currentAssistantMessage.toolUses = this.currentAssistantMessage.toolUses ?? []
                this.currentAssistantMessage.toolUses.push({
                  id: block.id,
                  name: block.name,
                  input,
                })
              }
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
        const delta = nativeEvent.delta as {
          type?: string
          text?: string
          thinking?: string
          partial_json?: string
        }

        if (delta?.type === "thinking_delta" && delta.thinking) {
          const event: AgentThinkingEvent = {
            type: "thinking",
            timestamp,
            content: delta.thinking,
            isPartial: true,
          }
          this.emit("event", event)
        } else if (delta?.type === "text_delta" && delta.text) {
          this.currentMessageContent += delta.text
          // Track in conversation context (accumulate streaming text)
          if (this.currentAssistantMessage) {
            this.currentAssistantMessage.content += delta.text
          }
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
          // Track in conversation context
          if (this.currentAssistantMessage) {
            this.currentAssistantMessage.toolUses = this.currentAssistantMessage.toolUses ?? []
            this.currentAssistantMessage.toolUses.push({
              id: toolUseId,
              name: tool,
              input,
            })
          }
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

        // Track in conversation context
        if (this.currentAssistantMessage?.toolUses) {
          const toolUse = this.currentAssistantMessage.toolUses.find(t => t.id === toolUseId)
          if (toolUse) {
            toolUse.result = {
              output: isError ? undefined : output,
              error,
              isError,
            }
          }
        }

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

        // Finalize and save the current assistant message to conversation context
        if (this.currentAssistantMessage) {
          // Use the final content if available
          if (typeof nativeEvent.result === "string") {
            this.currentAssistantMessage.content = nativeEvent.result
          }
          this.conversationMessages.push(this.currentAssistantMessage)
          this.currentAssistantMessage = null
        }

        // Update total usage
        if (usage) {
          this.totalUsage.inputTokens += usage.input_tokens ?? 0
          this.totalUsage.outputTokens += usage.output_tokens ?? 0
          this.totalUsage.totalTokens = this.totalUsage.inputTokens + this.totalUsage.outputTokens
        }

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
