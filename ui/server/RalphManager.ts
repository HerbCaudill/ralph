import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process"
import { EventEmitter } from "node:events"

// Types

export type RalphStatus =
  | "stopped"
  | "starting"
  | "running"
  | "paused"
  | "stopping"
  | "stopping_after_current"

export interface RalphEvent {
  type: string
  timestamp: number
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
}

// RalphManager

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
  private options: {
    command: string
    args: string[]
    cwd: string
    env: Record<string, string>
    spawn: SpawnFn
    watch: boolean
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
   * Start the ralph process.
   *
   * @param iterations - Number of iterations (optional)
   * @returns Promise that resolves when process starts
   */
  async start(iterations?: number): Promise<void> {
    if (this.process) {
      throw new Error("Ralph is already running")
    }

    this.setStatus("starting")

    const args = [...this.options.args]
    if (this.options.watch) {
      args.push("--watch")
    }
    if (iterations !== undefined) {
      args.push(String(iterations))
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
          resolve()
        })

        this.process.on("exit", (code, signal) => {
          this.process = null
          this.buffer = ""
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
   * Ralph will pause after the current iteration completes.
   * The process can be resumed later with resume().
   */
  pause(): void {
    if (!this.process) {
      throw new Error("Ralph is not running")
    }
    if (this._status === "paused") {
      return // Already paused
    }
    if (this._status !== "running") {
      throw new Error(`Cannot pause ralph in ${this._status} state`)
    }

    this.send({ type: "pause" })
    this.setStatus("paused")
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

    this.send({ type: "resume" })
    this.setStatus("running")
  }

  /**
   * Request ralph to stop after completing the current task.
   * Sends the stop command via stdin which Ralph handles gracefully,
   * stopping after the current iteration completes.
   */
  stopAfterCurrent(): void {
    if (!this.process) {
      throw new Error("Ralph is not running")
    }
    if (this._status !== "running" && this._status !== "paused") {
      throw new Error(`Cannot stop-after-current ralph in ${this._status} state`)
    }

    // Send the stop signal to ralph via stdin - tells Ralph to stop after current iteration
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
      const event = JSON.parse(line) as RalphEvent
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
