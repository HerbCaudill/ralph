import { EventEmitter } from "node:events"
import { spawn } from "node:child_process"
import {
  WorkerOrchestrator,
  type WorkerOrchestratorEvents,
  type OrchestratorState,
  type WorkerInfo,
} from "./WorkerOrchestrator.js"
import { type RunAgentResult } from "./WorkerLoop.js"
import type { ChatSessionManager } from "../ChatSessionManager.js"
import { loadSessionPrompt, TEMPLATES_DIR } from "@herbcaudill/ralph-shared/prompts"

/**
 * Task source callbacks for providing task availability info to the orchestrator.
 * The orchestrator uses this to decide how many workers to spin up.
 * Agents pick and claim their own tasks at runtime.
 */
export interface TaskSource {
  /**
   * Get the count of ready tasks.
   * Used to determine how many workers to spin up.
   */
  getReadyTasksCount: () => Promise<number>
}

/**
 * Options for creating a WorkerOrchestratorManager instance.
 */
export interface WorkerOrchestratorManagerOptions {
  /** Maximum number of concurrent workers (default: 3) */
  maxWorkers?: number

  /** Path to the main workspace/repository */
  mainWorkspacePath: string

  /** Task source callbacks for checking task availability */
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
  runAgent?: (cwd: string) => Promise<RunAgentResult>
}

/**
 * Events emitted by WorkerOrchestratorManager.
 * Extends WorkerOrchestratorEvents with manager-specific events.
 */
export interface WorkerOrchestratorManagerEvents extends WorkerOrchestratorEvents {
  /** Emitted when task source fails */
  task_source_error: [{ error: Error }]

  /** Emitted when a session is created for a worker */
  session_created: [{ workerName: string; sessionId: string }]
}

/**
 * Manages a WorkerOrchestrator with integrated task source and session management.
 *
 * This class provides the glue between:
 * - WorkerOrchestrator (manages concurrent workers)
 * - Task source (provides ready task count for capacity planning)
 * - ChatSessionManager (creates agent sessions with event streaming)
 *
 * Agents pick their own tasks at runtime via `bd ready` and claim them.
 * The orchestrator only uses task count for deciding how many workers to spin up.
 */
export class WorkerOrchestratorManager extends EventEmitter {
  private orchestrator: WorkerOrchestrator
  private taskSource: TaskSource
  private mainWorkspacePath: string
  private app: string
  private runTestsEnabled: boolean
  private sessionManager?: ChatSessionManager
  private customRunAgent?: (cwd: string) => Promise<RunAgentResult>

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
      runAgent: cwd => this.runAgentSession(cwd),
      getReadyTasksCount: () => this.getReadyTasksCount(),
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
      "work_started",
      "work_completed",
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

  // ── Agent Session ─────────────────────────────────────────────────────

  /**
   * Run an agent session in the given directory.
   * The agent picks its own task via `bd ready` and claims it.
   */
  private async runAgentSession(
    /** Working directory for the agent */
    cwd: string,
  ): Promise<RunAgentResult> {
    // Use custom run function if provided
    if (this.customRunAgent) {
      return this.customRunAgent(cwd)
    }

    // Create session via ChatSessionManager
    if (!this.sessionManager) {
      throw new Error(
        "No session manager configured. Provide either sessionManager or runAgent option.",
      )
    }

    // Extract worker name from worktree path
    // Path format: {basePath}/{workerName}/{workId}
    const workerName = this.extractWorkerNameFromPath(cwd)

    // Create a new session
    const result = await this.sessionManager.createSession({
      cwd,
      app: workerName,
      workspace: null, // Don't derive workspace from worktree path
    })
    const sessionId = result.sessionId

    // Emit session_created event
    this.emit("session_created", { workerName, sessionId })

    // Load the Ralph prompt (agent picks its own task via bd ready)
    const promptResult = loadSessionPrompt({
      templatesDir: TEMPLATES_DIR,
      cwd,
    })

    // Send just the Ralph prompt - no task assignment
    await this.sessionManager.sendMessage(sessionId, promptResult.content, {
      isSystemPrompt: true,
    })

    // Wait for session to complete (status becomes idle or stopped)
    await this.waitForSessionCompletion(sessionId)

    return { exitCode: 0, sessionId }
  }

  /**
   * Extract worker name from a worktree path.
   * Path format: {basePath}/{workerName}/{workId}
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
