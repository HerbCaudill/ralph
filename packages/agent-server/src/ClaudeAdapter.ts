import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk"
import { execSync } from "node:child_process"
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
import { loadClaudeMdSync } from "./lib/loadClaudeMd.js"

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
 * Parse a version string from `claude --version` output.
 * Expected format: "2.1.29 (Claude Code)" -> "2.1.29"
 */
export function parseCliVersionOutput(output: string): string | undefined {
  const match = output.trim().match(/^([\d.]+)/)
  return match ? match[1] : undefined
}

/** Read the Claude CLI version by running `claude --version`. */
function getClaudeCliVersion(): string | undefined {
  try {
    const output = execSync("claude --version", { timeout: 5000 }).toString().trim()
    return parseCliVersionOutput(output)
  } catch {
    return undefined
  }
}

// Cache the CLI version at module load time to avoid repeated exec calls
const cachedCliVersion = getClaudeCliVersion()

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
   * Default model to use for queries (e.g., "claude-haiku-4-5-20251001", "claude-sonnet-4-20250514").
   * Can also be set via the CLAUDE_MODEL environment variable.
   * Can be overridden per-message via AgentStartOptions.model.
   */
  model?: string
  /**
   * Maximum number of tokens for extended thinking.
   * When set to a positive number, enables extended thinking with the specified token budget.
   * Can also be set via the CLAUDE_MAX_THINKING_TOKENS environment variable.
   * Default: 0 (extended thinking disabled)
   */
  maxThinkingTokens?: number
  /**
   * Whether to load CLAUDE.md files and prepend their content to the system prompt.
   * Loads from: ~/.claude/CLAUDE.md (user global) and {cwd}/CLAUDE.md (workspace).
   * Order: global first, then workspace, then caller-provided systemPrompt.
   * Default: true (for consistency with Claude CLI behavior)
   */
  loadClaudeMd?: boolean
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
  private currentQuery: (AsyncIterable<SDKMessage> & { interrupt?: () => void }) | null = null
  private startOptions: AgentStartOptions | undefined
  private retryConfig: RetryConfig
  private maxThinkingTokens: number
  private defaultModel: string | undefined
  private options: Required<Pick<ClaudeAdapterOptions, "queryFn">> &
    Omit<ClaudeAdapterOptions, "queryFn">

  // Conversation context tracking
  private conversationMessages: ConversationMessage[] = []
  private currentAssistantMessage: ConversationMessage | null = null
  private lastPrompt: string | undefined
  private totalUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }

  /** Usage accumulated from streaming lifecycle events (message_start, message_delta). */
  private streamingUsage = { inputTokens: 0, outputTokens: 0 }

  /** Per-turn usage tracking (reset at each message_stop). */
  private turnUsage = { inputTokens: 0, outputTokens: 0 }

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
    // Resolve default model: explicit option > env var > undefined (SDK default)
    this.defaultModel = options.model ?? process.env.CLAUDE_MODEL ?? undefined
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
      version: cachedCliVersion,
      model: this.defaultModel,
      features: {
        streaming: true,
        tools: true,
        pauseResume: true, // Supports interrupt via query.interrupt()
        systemPrompt: true,
      },
    }
  }

  /** Check if the Claude CLI is installed and available. */
  async isAvailable(): Promise<boolean> {
    return cachedCliVersion !== undefined
  }

  /**
   * Start the Claude agent.
   */
  async start(options?: AgentStartOptions): Promise<void> {
    if (this.startOptions) {
      // Allow restarting if the adapter is idle (between messages)
      if (!this.inFlight) {
        // Adapter was previously started but is idle; allow re-initialization
        this.startOptions = options ?? {}
        this.setStatus("running")
        return
      }
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
        case "interrupt":
          void this.interrupt()
          break
      }
    }
  }

  /**
   * Interrupt the current query using the SDK's interrupt() method.
   * This allows the user to stop the current response mid-stream.
   */
  async interrupt(): Promise<void> {
    if (!this.currentQuery) {
      return
    }

    // Emit interrupted event to inform the UI
    const interruptedEvent = {
      type: "interrupted" as const,
      timestamp: this.now(),
      message: "Interrupted · What should Ralph do instead?",
    }
    this.emit("event", interruptedEvent)

    // Call the SDK's interrupt method if available
    if (this.currentQuery.interrupt) {
      this.currentQuery.interrupt()
    }

    // Also abort via AbortController as a fallback
    if (this.abortController) {
      this.abortController.abort()
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

    // Build system prompt with CLAUDE.md content and working directory context
    // Order: CLAUDE.md content (global then workspace) → cwd context → caller-provided systemPrompt
    const promptParts: string[] = []

    // Load CLAUDE.md files if enabled (default: true)
    const shouldLoadClaudeMd = this.options.loadClaudeMd !== false
    if (shouldLoadClaudeMd) {
      const claudeMdContent = loadClaudeMdSync({ cwd: options.cwd })
      if (claudeMdContent) {
        promptParts.push(claudeMdContent)
      }
    }

    // Add working directory context
    if (options.cwd) {
      promptParts.push(buildCwdContext(options.cwd).trim())
    }

    // Add caller-provided system prompt
    if (options.systemPrompt) {
      promptParts.push(options.systemPrompt)
    }

    const systemPrompt = promptParts.length > 0 ? promptParts.join("\n\n") : undefined

    // Reset usage tracking for this query
    this.streamingUsage = { inputTokens: 0, outputTokens: 0 }
    this.turnUsage = { inputTokens: 0, outputTokens: 0 }

    while (attempt <= maxRetries) {
      this.abortController = new AbortController()

      // Resume from existing session if we have one (for multi-turn conversations or retries)
      const isRetry = attempt > 0
      const sessionToResume = this.currentSessionId ?? undefined

      try {
        // If retrying with an existing session, emit a status event to inform the UI
        if (isRetry && sessionToResume) {
          const resumingEvent: AgentErrorEvent = {
            type: "error",
            timestamp: this.now(),
            message: `Resuming session ${sessionToResume} from last checkpoint...`,
            code: "RESUMING",
            fatal: false,
          }
          this.emit("event", resumingEvent)
        }

        // Store the query stream so we can call interrupt() on it
        this.currentQuery = this.options.queryFn({
          prompt: isRetry && sessionToResume ? "" : prompt, // Empty prompt only on retry - SDK continues from last state
          options: {
            model: options.model ?? this.defaultModel,
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
            hooks: {}, // Disable hooks to avoid tool use concurrency errors
            includePartialMessages: true,
            maxTurns: options.maxSessions ?? 100,
            abortController: this.abortController,
            // Resume from existing session for multi-turn conversation or retry
            resume: sessionToResume,
            // Enable extended thinking with the configured token budget (0 = disabled)
            ...(this.maxThinkingTokens > 0 && { maxThinkingTokens: this.maxThinkingTokens }),
          },
        }) as AsyncIterable<SDKMessage> & { interrupt?: () => void }

        for await (const message of this.currentQuery) {
          this.handleSDKMessage(message)
        }
        // Success - signal idle so ChatSessionManager can resolve
        this.setStatus("idle")
        this.inFlight = null
        this.currentQuery = null
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
        // Emit the structured assistant event for UI rendering (preserves message.content blocks)
        this.emit("event", {
          type: "assistant",
          timestamp: this.now(),
          message: message.message,
        })
        // Track conversation context and pending tool uses (without re-emitting events)
        this.trackAssistantMessage(
          message.message as {
            content?: Array<{
              type: string
              text?: string
              thinking?: string
              id?: string
              name?: string
              input?: unknown
            }>
          },
        )
        break
      case "user":
        // User message containing tool results
        this.handleUserMessage(
          message.message as {
            content?: Array<{
              type: string
              tool_use_id?: string
              content?: string
              is_error?: boolean
            }>
          },
        )
        break
      case "stream_event":
        this.translateEvent(message.event as ClaudeNativeEvent)
        break
      case "result":
        if (message.subtype === "success") {
          const sdkUsage = message.usage

          // Finalize and save the current assistant message to conversation context
          if (this.currentAssistantMessage) {
            if (message.result) {
              this.currentAssistantMessage.content = message.result
            }
            this.conversationMessages.push(this.currentAssistantMessage)
            this.currentAssistantMessage = null
          }

          // Usage is tracked via turn_usage events (emitted at each message_stop),
          // so the result event does not carry usage to avoid double-counting.
          // totalUsage is still updated for conversation context tracking.
          const hasStreamingUsage =
            this.streamingUsage.inputTokens > 0 || this.streamingUsage.outputTokens > 0
          const inputTokens =
            sdkUsage?.input_tokens ?? (hasStreamingUsage ? this.streamingUsage.inputTokens : 0)
          const outputTokens =
            sdkUsage?.output_tokens ?? (hasStreamingUsage ? this.streamingUsage.outputTokens : 0)

          if (sdkUsage || hasStreamingUsage) {
            this.totalUsage.inputTokens += inputTokens
            this.totalUsage.outputTokens += outputTokens
            this.totalUsage.totalTokens = this.totalUsage.inputTokens + this.totalUsage.outputTokens
          }

          const event: AgentResultEvent = {
            type: "result",
            timestamp: this.now(),
            content: message.result,
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
   * Handle SDK user message containing tool results.
   * Emits tool_result events for each tool result in the message.
   */
  private handleUserMessage(message: {
    content?: Array<{
      type: string
      tool_use_id?: string
      content?: string
      is_error?: boolean
    }>
  }): void {
    if (!message?.content) return

    const timestamp = this.now()

    for (const block of message.content) {
      if (block.type === "tool_result" && block.tool_use_id) {
        const toolUseId = block.tool_use_id
        const output = block.content
        const isError = block.is_error ?? false
        const error = isError ? (output ?? "Unknown error") : undefined

        // Update pending tool use with result
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
      }
    }
  }

  /**
   * Track assistant message content for conversation context and pending tool uses
   * without emitting individual events (the structured "assistant" event is emitted separately).
   */
  private trackAssistantMessage(message: {
    content?: Array<{
      type: string
      text?: string
      thinking?: string
      id?: string
      name?: string
      input?: unknown
    }>
  }): void {
    if (!message?.content) return
    for (const block of message.content) {
      if (block.type === "text" && block.text) {
        this.currentMessageContent = block.text
        if (this.currentAssistantMessage) {
          this.currentAssistantMessage.content = block.text
        }
      } else if (block.type === "tool_use" && block.id && block.name) {
        const input = (block.input as Record<string, unknown>) ?? {}
        this.pendingToolUses.set(block.id, { tool: block.name, input })
        if (this.currentAssistantMessage) {
          this.currentAssistantMessage.toolUses = this.currentAssistantMessage.toolUses ?? []
          // Deduplicate: only add if this tool_use ID hasn't been tracked yet
          const alreadyTracked = this.currentAssistantMessage.toolUses.some(t => t.id === block.id)
          if (!alreadyTracked) {
            this.currentAssistantMessage.toolUses.push({
              id: block.id,
              name: block.name,
              input,
            })
          }
        }
      }
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
              // Track in conversation context (deduplicate by tool_use ID)
              if (this.currentAssistantMessage) {
                this.currentAssistantMessage.toolUses = this.currentAssistantMessage.toolUses ?? []
                const alreadyTracked = this.currentAssistantMessage.toolUses.some(
                  t => t.id === block.id,
                )
                if (!alreadyTracked) {
                  this.currentAssistantMessage.toolUses.push({
                    id: block.id,
                    name: block.name,
                    input,
                  })
                }
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
          // Track in conversation context (deduplicate by tool_use ID)
          if (this.currentAssistantMessage) {
            this.currentAssistantMessage.toolUses = this.currentAssistantMessage.toolUses ?? []
            const alreadyTracked = this.currentAssistantMessage.toolUses.some(
              t => t.id === toolUseId,
            )
            if (!alreadyTracked) {
              this.currentAssistantMessage.toolUses.push({
                id: toolUseId,
                name: tool,
                input,
              })
            }
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
        const nativeUsage = nativeEvent.usage as
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

        // Usage is tracked via turn_usage events (emitted at each message_stop),
        // so the result event does not carry usage to avoid double-counting.
        // totalUsage is still updated for conversation context tracking.
        const hasStreamUsage =
          this.streamingUsage.inputTokens > 0 || this.streamingUsage.outputTokens > 0
        const inTokens =
          nativeUsage?.input_tokens ?? (hasStreamUsage ? this.streamingUsage.inputTokens : 0)
        const outTokens =
          nativeUsage?.output_tokens ?? (hasStreamUsage ? this.streamingUsage.outputTokens : 0)

        if (nativeUsage || hasStreamUsage) {
          this.totalUsage.inputTokens += inTokens
          this.totalUsage.outputTokens += outTokens
          this.totalUsage.totalTokens = this.totalUsage.inputTokens + this.totalUsage.outputTokens
        }

        const event: AgentResultEvent = {
          type: "result",
          timestamp,
          content,
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

      case "message_start": {
        // Capture input token counts from the streaming message start event
        const msg = nativeEvent.message as {
          usage?: {
            input_tokens?: number
            cache_creation_input_tokens?: number
            cache_read_input_tokens?: number
          }
        }
        if (msg?.usage) {
          const turnInput =
            (msg.usage.input_tokens ?? 0) +
            (msg.usage.cache_creation_input_tokens ?? 0) +
            (msg.usage.cache_read_input_tokens ?? 0)
          this.streamingUsage.inputTokens += turnInput
          this.turnUsage.inputTokens = turnInput
        }
        break
      }

      case "message_delta": {
        // Capture output token counts from the streaming message delta event
        const deltaUsage = nativeEvent.usage as { output_tokens?: number } | undefined
        if (deltaUsage?.output_tokens) {
          this.streamingUsage.outputTokens += deltaUsage.output_tokens
          this.turnUsage.outputTokens += deltaUsage.output_tokens
        }
        break
      }

      case "message_stop": {
        // Emit per-turn usage so the UI can show token counts incrementally
        // (rather than waiting for the final result event, which may never come
        // if the session is interrupted)
        if (this.turnUsage.inputTokens > 0 || this.turnUsage.outputTokens > 0) {
          this.emit("event", {
            type: "turn_usage",
            timestamp: this.now(),
            usage: {
              inputTokens: this.turnUsage.inputTokens,
              outputTokens: this.turnUsage.outputTokens,
              totalTokens: this.turnUsage.inputTokens + this.turnUsage.outputTokens,
            },
          })
        }
        // Reset per-turn tracking for the next turn
        this.turnUsage = { inputTokens: 0, outputTokens: 0 }
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
