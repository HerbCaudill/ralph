import { EventEmitter } from "node:events"
import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk"
import { loadTaskChatSkill } from "./systemPrompt.js"
import type { BdProxy } from "./BdProxy.js"
import { findClaudeExecutable } from "./findClaudeExecutable.js"
import { buildCwdContext } from "./ClaudeAdapter.js"

/**
 * Manages task chat conversations with Claude Agent SDK.
 *
 * Uses Claude Agent SDK to handle task management conversations.
 *
 * Events emitted:
 * - "event" - Raw SDK event (stream_event, assistant, user, result)
 * - "message" - New message (user or assistant) - legacy, for existing UI
 * - "chunk" - Streaming text chunk from Claude - legacy, for existing UI
 * - "status" - Status changed
 * - "error" - Error from SDK
 * - "tool_use" - Tool use started - legacy, for existing UI
 * - "tool_update" - Tool use updated - legacy, for existing UI
 * - "tool_result" - Tool use completed - legacy, for existing UI
 */
export class TaskChatManager extends EventEmitter {
  private _status: TaskChatStatus = "idle"
  private currentResponse = ""
  private cancelled = false
  private abortController: AbortController | null = null
  private getBdProxy: GetBdProxyFn | undefined
  /** Track pending tool uses to match results */
  private pendingToolUses: Map<
    string,
    { tool: string; input: Record<string, unknown>; sequence: number }
  > = new Map()
  /** Sequence counter for ordering content within a turn */
  private sequenceCounter = 0
  /** Session ID for maintaining conversation continuity across messages */
  private sessionId: string | null = null
  private options: {
    cwd: string
    env: Record<string, string>
    model: string
    timeout: number
    pathToClaudeCodeExecutable?: string
  }

  constructor(options: TaskChatManagerOptions = {}) {
    super()
    this.getBdProxy = options.getBdProxy

    // Auto-detect Claude executable path if not provided
    const claudePath = options.pathToClaudeCodeExecutable ?? findClaudeExecutable()

    this.options = {
      cwd: options.cwd ?? process.cwd(),
      env: options.env ?? {},
      model: options.model ?? "haiku",
      timeout: options.timeout ?? 600000, // 10 minute default
      pathToClaudeCodeExecutable: claudePath,
    }
  }

  /**
   * Current status of the task chat.
   */
  get status(): TaskChatStatus {
    return this._status
  }

  /**
   * Whether a chat request is currently processing.
   */
  get isProcessing(): boolean {
    return this._status === "processing"
  }

  /**
   * Clear conversation history and reset the SDK session.
   * The next message will start a fresh session.
   */
  clearHistory(): void {
    this.sessionId = null
    this.emit("historyCleared")
  }

  /**
   * Send a message and get a response from Claude.
   *
   * Uses SDK session persistence to maintain conversation continuity.
   * On the first message, a new session is created. Subsequent messages
   * resume the same session, preserving full conversation history natively.
   *
   * @param userMessage - The user's message
   * @returns Promise that resolves with the assistant's response
   */
  async sendMessage(userMessage: string): Promise<string> {
    if (this._status === "processing") {
      throw new Error("A request is already in progress")
    }

    this.setStatus("processing")
    this.cancelled = false
    this.currentResponse = ""
    this.sequenceCounter = 0 // Reset sequence counter for new turn

    // Emit user message event (for real-time UI updates)
    const userMsg: TaskChatMessage = {
      role: "user",
      content: userMessage,
      timestamp: Date.now(),
    }
    this.emit("message", userMsg)

    let appendSystemPrompt: string
    let skillTools: string[]
    let skillModel: string | undefined

    try {
      // Build system prompt to append to Claude Code's defaults
      const skillConfig = await this.buildSystemPrompt()
      appendSystemPrompt = skillConfig.prompt
      skillTools = skillConfig.tools
      skillModel = skillConfig.model
    } catch (err) {
      // If building prompts fails, reset status and re-throw
      this.setStatus("idle")
      throw err
    }

    return new Promise((resolve, reject) => {
      // Set up a timeout to prevent getting stuck in "processing" state
      const timeoutMs = this.options.timeout
      const timeoutMinutes = Math.round(timeoutMs / 60000)
      const timeoutTimer = setTimeout(() => {
        if (this.abortController) {
          this.abortController.abort()
          this.abortController = null
        }
        const err = new Error(`Request timed out after ${timeoutMinutes} minutes`)
        this.setStatus("idle")
        this.emit("error", err)
        reject(err)
      }, timeoutMs)

      const cleanup = () => {
        clearTimeout(timeoutTimer)
        this.abortController = null
      }

      this.executeQuery(
        userMessage,
        appendSystemPrompt,
        skillTools,
        skillModel,
        cleanup,
        resolve,
        reject,
      )
    })
  }

  /**
   * Cancel the current request if one is in progress.
   */
  cancel(): void {
    if (this.abortController) {
      this.cancelled = true
      this.abortController.abort()
      this.setStatus("idle")
    }
  }

  /**
   * Execute the query with the given parameters.
   */
  private async executeQuery(
    /** The user message to send */
    userMessage: string,
    /** System prompt to append */
    appendSystemPrompt: string,
    /** Tools to use */
    skillTools: string[],
    /** Model to use */
    skillModel: string | undefined,
    /** Cleanup function */
    cleanup: () => void,
    /** Promise resolve callback */
    resolve: (value: string) => void,
    /** Promise reject callback */
    reject: (reason?: unknown) => void,
  ): Promise<void> {
    try {
      this.abortController = new AbortController()
      let hasError = false
      let errorMessage = ""

      // Build query options - resume existing session if available
      const queryOptions: Record<string, unknown> = {
        model: skillModel ?? this.options.model,
        cwd: this.options.cwd,
        env: this.options.env,
        // Use Claude Code's default system prompt (includes CLAUDE.md, cwd awareness)
        // and append our task chat instructions
        systemPrompt: {
          type: "preset",
          preset: "claude_code",
          append: appendSystemPrompt,
        },
        // Disable hooks to avoid "tool use concurrency" errors
        // See: https://github.com/anthropics/claude-agent-sdk-python/issues/265
        hooks: {},
        // Tools from skill metadata (with fallback defaults)
        tools: skillTools,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        includePartialMessages: true, // Enable streaming
        maxTurns: 100, // High limit to allow complex investigations
        abortController: this.abortController,
        pathToClaudeCodeExecutable: this.options.pathToClaudeCodeExecutable,
      }

      // Resume existing session for conversation continuity
      if (this.sessionId) {
        queryOptions.resume = this.sessionId
      }

      for await (const message of query({
        prompt: userMessage,
        options: queryOptions,
      })) {
        // If cancelled, stop processing
        if (this.cancelled) {
          break
        }

        // Check if this is an error result
        if (message.type === "result" && message.subtype !== "success") {
          hasError = true
          errorMessage = `Query failed: ${message.subtype}`
        }

        // Handle different SDK message types
        this.handleSDKMessage(message)
      }

      // If we got an error result, reject
      if (hasError) {
        cleanup()
        this.setStatus("error")
        const err = new Error(errorMessage)
        this.emit("error", err)
        reject(err)
        return
      }

      // After session completes, emit assistant message event (client stores it)
      if (this.currentResponse) {
        // Assign a sequence number that places this message AFTER all tool uses in the turn
        // This ensures the final text appears at the end, after any interleaved tool uses
        const sequence = this.sequenceCounter++
        const assistantMsg: TaskChatMessage = {
          role: "assistant",
          content: this.currentResponse,
          timestamp: Date.now(),
          sequence,
        }
        this.emit("message", assistantMsg)
      }

      cleanup()
      this.setStatus("idle")
      resolve(this.currentResponse)
    } catch (err) {
      cleanup()
      this.setStatus("error")
      this.emit("error", err)
      reject(err)
    }
  }

  /**
   * Build the system prompt with current task context.
   * Also returns metadata from the skill (tools, model).
   */
  private async buildSystemPrompt(): Promise<{
    prompt: string
    tools: string[]
    model: string | undefined
  }> {
    let basePrompt: string
    let tools: string[] = ["Read", "Grep", "Glob", "Bash"] // Default fallback
    let model: string | undefined

    try {
      const skill = loadTaskChatSkill(this.options.cwd)
      basePrompt = skill.content
      if (skill.metadata.allowedTools) {
        tools = skill.metadata.allowedTools
      }
      model = skill.metadata.model
    } catch {
      // Fallback to a basic prompt if skill not found
      basePrompt = "You are a task management assistant. Help users manage their issues and tasks."
    }

    // Add working directory context at the beginning of the prompt
    const cwdContext = buildCwdContext(this.options.cwd)
    basePrompt = cwdContext + basePrompt

    // Add current task context if BdProxy is available
    let taskContext = ""
    if (this.getBdProxy) {
      try {
        const bdProxy = this.getBdProxy()

        // Get open and in_progress issues
        const [openIssues, inProgressIssues] = await Promise.all([
          bdProxy.list({ status: "open", limit: 50 }),
          bdProxy.list({ status: "in_progress", limit: 20 }),
        ])

        if (openIssues.length > 0 || inProgressIssues.length > 0) {
          taskContext = "\n\n## Current Tasks\n\n"

          if (inProgressIssues.length > 0) {
            taskContext += "### In Progress\n"
            for (const issue of inProgressIssues) {
              taskContext += `- [${issue.id}] ${issue.title} (P${issue.priority})\n`
            }
            taskContext += "\n"
          }

          if (openIssues.length > 0) {
            taskContext += "### Open\n"
            for (const issue of openIssues.slice(0, 30)) {
              taskContext += `- [${issue.id}] ${issue.title} (P${issue.priority})\n`
            }
            if (openIssues.length > 30) {
              taskContext += `... and ${openIssues.length - 30} more\n`
            }
          }
        }
      } catch (err) {
        // If we can't get tasks, continue without context
        console.error("[task-chat] Failed to get task context:", err)
      }
    }

    return {
      prompt: basePrompt + taskContext,
      tools,
      model,
    }
  }

  /**
   * Handle SDK message from query() and emit appropriate events.
   */
  private handleSDKMessage(message: SDKMessage): void {
    const timestamp = Date.now()

    // Capture session_id from any SDK message for session continuity
    if ("session_id" in message && typeof message.session_id === "string" && !this.sessionId) {
      this.sessionId = message.session_id
    }

    switch (message.type) {
      case "stream_event":
        this.handleStreamEvent(message.event, timestamp)
        break

      case "assistant":
        // Complete assistant message
        // Note: Don't emit chunk here - chunks were already emitted during streaming
        // via content_block_delta events. The complete assistant message arrives AFTER
        // all streaming deltas, so emitting a chunk here would duplicate the content.
        if (message.message?.content) {
          for (const block of message.message.content) {
            if (block.type === "text" && block.text) {
              // Always set currentResponse to the final text (ensures consistency)
              // but don't emit chunk as the content was already streamed
              this.currentResponse = block.text
            } else if (block.type === "tool_use" && block.id && block.name) {
              // Tool use from complete assistant message - update the pending tool use
              // (the initial tool_use event was already emitted during streaming)
              const input = (block.input as Record<string, unknown>) ?? {}
              const existingToolUse = this.pendingToolUses.get(block.id)
              // Keep the existing sequence or assign a new one
              const sequence = existingToolUse?.sequence ?? this.sequenceCounter++
              this.pendingToolUses.set(block.id, { tool: block.name, input, sequence })

              if (existingToolUse) {
                // Update the existing tool use with full input and running status
                this.emit("tool_update", {
                  toolUseId: block.id,
                  tool: block.name,
                  input,
                  status: "running",
                  timestamp,
                  sequence,
                } satisfies TaskChatToolUse)
              } else {
                // No existing tool use - emit a new one (fallback for edge cases)
                this.emit("tool_use", {
                  toolUseId: block.id,
                  tool: block.name,
                  input,
                  status: "running",
                  timestamp,
                  sequence,
                } satisfies TaskChatToolUse)
              }
            }
          }
        }
        // Emit as task chat event
        this.emit("event", {
          type: "assistant",
          timestamp,
          message: message.message,
        })
        break

      case "user":
        // User message (typically tool results)
        if (message.message?.content && Array.isArray(message.message.content)) {
          for (const block of message.message.content) {
            if (block.type === "tool_result" && block.tool_use_id) {
              const toolUseId = block.tool_use_id as string
              const pending = this.pendingToolUses.get(toolUseId)
              const isError = block.is_error === true
              const content =
                typeof block.content === "string" ? block.content
                : Array.isArray(block.content) ?
                  block.content.map((c: { text?: string }) => c.text || "").join("")
                : ""

              this.emit("tool_result", {
                toolUseId,
                tool: pending?.tool ?? "unknown",
                input: pending?.input ?? {},
                output: isError ? undefined : content,
                error: isError ? content : undefined,
                status: isError ? "error" : "success",
                timestamp,
                sequence: pending?.sequence ?? this.sequenceCounter++,
              } satisfies TaskChatToolUse)

              this.pendingToolUses.delete(toolUseId)
            }
          }
        }
        // Emit as task chat event
        this.emit("event", {
          type: "user",
          timestamp,
          message: message.message,
        })
        break

      case "result": {
        // Final result
        if (message.subtype === "success" && message.result) {
          this.currentResponse = message.result
        }
        // Clear pending tool uses on completion
        this.pendingToolUses.clear()
        // Note: error results are handled in sendMessage() to properly reject the promise
        // Extract usage data from SDK result message
        const usage = message.usage as { input_tokens?: number; output_tokens?: number } | undefined
        // Emit as task chat event
        this.emit("event", {
          type: "result",
          timestamp,
          result: message.subtype === "success" ? message.result : undefined,
          error: message.subtype !== "success" ? message.subtype : undefined,
          usage:
            usage ?
              {
                inputTokens: usage.input_tokens ?? 0,
                outputTokens: usage.output_tokens ?? 0,
                totalTokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
              }
            : undefined,
        })
        break
      }

      default:
        // Emit other message types as events
        this.emit("event", {
          ...message,
          timestamp,
        })
        break
    }
  }

  /**
   * Handle stream_event messages from the SDK.
   */
  private handleStreamEvent(
    event: { type: string; delta?: unknown; content_block?: unknown; [key: string]: unknown },
    timestamp: number,
  ): void {
    switch (event.type) {
      case "content_block_start": {
        // Start of a new content block
        const contentBlock = event.content_block as {
          type?: string
          id?: string
          name?: string
        }
        if (contentBlock?.type === "tool_use" && contentBlock.id && contentBlock.name) {
          const sequence = this.sequenceCounter++
          this.pendingToolUses.set(contentBlock.id, {
            tool: contentBlock.name,
            input: {},
            sequence,
          })
          this.emit("tool_use", {
            toolUseId: contentBlock.id,
            tool: contentBlock.name,
            input: {},
            status: "pending",
            timestamp,
            sequence,
          } satisfies TaskChatToolUse)
        }
        break
      }

      case "content_block_delta": {
        // Handle streaming chunks
        const delta = event.delta as {
          type?: string
          text?: string
          partial_json?: string
        }
        if (delta?.type === "text_delta" && delta.text) {
          this.currentResponse += delta.text
          this.emit("chunk", delta.text)
        }
        // Tool input being streamed - we'll get the full input later
        break
      }

      case "content_block_stop":
        // Content block finished
        break
    }

    // Emit stream event wrapped in SDK-compatible format
    this.emit("event", {
      type: "stream_event",
      timestamp,
      event,
    })
  }

  /**
   * Update status and emit status event.
   */
  private setStatus(status: TaskChatStatus): void {
    if (this._status !== status) {
      this._status = status
      this.emit("status", status)
    }
  }
}

export type TaskChatStatus = "idle" | "processing" | "error"

export interface TaskChatMessage {
  role: "user" | "assistant"
  content: string
  timestamp: number
  /** Sequence number for ordering within a turn (assistant messages only) */
  sequence?: number
}

export interface TaskChatEvent {
  type: string
  timestamp: number
  [key: string]: unknown
}

export interface TaskChatToolUse {
  toolUseId: string
  tool: string
  input: Record<string, unknown>
  output?: string
  error?: string
  status: "pending" | "running" | "success" | "error"
  /** Timestamp when this tool use was created/emitted */
  timestamp: number
  /** Sequence number for ordering within a turn (lower = earlier) */
  sequence: number
}

/** Function to get the BdProxy instance (avoids circular dependency) */
export type GetBdProxyFn = () => BdProxy

export interface TaskChatManagerOptions {
  /** Working directory for SDK query execution */
  cwd?: string
  /** Additional environment variables for SDK query execution */
  env?: Record<string, string>
  /** Model to use (default: "haiku" for fast, cheap responses) */
  model?: string
  /** Function to get the BdProxy instance */
  getBdProxy?: GetBdProxyFn
  /** Request timeout in ms (default: 600000 = 10 minutes) */
  timeout?: number
  /** Path to the Claude Code executable (auto-detected if not specified) */
  pathToClaudeCodeExecutable?: string
}
