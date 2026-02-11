import { EventEmitter } from "node:events"
import { spawn } from "node:child_process"
import {
  WorkerOrchestrator,
  type WorkerOrchestratorEvents,
  type OrchestratorState,
  type WorkerInfo,
} from "./WorkerOrchestrator.js"
import { type ReadyTask, type RunAgentResult } from "./WorkerLoop.js"
import { findClaudeExecutable } from "../findClaudeExecutable.js"

/**
 * Task source callbacks for providing ready tasks to the orchestrator.
 * These abstract away the beads integration so the manager doesn't need
 * to know about beads directly.
 */
export interface TaskSource {
  /**
   * Get the count of ready tasks.
   * Used to determine how many workers to spin up.
   */
  getReadyTasksCount: () => Promise<number>

  /**
   * Get the next ready task for a specific worker.
   * Should return null if no tasks are available.
   * Should filter for tasks that are unassigned or assigned to this worker.
   */
  getReadyTask: (workerName: string) => Promise<ReadyTask | null>

  /**
   * Claim a task (mark it as in_progress with this worker as assignee).
   */
  claimTask: (taskId: string, workerName: string) => Promise<void>

  /**
   * Close/complete a task.
   */
  closeTask: (taskId: string) => Promise<void>
}

/**
 * Options for creating a WorkerOrchestratorManager instance.
 */
export interface WorkerOrchestratorManagerOptions {
  /** Maximum number of concurrent workers (default: 3) */
  maxWorkers?: number

  /** Path to the main workspace/repository */
  mainWorkspacePath: string

  /** Task source callbacks for fetching and managing tasks */
  taskSource: TaskSource

  /** App/prompt name for this orchestrator instance */
  app?: string

  /** How often to check for new tasks (ms). Default: 5000 */
  pollingInterval?: number

  /** Whether to run tests after merging (default: false) */
  runTests?: boolean

  /**
   * Custom function to run an agent session.
   * If not provided, defaults to spawning the Claude CLI with --print flag.
   */
  runAgent?: (cwd: string, taskId: string, taskTitle: string) => Promise<RunAgentResult>
}

/**
 * Events emitted by WorkerOrchestratorManager.
 * Extends WorkerOrchestratorEvents with manager-specific events.
 */
export interface WorkerOrchestratorManagerEvents extends WorkerOrchestratorEvents {
  /** Emitted when task source fails */
  task_source_error: [{ error: Error }]
}

/**
 * Manages a WorkerOrchestrator with integrated task source and Claude spawning.
 *
 * This class provides the glue between:
 * - WorkerOrchestrator (manages concurrent workers)
 * - Task source (beads or other task/issue tracking system)
 * - Claude CLI (the agent)
 *
 * It handles:
 * - Fetching ready tasks via provided callbacks
 * - Claiming and closing tasks
 * - Spawning Claude CLI processes
 * - Running tests (optional)
 */
export class WorkerOrchestratorManager extends EventEmitter {
  private orchestrator: WorkerOrchestrator
  private taskSource: TaskSource
  private mainWorkspacePath: string
  private app: string
  private runTestsEnabled: boolean
  private customRunAgent?: (
    cwd: string,
    taskId: string,
    taskTitle: string,
  ) => Promise<RunAgentResult>

  constructor(options: WorkerOrchestratorManagerOptions) {
    super()

    this.mainWorkspacePath = options.mainWorkspacePath
    this.taskSource = options.taskSource
    this.app = options.app ?? "ralph"
    this.runTestsEnabled = options.runTests ?? false
    this.customRunAgent = options.runAgent

    // Create orchestrator with task source callbacks
    this.orchestrator = new WorkerOrchestrator({
      maxWorkers: options.maxWorkers ?? 3,
      mainWorkspacePath: this.mainWorkspacePath,
      pollingInterval: options.pollingInterval ?? 5000,
      runAgent: (cwd, taskId, taskTitle) => this.runAgentSession(cwd, taskId, taskTitle),
      getReadyTasksCount: () => this.getReadyTasksCount(),
      getReadyTask: workerName => this.getReadyTask(workerName),
      claimTask: (taskId, workerName) => this.claimTask(taskId, workerName),
      closeTask: taskId => this.closeTask(taskId),
      runTests: this.runTestsEnabled ? () => this.runTests() : undefined,
    })

    // Forward all orchestrator events
    this.forwardEvents()
  }

  /**
   * Forward events from the underlying orchestrator to this manager.
   */
  private forwardEvents(): void {
    const events: Array<keyof WorkerOrchestratorEvents> = [
      "worker_started",
      "worker_stopped",
      "worker_paused",
      "worker_resumed",
      "task_started",
      "task_completed",
      "state_changed",
      "error",
    ]

    for (const event of events) {
      this.orchestrator.on(event, (...args: unknown[]) => {
        // @ts-expect-error - forwarding events with dynamic types
        this.emit(event, ...args)
      })
    }
  }

  /**
   * Type-safe event emitter methods.
   */
  override emit<K extends keyof WorkerOrchestratorManagerEvents>(
    event: K,
    ...args: WorkerOrchestratorManagerEvents[K]
  ): boolean {
    return super.emit(event, ...args)
  }

  override on<K extends keyof WorkerOrchestratorManagerEvents>(
    event: K,
    listener: (...args: WorkerOrchestratorManagerEvents[K]) => void,
  ): this {
    return super.on(event, listener as (...args: unknown[]) => void)
  }

  // ── Task Source Wrappers ──────────────────────────────────────────────

  /**
   * Get the count of ready tasks from task source.
   */
  private async getReadyTasksCount(): Promise<number> {
    try {
      return await this.taskSource.getReadyTasksCount()
    } catch (error) {
      this.emit("task_source_error", {
        error: error instanceof Error ? error : new Error(String(error)),
      })
      return 0
    }
  }

  /**
   * Get the next ready task for a worker.
   */
  private async getReadyTask(workerName: string): Promise<ReadyTask | null> {
    try {
      return await this.taskSource.getReadyTask(workerName)
    } catch (error) {
      this.emit("task_source_error", {
        error: error instanceof Error ? error : new Error(String(error)),
      })
      return null
    }
  }

  /**
   * Claim a task by updating its status and assignee.
   */
  private async claimTask(taskId: string, workerName: string): Promise<void> {
    await this.taskSource.claimTask(taskId, workerName)
  }

  /**
   * Close a task after completion.
   */
  private async closeTask(taskId: string): Promise<void> {
    await this.taskSource.closeTask(taskId)
  }

  // ── Agent Session ─────────────────────────────────────────────────────

  /**
   * Run an agent session in the given directory.
   */
  private async runAgentSession(
    /** Working directory for the agent */
    cwd: string,
    /** The task ID */
    taskId: string,
    /** The task title */
    taskTitle: string,
  ): Promise<RunAgentResult> {
    // Use custom run function if provided
    if (this.customRunAgent) {
      return this.customRunAgent(cwd, taskId, taskTitle)
    }

    const claudeExecutable = findClaudeExecutable()
    if (!claudeExecutable) {
      throw new Error("Claude executable not found")
    }

    // Spawn Claude with the Ralph app prompt
    return new Promise((resolve, reject) => {
      const proc = spawn(claudeExecutable, ["--print", "--dangerously-skip-permissions"], {
        cwd,
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          // Pass the app name for prompt loading
          CLAUDE_APP: this.app,
        },
      })

      proc.on("close", code => {
        resolve({ exitCode: code ?? 0, sessionId: "" })
      })

      proc.on("error", error => {
        reject(error)
      })
    })
  }

  // ── Test Runner ───────────────────────────────────────────────────────

  /**
   * Run tests in the main workspace.
   */
  private async runTests(): Promise<{ success: boolean; output?: string }> {
    return new Promise(resolve => {
      const proc = spawn("pnpm", ["test"], {
        cwd: this.mainWorkspacePath,
        stdio: ["ignore", "pipe", "pipe"],
      })

      let output = ""
      proc.stdout.on("data", (data: Buffer) => {
        output += data.toString()
      })
      proc.stderr.on("data", (data: Buffer) => {
        output += data.toString()
      })

      proc.on("close", (code: number | null) => {
        resolve({
          success: code === 0,
          output,
        })
      })

      proc.on("error", (error: Error) => {
        resolve({
          success: false,
          output: error.message,
        })
      })
    })
  }

  // ── Orchestrator Control ──────────────────────────────────────────────

  /**
   * Start the orchestrator.
   */
  async start(): Promise<void> {
    await this.orchestrator.start()
  }

  /**
   * Stop all workers immediately.
   */
  async stop(): Promise<void> {
    await this.orchestrator.stop()
  }

  /**
   * Stop after all current tasks complete.
   */
  stopAfterCurrent(): void {
    this.orchestrator.stopAfterCurrent()
  }

  /**
   * Cancel a pending stop-after-current request.
   * Resumes normal operation if the orchestrator was stopping.
   */
  async cancelStopAfterCurrent(): Promise<void> {
    // If stopping, restart the orchestrator
    if (this.orchestrator.getState() === "stopping") {
      await this.orchestrator.start()
    }
  }

  /**
   * Get the current orchestrator state.
   */
  getState(): OrchestratorState {
    return this.orchestrator.getState()
  }

  /**
   * Get the maximum number of workers.
   */
  getMaxWorkers(): number {
    return this.orchestrator.getMaxWorkers()
  }

  /**
   * Get the number of currently active workers.
   */
  getActiveWorkerCount(): number {
    return this.orchestrator.getActiveWorkerCount()
  }

  /**
   * Get the names of all active workers.
   */
  getWorkerNames(): string[] {
    return this.orchestrator.getWorkerNames()
  }

  /**
   * Get the states of all active workers.
   */
  getWorkerStates(): Record<string, WorkerInfo> {
    return this.orchestrator.getWorkerStates()
  }

  // ── Per-Worker Controls ───────────────────────────────────────────────

  /**
   * Pause a specific worker.
   */
  pauseWorker(workerName: string): void {
    this.orchestrator.pauseWorker(workerName)
  }

  /**
   * Resume a paused worker.
   */
  resumeWorker(workerName: string): void {
    this.orchestrator.resumeWorker(workerName)
  }

  /**
   * Stop a specific worker.
   */
  stopWorker(workerName: string): void {
    this.orchestrator.stopWorker(workerName)
  }

  /**
   * Get the state of a specific worker.
   */
  getWorkerState(workerName: string): "idle" | "running" | "paused" | null {
    return this.orchestrator.getWorkerState(workerName)
  }
}
