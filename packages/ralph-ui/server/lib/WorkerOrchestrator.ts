import { EventEmitter } from "node:events"
import {
  WorkerLoop,
  type RunAgentResult,
  type WorkerState as WorkerLoopState,
} from "./WorkerLoop.js"
import { getWorkerName, type WorkerName } from "./workerNames.js"

/**
 * State of the orchestrator.
 */
export type OrchestratorState = "stopped" | "running" | "stopping"

/**
 * Options for creating a WorkerOrchestrator instance.
 */
export interface WorkerOrchestratorOptions {
  /** Maximum number of concurrent workers (default: 3) */
  maxWorkers?: number

  /** Path to the main workspace/repository */
  mainWorkspacePath: string

  /**
   * Function to run an agent session.
   * Receives the working directory.
   * The agent picks its own task via `bd ready` and claims it.
   * Returns a promise with the exit code and session ID.
   */
  runAgent: (cwd: string) => Promise<RunAgentResult>

  /**
   * Function to get the count of ready tasks.
   * Used to determine how many workers to spin up.
   */
  getReadyTasksCount: () => Promise<number>

  /**
   * Optional function to run tests after merge.
   * If not provided, tests are skipped.
   */
  runTests?: () => Promise<{ success: boolean; output?: string }>

  /**
   * How often to check for new tasks and spin up workers (ms).
   * Default: 5000ms
   */
  pollingInterval?: number
}

/**
 * Events emitted by WorkerOrchestrator.
 */
export interface WorkerOrchestratorEvents {
  /** Emitted when a worker starts */
  worker_started: [{ workerName: string }]

  /** Emitted when a worker stops (finishes or is terminated) */
  worker_stopped: [{ workerName: string; reason: "completed" | "stopped" | "error" }]

  /** Emitted when a worker is paused */
  worker_paused: [{ workerName: string }]

  /** Emitted when a worker is resumed */
  worker_resumed: [{ workerName: string }]

  /** Emitted when a worker starts a work iteration */
  work_started: [{ workerName: string; workId: string }]

  /** Emitted when a worker completes a work iteration */
  work_completed: [{ workerName: string; workId: string }]

  /** Emitted when orchestrator state changes */
  state_changed: [{ state: OrchestratorState }]

  /** Emitted on error */
  error: [{ workerName?: string; error: Error }]
}

/**
 * Information about a worker's current state.
 */
export interface WorkerInfo {
  workerName: string
  state: WorkerLoopState
  currentWorkId: string | null
}

/**
 * Internal state for a running worker.
 */
interface WorkerState {
  workerName: WorkerName
  loop: WorkerLoop
  isActive: boolean
}

/**
 * Orchestrates multiple concurrent Ralph workers.
 *
 * - Manages a pool of up to N workers (hard-coded count, default 3)
 * - Each worker runs its own loop independently
 * - Workers are spun up based on available ready tasks
 * - Agents pick their own tasks via `bd ready` and claim them
 * - Supports graceful shutdown (stop after current tasks complete)
 */
export class WorkerOrchestrator extends EventEmitter {
  private maxWorkers: number
  private mainWorkspacePath: string
  private runAgent: (cwd: string) => Promise<RunAgentResult>
  private getReadyTasksCount: () => Promise<number>
  private runTests?: () => Promise<{ success: boolean; output?: string }>
  private pollingInterval: number

  private state: OrchestratorState = "stopped"
  private workers = new Map<WorkerName, WorkerState>()
  private nextWorkerIndex = 0
  private pollingTimer: ReturnType<typeof setInterval> | null = null

  constructor(options: WorkerOrchestratorOptions) {
    super()
    this.maxWorkers = options.maxWorkers ?? 3
    this.mainWorkspacePath = options.mainWorkspacePath
    this.runAgent = options.runAgent
    this.getReadyTasksCount = options.getReadyTasksCount
    this.runTests = options.runTests
    this.pollingInterval = options.pollingInterval ?? 5000
  }

  /**
   * Type-safe event emitter methods.
   */
  override emit<K extends keyof WorkerOrchestratorEvents>(
    event: K,
    ...args: WorkerOrchestratorEvents[K]
  ): boolean {
    return super.emit(event, ...args)
  }

  override on<K extends keyof WorkerOrchestratorEvents>(
    event: K,
    listener: (...args: WorkerOrchestratorEvents[K]) => void,
  ): this {
    return super.on(event, listener as (...args: unknown[]) => void)
  }

  /**
   * Get the current orchestrator state.
   */
  getState(): OrchestratorState {
    return this.state
  }

  /**
   * Get the maximum number of workers.
   */
  getMaxWorkers(): number {
    return this.maxWorkers
  }

  /**
   * Get the number of currently active workers.
   */
  getActiveWorkerCount(): number {
    return Array.from(this.workers.values()).filter(w => w.isActive).length
  }

  /**
   * Get the names of all active workers.
   */
  getWorkerNames(): WorkerName[] {
    return Array.from(this.workers.values())
      .filter(w => w.isActive)
      .map(w => w.workerName)
  }

  /**
   * Start the orchestrator. Spins up workers based on available tasks.
   */
  async start(): Promise<void> {
    if (this.state === "running") {
      return // Already running
    }

    this.setState("running")

    // Initial spin-up of workers
    await this.checkAndSpinUpWorkers()

    // Start polling for new tasks
    this.startPolling()
  }

  /**
   * Stop all workers immediately.
   */
  async stop(): Promise<void> {
    if (this.state === "stopped") {
      return
    }

    this.stopPolling()

    // Force stop all workers
    for (const worker of this.workers.values()) {
      if (worker.isActive) {
        worker.loop.forceStop()
        worker.isActive = false
        this.emit("worker_stopped", { workerName: worker.workerName, reason: "stopped" })
      }
    }

    this.workers.clear()
    this.setState("stopped")
  }

  /**
   * Stop after all current tasks complete.
   * Workers will finish their current task, then not pick up new ones.
   */
  stopAfterCurrent(): void {
    if (this.state !== "running") {
      return
    }

    this.setState("stopping")
    this.stopPolling()

    // Tell all workers to stop after their current task
    for (const worker of this.workers.values()) {
      if (worker.isActive) {
        worker.loop.stop()
      }
    }
  }

  /**
   * Check available tasks and spin up workers as needed.
   */
  private async checkAndSpinUpWorkers(): Promise<void> {
    if (this.state !== "running") {
      return
    }

    try {
      const readyCount = await this.getReadyTasksCount()
      const activeCount = this.getActiveWorkerCount()
      const workersNeeded = Math.min(readyCount, this.maxWorkers) - activeCount

      if (workersNeeded <= 0) {
        return
      }

      // Spin up the needed workers
      const spinUpPromises: Promise<void>[] = []
      for (let i = 0; i < workersNeeded; i++) {
        spinUpPromises.push(this.spinUpWorker())
      }

      await Promise.all(spinUpPromises)
    } catch (error) {
      this.emit("error", { error: error instanceof Error ? error : new Error(String(error)) })
    }
  }

  /**
   * Spin up a new worker.
   */
  private async spinUpWorker(): Promise<void> {
    if (this.state !== "running") {
      return
    }

    const workerName = this.getNextWorkerName()

    // Check if this worker is already active
    if (this.workers.has(workerName) && this.workers.get(workerName)!.isActive) {
      return
    }

    const loop = new WorkerLoop({
      workerName,
      mainWorkspacePath: this.mainWorkspacePath,
      runAgent: this.runAgent,
      runTests: this.runTests,
    })

    const workerState: WorkerState = {
      workerName,
      loop,
      isActive: true,
    }

    this.workers.set(workerName, workerState)
    this.emit("worker_started", { workerName })

    // Wire up loop events
    loop.on("work_started", ({ workId }) => {
      this.emit("work_started", { workerName, workId })
    })

    loop.on("work_completed", ({ workId }) => {
      this.emit("work_completed", { workerName, workId })
    })

    loop.on("error", error => {
      this.emit("error", { workerName, error })
    })

    loop.on("paused", () => {
      this.emit("worker_paused", { workerName })
    })

    loop.on("resumed", () => {
      this.emit("worker_resumed", { workerName })
    })

    // Run the loop (non-blocking)
    loop
      .runLoop()
      .then(() => {
        // Loop completed (either no more tasks or stopped)
        if (workerState.isActive) {
          workerState.isActive = false
          this.emit("worker_stopped", { workerName, reason: "completed" })
          this.workers.delete(workerName)

          // Check if all workers are done when stopping
          if (this.state === "stopping" && this.getActiveWorkerCount() === 0) {
            this.setState("stopped")
          }
        }
      })
      .catch(error => {
        workerState.isActive = false
        this.emit("error", {
          workerName,
          error: error instanceof Error ? error : new Error(String(error)),
        })
        this.emit("worker_stopped", { workerName, reason: "error" })
        this.workers.delete(workerName)

        // Check if all workers are done when stopping
        if (this.state === "stopping" && this.getActiveWorkerCount() === 0) {
          this.setState("stopped")
        }
      })
  }

  /**
   * Get the next worker name to use.
   */
  private getNextWorkerName(): WorkerName {
    // Find a name that's not currently in use
    for (let i = 0; i < this.maxWorkers * 2; i++) {
      const name = getWorkerName(this.nextWorkerIndex)
      this.nextWorkerIndex++
      if (!this.workers.has(name) || !this.workers.get(name)!.isActive) {
        return name
      }
    }
    // Fallback - this shouldn't happen in practice
    return getWorkerName(this.nextWorkerIndex++)
  }

  /**
   * Start the polling timer.
   */
  private startPolling(): void {
    if (this.pollingTimer) {
      return
    }

    this.pollingTimer = setInterval(async () => {
      await this.checkAndSpinUpWorkers()
    }, this.pollingInterval)
  }

  /**
   * Stop the polling timer.
   */
  private stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer)
      this.pollingTimer = null
    }
  }

  /**
   * Set the orchestrator state and emit event.
   */
  private setState(newState: OrchestratorState): void {
    if (this.state !== newState) {
      this.state = newState
      this.emit("state_changed", { state: newState })
    }
  }

  // ── Per-worker controls ──────────────────────────────────────────────

  /**
   * Pause a specific worker. The worker will complete its current Claude
   * process step but will wait before continuing.
   */
  pauseWorker(workerName: string): void {
    const worker = this.workers.get(workerName as WorkerName)
    if (worker && worker.isActive) {
      worker.loop.pause()
      this.emit("worker_paused", { workerName })
    }
  }

  /**
   * Resume a paused worker.
   */
  resumeWorker(workerName: string): void {
    const worker = this.workers.get(workerName as WorkerName)
    if (worker && worker.isActive && worker.loop.isPaused()) {
      worker.loop.resume()
      this.emit("worker_resumed", { workerName })
    }
  }

  /**
   * Stop a specific worker. The worker will be force-stopped immediately.
   */
  stopWorker(workerName: string): void {
    const worker = this.workers.get(workerName as WorkerName)
    if (worker && worker.isActive) {
      worker.loop.forceStop()
      worker.isActive = false
      this.emit("worker_stopped", { workerName, reason: "stopped" })
      this.workers.delete(workerName as WorkerName)
    }
  }

  /**
   * Get the state of a specific worker.
   * Returns null if the worker doesn't exist.
   */
  getWorkerState(workerName: string): WorkerLoopState | null {
    const worker = this.workers.get(workerName as WorkerName)
    if (!worker || !worker.isActive) {
      return null
    }
    return worker.loop.getState()
  }

  /**
   * Get the states of all active workers.
   */
  getWorkerStates(): Record<string, WorkerInfo> {
    const states: Record<string, WorkerInfo> = {}
    for (const [name, worker] of this.workers) {
      if (worker.isActive) {
        states[name] = {
          workerName: name,
          state: worker.loop.getState(),
          currentWorkId: worker.loop.getCurrentWorkId(),
        }
      }
    }
    return states
  }
}
