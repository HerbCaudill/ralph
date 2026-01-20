import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process"
import { EventEmitter } from "node:events"
import { loadSystemPrompt } from "./systemPrompt.js"
import type { BdProxy } from "./BdProxy.js"
import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk"

// Types

export type TaskChatStatus = "idle" | "processing" | "error"

export interface TaskChatMessage {
  role: "user" | "assistant"
  content: string
  timestamp: number
}

export interface TaskChatEvent {
  type: string
  timestamp: number
  [key: string]: unknown
}

export type SpawnFn = (command: string, args: string[], options: SpawnOptions) => ChildProcess

/** Function to get the BdProxy instance (avoids circular dependency) */
export type GetBdProxyFn = () => BdProxy

export interface TaskChatManagerOptions {
  /** Command to spawn (default: "claude") */
  command?: string
  /** Working directory for the process */
  cwd?: string
  /** Additional environment variables */
  env?: Record<string, string>
  /** Custom spawn function (for testing) */
  spawn?: SpawnFn
  /** Model to use (default: "haiku" for fast, cheap responses) */
  model?: string
  /** Function to get the BdProxy instance */
  getBdProxy?: GetBdProxyFn
  /** Request timeout in ms (default: 600000 = 10 minutes) */
  timeout?: number
}

// TaskChatManager

/**
 * Manages task chat conversations with Claude CLI.
 *
 * Uses Claude CLI in print mode with streaming JSON output to handle
 * task management conversations. Each message spawns a new Claude process
 * to maintain conversation history.
 *
 * Events emitted:
 * - "message" - New message (user or assistant)
 * - "chunk" - Streaming text chunk from Claude
 * - "status" - Status changed
 * - "error" - Error from process or parsing
 */
export class TaskChatManager extends EventEmitter {
  private process: ChildProcess | null = null
  private _status: TaskChatStatus = "idle"
  private _messages: TaskChatMessage[] = []
  private buffer = ""
  private currentResponse = ""
  private cancelled = false
  private abortController: AbortController | null = null
  private getBdProxy: GetBdProxyFn | undefined
  private options: {
    command: string
    cwd: string
    env: Record<string, string>
    spawn: SpawnFn
    model: string
    timeout: number
  }

  constructor(options: TaskChatManagerOptions = {}) {
    super()
    this.getBdProxy = options.getBdProxy
    this.options = {
      command: options.command ?? "claude",
      cwd: options.cwd ?? process.cwd(),
      env: options.env ?? {},
      spawn: options.spawn ?? spawn,
      model: options.model ?? "haiku",
      timeout: options.timeout ?? 600000, // 10 minute default
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
   * Conversation history.
   */
  get messages(): TaskChatMessage[] {
    return [...this._messages]
  }

  /**
   * Clear conversation history.
   */
  clearHistory(): void {
    this._messages = []
    this.emit("historyCleared")
  }

  /**
   * Send a message and get a response from Claude.
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

    // Add user message to history
    const userMsg: TaskChatMessage = {
      role: "user",
      content: userMessage,
      timestamp: Date.now(),
    }
    this._messages.push(userMsg)
    this.emit("message", userMsg)

    let systemPrompt: string
    let conversationPrompt: string

    try {
      // Build system prompt with current task context
      systemPrompt = await this.buildSystemPrompt()

      // Build conversation for Claude
      conversationPrompt = this.buildConversationPrompt(userMessage)
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

      // Use SDK query() instead of spawning CLI
      ;(async () => {
        try {
          this.abortController = new AbortController()
          let hasError = false
          let errorMessage = ""

          for await (const message of query({
            prompt: conversationPrompt,
            options: {
              model: this.options.model,
              cwd: this.options.cwd,
              env: this.options.env,
              systemPrompt,
              tools: [], // No tools for task chat
              permissionMode: "bypassPermissions",
              allowDangerouslySkipPermissions: true,
              includePartialMessages: true, // Enable streaming
              maxTurns: 1, // Single turn for task chat
              abortController: this.abortController,
            },
          })) {
            // If cancelled, stop processing
            if (this.cancelled) {
              break
            }

            // Check if this is an error result
            if (message.type === "result" && message.subtype === "error") {
              hasError = true
              errorMessage = message.errors?.join(", ") || "Unknown error"
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

          // After iteration completes, add assistant message to history
          if (this.currentResponse) {
            const assistantMsg: TaskChatMessage = {
              role: "assistant",
              content: this.currentResponse,
              timestamp: Date.now(),
            }
            this._messages.push(assistantMsg)
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
      })()
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
    } else if (this.process) {
      // Fallback for legacy process-based implementation
      this.cancelled = true
      this.process.kill("SIGTERM")
      this.setStatus("idle")
    }
  }

  /**
   * Build the system prompt with current task context.
   */
  private async buildSystemPrompt(): Promise<string> {
    let basePrompt: string
    try {
      basePrompt = loadSystemPrompt(this.options.cwd)
    } catch {
      // Fallback to a basic prompt if file not found
      basePrompt = "You are a task management assistant. Help users manage their issues and tasks."
    }

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

    return basePrompt + taskContext
  }

  /**
   * Build the conversation prompt from history.
   */
  private buildConversationPrompt(currentMessage: string): string {
    // For now, just use the current message
    // In the future, we could include conversation history
    // but Claude CLI doesn't have built-in multi-turn support in print mode

    // Build a prompt that includes recent conversation context
    if (this._messages.length <= 1) {
      // First message - just use it directly
      return currentMessage
    }

    // Include recent conversation history in the prompt
    const recentHistory = this._messages.slice(-10, -1) // Last 10 messages, excluding current
    let conversationContext = "Previous conversation:\n\n"

    for (const msg of recentHistory) {
      const role = msg.role === "user" ? "User" : "Assistant"
      conversationContext += `${role}: ${msg.content}\n\n`
    }

    conversationContext += `User: ${currentMessage}\n\nAssistant:`

    return conversationContext
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
   * Parse a streaming JSON line from Claude CLI.
   */
  private parseStreamLine(line: string): void {
    try {
      const event = JSON.parse(line) as TaskChatEvent

      // Handle different event types from Claude CLI stream-json output
      switch (event.type) {
        case "assistant":
          // Assistant message with content
          if (event.message && typeof event.message === "object") {
            const message = event.message as { content?: Array<{ type: string; text?: string }> }
            if (message.content) {
              for (const block of message.content) {
                if (block.type === "text" && block.text) {
                  this.currentResponse = block.text
                  this.emit("chunk", block.text)
                }
              }
            }
          }
          break

        case "content_block_delta":
          // Streaming text delta
          if (event.delta && typeof event.delta === "object") {
            const delta = event.delta as { type?: string; text?: string }
            if (delta.type === "text_delta" && delta.text) {
              this.currentResponse += delta.text
              this.emit("chunk", delta.text)
            }
          }
          break

        case "result":
          // Final result - extract full response
          if (event.result && typeof event.result === "string") {
            this.currentResponse = event.result
          }
          break

        case "error":
          // Error from Claude
          const errorMsg =
            typeof event.error === "string" ? event.error
            : typeof event.message === "string" ? event.message
            : "Unknown error"
          this.emit("error", new Error(errorMsg))
          break
      }

      this.emit("event", event)
    } catch {
      // Not valid JSON - might be raw output, ignore
    }
  }

  /**
   * Handle SDK message from query() and emit appropriate events.
   */
  private handleSDKMessage(message: SDKMessage): void {
    switch (message.type) {
      case "stream_event":
        // Handle streaming chunks
        if (message.event.type === "content_block_delta") {
          const delta = message.event.delta
          if (delta.type === "text_delta" && delta.text) {
            this.currentResponse += delta.text
            this.emit("chunk", delta.text)
          }
        }
        // Emit the event as a task chat event for compatibility
        this.emit("event", {
          type: message.event.type,
          timestamp: Date.now(),
          ...message.event,
        })
        break

      case "assistant":
        // Complete assistant message
        if (message.message?.content) {
          for (const block of message.message.content) {
            if (block.type === "text" && block.text) {
              this.currentResponse = block.text
              this.emit("chunk", block.text)
            }
          }
        }
        // Emit as task chat event
        this.emit("event", {
          type: "assistant",
          timestamp: Date.now(),
          message: message.message,
        })
        break

      case "result":
        // Final result
        if (message.subtype === "success" && message.result) {
          this.currentResponse = message.result
        }
        // Note: error results are handled in sendMessage() to properly reject the promise
        // Emit as task chat event
        this.emit("event", {
          type: "result",
          timestamp: Date.now(),
          result: message.subtype === "success" ? message.result : undefined,
          error: message.subtype === "error" ? message.errors?.join(", ") : undefined,
        })
        break

      default:
        // Emit other message types as events
        this.emit("event", {
          type: message.type,
          timestamp: Date.now(),
          ...message,
        })
        break
    }
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
