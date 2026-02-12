import { EventEmitter } from "node:events"
import { spawn } from "node:child_process"
import {
  WorkerOrchestrator,
  type WorkerOrchestratorEvents,
  type OrchestratorState,
  type WorkerInfo,
} from "./WorkerOrchestrator.js"
import { type ReadyTask, type RunAgentResult } from "./WorkerLoop.js"
import type { ChatSessionManager } from "../ChatSessionManager.js"
import { loadSessionPrompt, TEMPLATES_DIR } from "@herbcaudill/ralph-shared/prompts"

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
   * ChatSessionManager instance for creating agent sessions.
   * When provided, sessions are created via the session manager instead of spawning CLI directly.
   * This enables event streaming through the existing WebSocket pipeline.
   */
  sessionManager?: ChatSessionManager

  /**
   * Custom function to run an agent session.
   * If not provided and sessionManager is set, sessions are created via ChatSessionManager.
   * If neither is provided, throws an error.
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

  /** Emitted when a session is created for a worker */
  session_created: [{ workerName: string; sessionId: string; taskId: string }]
}

/**
 * Manages a WorkerOrchestrator with integrated task source and session management.
 *
 * This class provides the glue between:
 * - WorkerOrchestrator (manages concurrent workers)
 * - Task source (beads or other task/issue tracking system)
 * - ChatSessionManager (creates agent sessions with event streaming)
 *
 * It handles:
 * - Fetching ready tasks via provided callbacks
 * - Claiming and closing tasks
 * - Creating agent sessions via ChatSessionManager
 * - Running tests (optional)
 */
export class WorkerOrchestratorManager extends EventEmitter {
  private orchestrator: WorkerOrchestrator
  private taskSource: TaskSource
  private mainWorkspacePath: string
  private app: string
  private runTestsEnabled: boolean
  private sessionManager?: ChatSessionManager
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
    this.sessionManager = options.sessionManager
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

    // Create session via ChatSessionManager
    if (!this.sessionManager) {
      throw new Error(
        "No session manager configured. Provide either sessionManager or runAgent option.",
      )
    }

    // Extract worker name from worktree path
    // Path format: {basePath}/{workerName}/{taskId}
    const workerName = this.extractWorkerNameFromPath(cwd)

    // Create the session
    const { sessionId } = await this.sessionManager.createSession({
      cwd,
      app: this.app,
    })

    // Emit session_created event so UI can refresh session list
    this.emit("session_created", { workerName, sessionId, taskId })

    // Load the Ralph prompt and send it with task assignment
    const promptResult = loadSessionPrompt({
      templatesDir: TEMPLATES_DIR,
      cwd,
    })
    const prompt = `${promptResult.content}\n\nYour assigned task: ${taskTitle}`

    // Send the prompt (this is the system prompt for the session)
    await this.sessionManager.sendMessage(sessionId, prompt, {
      isSystemPrompt: true,
    })

    // Wait for session to complete (status becomes idle or stopped)
    await this.waitForSessionCompletion(sessionId)

    return { exitCode: 0, sessionId }
  }

  /**
   * Extract worker name from a worktree path.
   * Path format: {basePath}/{workerName}/{taskId}
   */
  private extractWorkerNameFromPath(worktreePath: string): string {
    // Split path and get second-to-last component
    const parts = worktreePath.split("/").filter(Boolean)
    if (parts.length >= 2) {
      return parts[parts.length - 2]
    }
    return "unknown"
  }

  /**
   * Wait for a session to complete (status becomes idle or stopped).
   */
  private waitForSessionCompletion(sessionId: string): Promise<void> {
    return new Promise(resolve => {
      const checkStatus = () => {
        const info = this.sessionManager?.getSessionInfo(sessionId)
        if (!info || info.status === "idle" || info.status === "error") {
          this.sessionManager?.off("status", onStatus)
          resolve()
        }
      }

      const onStatus = (sid: string, status: string) => {
        if (
          sid === sessionId &&
          (status === "idle" || status === "error" || status === "stopped")
        ) {
          this.sessionManager?.off("status", onStatus)
          resolve()
        }
      }

      // Listen for status changes
      this.sessionManager?.on("status", onStatus)

      // Also check current status in case it's already idle
      checkStatus()
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
