import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process"
import { EventEmitter } from "node:events"
import { loadSystemPrompt } from "./systemPrompt.js"
import type { BdProxy } from "./BdProxy.js"

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
  private getBdProxy: GetBdProxyFn | undefined
  private options: {
    command: string
    cwd: string
    env: Record<string, string>
    spawn: SpawnFn
    model: string
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

    // Add user message to history
    const userMsg: TaskChatMessage = {
      role: "user",
      content: userMessage,
      timestamp: Date.now(),
    }
    this._messages.push(userMsg)
    this.emit("message", userMsg)

    // Build system prompt with current task context
    const systemPrompt = await this.buildSystemPrompt()

    // Build conversation for Claude
    const conversationPrompt = this.buildConversationPrompt(userMessage)

    return new Promise((resolve, reject) => {
      try {
        // Spawn Claude CLI in print mode with streaming JSON output
        // Note: --verbose is required for stream-json output to work with --print
        const args = [
          "--print",
          "--verbose",
          "--output-format",
          "stream-json",
          "--model",
          this.options.model,
          "--system-prompt",
          systemPrompt,
          // Disable tools for task chat - it should only provide information and guidance
          "--tools",
          "",
          conversationPrompt,
        ]

        this.process = this.options.spawn(this.options.command, args, {
          cwd: this.options.cwd,
          env: { ...process.env, ...this.options.env },
          stdio: ["pipe", "pipe", "pipe"],
        })

        this.buffer = ""
        this.currentResponse = ""

        this.process.on("error", err => {
          this.process = null
          this.setStatus("error")
          this.emit("error", err)
          reject(err)
        })

        this.process.on("exit", (code, signal) => {
          this.process = null

          // If cancelled, resolve with whatever response we have (might be empty)
          if (this.cancelled) {
            this.setStatus("idle")
            resolve(this.currentResponse)
            return
          }

          // If exited with non-zero code and no response, treat as error
          if (code !== null && code !== 0 && !this.currentResponse) {
            const err = new Error(`Claude exited with code ${code}, signal ${signal}`)
            this.setStatus("error")
            this.emit("error", err)
            reject(err)
            return
          }

          // Add assistant message to history
          if (this.currentResponse) {
            const assistantMsg: TaskChatMessage = {
              role: "assistant",
              content: this.currentResponse,
              timestamp: Date.now(),
            }
            this._messages.push(assistantMsg)
            this.emit("message", assistantMsg)
          }

          this.setStatus("idle")
          resolve(this.currentResponse)
        })

        // Handle stdout - parse streaming JSON
        this.process.stdout?.on("data", (data: Buffer) => {
          this.handleStdout(data)
        })

        // Handle stderr - emit as errors (but don't fail)
        this.process.stderr?.on("data", (data: Buffer) => {
          const message = data.toString().trim()
          if (message) {
            // Log but don't fail - stderr often has warnings
            console.error("[task-chat] stderr:", message)
          }
        })
      } catch (err) {
        this.process = null
        this.setStatus("error")
        reject(err)
      }
    })
  }

  /**
   * Cancel the current request if one is in progress.
   */
  cancel(): void {
    if (this.process) {
      this.cancelled = true
      this.process.kill("SIGTERM")
      // Note: process will be set to null by the exit handler
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
   * Update status and emit status event.
   */
  private setStatus(status: TaskChatStatus): void {
    if (this._status !== status) {
      this._status = status
      this.emit("status", status)
    }
  }
}
