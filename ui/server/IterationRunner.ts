import { EventEmitter } from "node:events"
import type {
  AgentAdapter,
  AgentEvent,
  AgentMessage,
  AgentStartOptions,
  AgentStatus,
} from "./AgentAdapter.js"

export type IterationStatus = "idle" | "running" | "paused" | "stopping" | "stopped" | "error"

export interface IterationRunnerOptions {
  /** The agent adapter to use for running iterations */
  adapter: AgentAdapter
  /** Working directory for the agent */
  cwd?: string
  /** Environment variables to pass to the agent */
  env?: Record<string, string>
  /** System prompt for the agent */
  systemPrompt?: string
  /** Model to use (agent-specific) */
  model?: string
  /** Maximum number of iterations/turns */
  maxIterations?: number
  /** Additional agent-specific options */
  [key: string]: unknown
}

/**  Events emitted by IterationRunner */
export interface IterationRunnerEvents {
  /** Agent event received */
  event: (event: AgentEvent) => void
  /** Status changed */
  status: (status: IterationStatus) => void
  /** Agent status changed */
  agentStatus: (status: AgentStatus) => void
  /** An error occurred */
  error: (error: Error) => void
  /** Iteration completed */
  complete: (info: { success: boolean; error?: Error }) => void
}

/**
 * Manages agent iterations using an AgentAdapter.
 *
 * Provides a consistent API for running iterations with different agents
 * via the adapter pattern. Handles event forwarding, status management,
 * and lifecycle control.
 *
 * @example
 * ```ts
 * const adapter = createAdapter('claude')
 * const runner = new IterationRunner({ adapter, cwd: '/project' })
 *
 * runner.on('event', (event) => {
 *   if (event.type === 'message') {
 *     console.log('Agent says:', event.content)
 *   }
 * })
 *
 * await runner.start()
 * await runner.sendMessage('Hello!')
 * await runner.stop()
 * ```
 */
export class IterationRunner extends EventEmitter {
  private adapter: AgentAdapter
  private _status: IterationStatus = "idle"
  private startOptions: AgentStartOptions
  private isStarted = false
  private hasCompleted = false

  constructor(options: IterationRunnerOptions) {
    super()

    this.adapter = options.adapter
    this.startOptions = {
      cwd: options.cwd,
      env: options.env,
      systemPrompt: options.systemPrompt,
      model: options.model,
      maxIterations: options.maxIterations,
    }

    // Forward adapter events
    this.setupAdapterListeners()
  }

  /**
   * Current status of the iteration runner.
   */
  get status(): IterationStatus {
    return this._status
  }

  /**
   * Whether an iteration is currently running.
   */
  get isRunning(): boolean {
    return this._status === "running"
  }

  /**
   * The underlying agent adapter.
   */
  get agentAdapter(): AgentAdapter {
    return this.adapter
  }

  /**
   * Start the agent and prepare for iterations.
   *
   * @returns Promise that resolves when agent is ready
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      throw new Error("IterationRunner is already started")
    }

    this.setStatus("running")
    this.hasCompleted = false

    try {
      await this.adapter.start(this.startOptions)
      this.isStarted = true
    } catch (err) {
      this.setStatus("error")
      throw err
    }
  }

  /**
   * Send a message to the agent.
   *
   * @param content - The message content
   * @returns Promise that resolves when message is sent
   */
  async sendMessage(content: string): Promise<void> {
    if (!this.isStarted) {
      throw new Error("IterationRunner is not started")
    }

    if (this._status !== "running") {
      throw new Error(`Cannot send message in ${this._status} state`)
    }

    const message: AgentMessage = {
      type: "user_message",
      content,
    }

    this.adapter.send(message)
  }

  /**
   * Pause the agent.
   * Only works if the adapter supports pause/resume.
   */
  pause(): void {
    if (!this.isStarted) {
      throw new Error("IterationRunner is not started")
    }

    if (this._status !== "running") {
      throw new Error(`Cannot pause in ${this._status} state`)
    }

    const message: AgentMessage = {
      type: "control",
      command: "pause",
    }

    this.adapter.send(message)
    this.setStatus("paused")
  }

  /**
   * Resume a paused agent.
   * Only works if the adapter supports pause/resume.
   */
  resume(): void {
    if (!this.isStarted) {
      throw new Error("IterationRunner is not started")
    }

    if (this._status !== "paused") {
      throw new Error(`Cannot resume in ${this._status} state`)
    }

    const message: AgentMessage = {
      type: "control",
      command: "resume",
    }

    this.adapter.send(message)
    this.setStatus("running")
  }

  /**
   * Stop the agent.
   *
   * @param force - If true, force stop immediately; otherwise, allow graceful shutdown
   * @returns Promise that resolves when agent has stopped
   */
  async stop(force = false): Promise<void> {
    if (!this.isStarted) {
      return
    }

    this.setStatus("stopping")

    try {
      await this.adapter.stop(force)
      this.isStarted = false
      this.setStatus("stopped")
    } catch (err) {
      this.setStatus("error")
      throw err
    }
  }

  /**
   * Set up listeners to forward adapter events.
   */
  private setupAdapterListeners(): void {
    // Forward agent events
    this.adapter.on("event", (event: AgentEvent) => {
      this.emit("event", event)

      // Handle result events to emit complete
      if (event.type === "result" && !this.hasCompleted) {
        this.hasCompleted = true
        this.emit("complete", { success: true })
      }

      // Handle error events
      if (event.type === "error" && event.fatal && !this.hasCompleted) {
        this.hasCompleted = true
        this.setStatus("error")
        this.emit("complete", { success: false, error: new Error(event.message) })
      }
    })

    // Forward status changes
    this.adapter.on("status", (status: AgentStatus) => {
      this.emit("agentStatus", status)

      // Map agent status to iteration status
      switch (status) {
        case "starting":
        case "running":
          this.setStatus("running")
          break
        case "paused":
          this.setStatus("paused")
          break
        case "stopping":
          this.setStatus("stopping")
          break
        case "stopped":
          this.setStatus("stopped")
          break
      }
    })

    // Forward errors
    this.adapter.on("error", (error: Error) => {
      this.setStatus("error")
      this.emit("error", error)
    })

    // Handle exit
    this.adapter.on("exit", (info: { code?: number; signal?: string }) => {
      this.isStarted = false
      this.setStatus("stopped")

      // Only emit complete if we haven't already (e.g., from result or error event)
      if (!this.hasCompleted) {
        this.hasCompleted = true
        // Emit complete with error if exit code is non-zero
        if (info.code && info.code !== 0) {
          this.emit("complete", {
            success: false,
            error: new Error(`Agent exited with code ${info.code}`),
          })
        } else {
          this.emit("complete", { success: true })
        }
      }
    })
  }

  /**
   * Update status and emit status event.
   */
  private setStatus(status: IterationStatus): void {
    if (this._status !== status) {
      this._status = status
      this.emit("status", status)
    }
  }
}
