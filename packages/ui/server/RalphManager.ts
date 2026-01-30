import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process"
import { EventEmitter } from "node:events"

/**
 * Manages a ralph CLI child process.
 *
 * Spawns ralph with --json flag to capture structured events from stdout.
 * Provides methods to start/stop the process and send messages via stdin.
 *
 * Events emitted:
 * - "event" - Ralph JSON event from stdout
 * - "error" - Error from process or parsing
 * - "exit" - Process exited
 * - "status" - Status changed
 * - "output" - Non-JSON stdout line
 */
export class RalphManager extends EventEmitter {
  private process: ChildProcess | null = null
  private _status: RalphStatus = "stopped"
  private buffer = ""
  private pauseTimeout: NodeJS.Timeout | null = null
  private options: {
    command: string
    args: string[]
    cwd: string
    env: Record<string, string>
    spawn: SpawnFn
    watch: boolean
    agent: string
  }

  constructor(options: RalphManagerOptions = {}) {
    super()
    this.options = {
      command: options.command ?? "npx",
      args: options.args ?? ["@herbcaudill/ralph", "--json"],
      cwd: options.cwd ?? process.cwd(),
      env: options.env ?? {},
      spawn: options.spawn ?? spawn,
      watch: options.watch ?? false,
      agent: options.agent ?? "claude",
    }
  }

  /**
   * Current status of the ralph process.
   */
  get status(): RalphStatus {
    return this._status
  }

  /**
   * Whether the ralph process is currently running.
   */
  get isRunning(): boolean {
    return this._status === "running"
  }

  /**
   * Whether ralph can accept user messages.
   * This is true when the process is running and stdin is available.
   * Includes running, paused, pausing, and stopping_after_current states.
   */
  get canAcceptMessages(): boolean {
    return (
      this._status === "running" ||
      this._status === "paused" ||
      this._status === "pausing" ||
      this._status === "stopping_after_current"
    )
  }

  /**
   * Start the ralph process.
   *
   * @param sessions - Number of sessions (optional)
   * @returns Promise that resolves when process starts
   */
  async start(sessions?: number): Promise<void> {
    if (this.process) {
      throw new Error("Ralph is already running")
    }

    this.setStatus("starting")

    const args = [...this.options.args]
    if (this.options.agent !== "claude") {
      args.push("--agent", this.options.agent)
    }
    if (this.options.watch) {
      args.push("--watch")
    }
    if (sessions !== undefined) {
      args.push(String(sessions))
    }

    return new Promise((resolve, reject) => {
      try {
        this.process = this.options.spawn(this.options.command, args, {
          cwd: this.options.cwd,
          env: { ...process.env, ...this.options.env },
          stdio: ["pipe", "pipe", "pipe"],
        })

        this.process.on("error", err => {
          this.setStatus("stopped")
          this.emit("error", err)
          reject(err)
        })

        this.process.on("spawn", () => {
          this.setStatus("running")
          // Note: Session boundaries are now exclusively marked by ralph_session_start
          // events from the CLI, which include richer metadata (sessionId, taskId, repo).
          // Previously, we emitted a system/init event here as a fallback boundary marker.
          resolve()
        })

        this.process.on("exit", (code, signal) => {
          this.process = null
          this.buffer = ""
          // Clear any pending pause timeout
          if (this.pauseTimeout) {
            clearTimeout(this.pauseTimeout)
            this.pauseTimeout = null
          }
          this.setStatus("stopped")
          this.emit("exit", { code, signal })
        })

        // Handle stdout - parse newline-delimited JSON
        this.process.stdout?.on("data", (data: Buffer) => {
          this.handleStdout(data)
        })

        // Handle stderr - emit as errors
        this.process.stderr?.on("data", (data: Buffer) => {
          const message = data.toString().trim()
          if (message) {
            this.emit("error", new Error(`stderr: ${message}`))
          }
        })
      } catch (err) {
        this.setStatus("stopped")
        reject(err)
      }
    })
  }

  /**
   * Pause the ralph process by sending a pause command via stdin.
   * Ralph will pause after the current session completes.
   * The process can be resumed later with resume().
   *
   * If Ralph doesn't respond with a ralph_paused event within 10 seconds,
   * we'll automatically transition to "paused" state to prevent the UI from
   * getting stuck in "pausing" state.
   */
  pause(): void {
    if (!this.process) {
      throw new Error("Ralph is not running")
    }
    if (this._status === "paused" || this._status === "pausing") {
      return // Already paused or pausing
    }
    if (this._status !== "running") {
      throw new Error(`Cannot pause ralph in ${this._status} state`)
    }

    this.send({ type: "pause" })
    this.setStatus("pausing")

    // Set a timeout to force transition to "paused" if Ralph doesn't respond
    // This prevents the UI from getting stuck in "pausing" state indefinitely
    this.pauseTimeout = setTimeout(() => {
      if (this._status === "pausing") {
        this.setStatus("paused")
      }
    }, 10000) // 10 second timeout
  }

  /**
   * Resume a paused ralph process by sending a resume command via stdin.
   */
  resume(): void {
    if (!this.process) {
      throw new Error("Ralph is not running")
    }
    if (this._status !== "paused") {
      throw new Error(`Cannot resume ralph in ${this._status} state`)
    }

    // Clear any pending pause timeout
    if (this.pauseTimeout) {
      clearTimeout(this.pauseTimeout)
      this.pauseTimeout = null
    }

    this.send({ type: "resume" })
    this.setStatus("running")
  }

  /**
   * Request ralph to stop after completing the current task.
   * Sends the stop command via stdin which Ralph handles gracefully,
   * stopping after the current session completes.
   */
  stopAfterCurrent(): void {
    if (!this.process) {
      throw new Error("Ralph is not running")
    }
    if (this._status !== "running" && this._status !== "paused") {
      throw new Error(`Cannot stop-after-current ralph in ${this._status} state`)
    }

    // Send the stop signal to ralph via stdin - tells Ralph to stop after current session
    this.send({ type: "stop" })
    this.setStatus("stopping_after_current")
  }

  /**
   * Cancel a pending stop-after-current request by restarting Ralph after it stops.
   * Returns a promise that resolves when Ralph has restarted.
   */
  async cancelStopAfterCurrent(): Promise<void> {
    if (!this.process) {
      throw new Error("Ralph is not running")
    }
    if (this._status !== "stopping_after_current") {
      throw new Error(`Cannot cancel stop-after-current in ${this._status} state`)
    }

    // Wait for Ralph to stop, then restart
    return new Promise<void>(resolve => {
      const onExit = () => {
        this.removeListener("exit", onExit)
        // Restart Ralph after it stops
        this.start().then(resolve)
      }
      this.once("exit", onExit)
    })
  }

  /**
   * Stop the ralph process immediately.
   *
   * Sends SIGTERM for immediate termination. Falls back to SIGKILL after timeout.
   *
   * @param timeout - Timeout in ms before force kill (default: 5000)
   * @returns Promise that resolves when process exits
   */
  async stop(timeout = 5000): Promise<void> {
    if (!this.process) {
      return
    }

    // Clear any pending pause timeout
    if (this.pauseTimeout) {
      clearTimeout(this.pauseTimeout)
      this.pauseTimeout = null
    }

    this.setStatus("stopping")

    return new Promise(resolve => {
      const forceKillTimer = setTimeout(() => {
        // Force kill if timeout exceeded
        if (this.process) {
          this.process.kill("SIGKILL")
        }
      }, timeout)

      const cleanup = () => {
        clearTimeout(forceKillTimer)
        resolve()
      }

      this.process!.once("exit", cleanup)

      // Send SIGTERM for immediate termination
      this.process!.kill("SIGTERM")
    })
  }

  /**
   * Send a message to the ralph process via stdin.
   *
   * For user messages during an session, send:
   * { type: "message", text: "your message here" }
   *
   * For control commands:
   * - { type: "pause" } - Pause after current session
   * - { type: "resume" } - Resume from paused state
   * - { type: "stop" } - Stop after current session
   *
   * @param message - Message to send (will be JSON stringified if object)
   */
  send(message: string | object): void {
    if (!this.process?.stdin?.writable) {
      throw new Error("Ralph is not running or stdin is not writable")
    }

    const payload = typeof message === "string" ? message : JSON.stringify(message)
    this.process.stdin.write(payload + "\n")
  }

  /**
   * Handle stdout data, parsing newline-delimited JSON.
   */
  private handleStdout(data: Buffer): void {
    this.buffer += data.toString()

    // Process complete lines
    let newlineIndex: number
    while ((newlineIndex = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, newlineIndex).trim()
      this.buffer = this.buffer.slice(newlineIndex + 1)

      if (line) {
        this.parseLine(line)
      }
    }
  }

  /**
   * Parse a single line of JSON output.
   */
  private parseLine(line: string): void {
    try {
      const parsed = JSON.parse(line) as RalphEvent
      // Ensure all events have a timestamp - SDK events may not include one
      const event: RalphEvent = {
        ...parsed,
        timestamp: parsed.timestamp ?? Date.now(),
      }

      // Handle pause/resume events to update status
      if (event.type === "ralph_paused") {
        // Clear the pause timeout since we received the event
        if (this.pauseTimeout) {
          clearTimeout(this.pauseTimeout)
          this.pauseTimeout = null
        }
        this.setStatus("paused")
      } else if (event.type === "ralph_resumed") {
        this.setStatus("running")
      }

      this.emit("event", event)
    } catch {
      // Not valid JSON - emit as raw output
      this.emit("output", line)
    }
  }

  /**
   * Update status and emit status event.
   */
  private setStatus(status: RalphStatus): void {
    if (this._status !== status) {
      this._status = status
      this.emit("status", status)
    }
  }
}

export type RalphStatus =
  | "stopped"
  | "starting"
  | "running"
  | "pausing"
  | "paused"
  | "stopping"
  | "stopping_after_current"

export interface RalphEvent {
  type: string
  timestamp: number
  /** Unique identifier for deduplication. Generated by server if not present. */
  id?: string
  [key: string]: unknown
}

export type SpawnFn = (command: string, args: string[], options: SpawnOptions) => ChildProcess

export interface RalphManagerOptions {
  /** Command to spawn (default: "npx") */
  command?: string
  /** Arguments for the command (default: ["@herbcaudill/ralph", "--json"]) */
  args?: string[]
  /** Working directory for the process */
  cwd?: string
  /** Additional environment variables */
  env?: Record<string, string>
  /** Custom spawn function (for testing) */
  spawn?: SpawnFn
  /** Run in watch mode (adds --watch flag) */
  watch?: boolean
  /** Agent to use (adds --agent flag, default: "claude") */
  agent?: string
}
