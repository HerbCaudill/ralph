import { EventEmitter } from "node:events"
import { WorktreeManager, type CleanupResult } from "./WorktreeManager.js"

/**
 * Result of running tests.
 */
export interface TestResult {
  success: boolean
  output?: string
}

/**
 * Context provided to the onMergeConflict handler.
 */
export interface MergeConflictContext {
  workId: string
  workerName: string
  worktreePath: string
  conflictingFiles: string[]
}

/**
 * Result of running an agent session.
 */
export interface RunAgentResult {
  exitCode: number
  sessionId: string
}

/**
 * Options for creating a WorkerLoop instance.
 */
export interface WorkerLoopOptions {
  /** The worker's name (e.g., "homer", "marge") */
  workerName: string

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
   * Optional function to run tests after merge.
   * If not provided, tests are skipped.
   */
  runTests?: () => Promise<TestResult>

  /**
   * Optional callback when a merge conflict occurs.
   * The callback should resolve the conflict and return "resolved" to retry,
   * or "abort" to give up on this task.
   *
   * If not provided, merge conflicts are retried by re-running the agent
   * in the worktree to let it resolve the conflict.
   */
  onMergeConflict?: (context: MergeConflictContext) => Promise<"resolved" | "abort">
}

/**
 * State of a worker.
 */
export type WorkerState = "idle" | "running" | "paused"

/**
 * Events emitted by WorkerLoop.
 */
export interface WorkerLoopEvents {
  /** Emitted when no tasks are available (caller determined) */
  idle: []

  /** Emitted when a work iteration starts */
  work_started: [{ workId: string }]

  /** Emitted when a worktree is created for a work iteration */
  worktree_created: [{ workId: string; worktreePath: string }]

  /** Emitted when an agent session starts */
  agent_started: [{ workId: string; sessionId: string }]

  /** Emitted when an agent session completes */
  agent_completed: [{ workId: string; exitCode: number; sessionId: string }]

  /** Emitted when merge completes successfully */
  merge_completed: [{ workId: string }]

  /** Emitted when merge has conflicts */
  merge_conflict: [{ workId: string; hadConflicts: boolean; conflictingFiles: string[] }]

  /** Emitted when a work iteration is completed */
  work_completed: [{ workId: string }]

  /** Emitted when worker is paused */
  paused: [{ workId?: string }]

  /** Emitted when worker is resumed */
  resumed: []

  /** Emitted on error */
  error: [Error]
}

/**
 * The core worker loop that:
 * 1. Pulls latest main
 * 2. Creates a worktree with a work-specific branch
 * 3. Runs an agent session in the worktree (agent picks its own task)
 * 4. On completion, merges branch into main
 * 5. Resolves any merge conflicts via the agent
 * 6. Runs tests to verify clean merge
 * 7. Cleans up worktree and branch
 * 8. Repeats
 *
 * Worker never gives up on a work iteration - retries until successful.
 */
export class WorkerLoop extends EventEmitter {
  private workerName: string
  private mainWorkspacePath: string
  private worktreeManager: WorktreeManager
  private runAgent: (cwd: string) => Promise<RunAgentResult>
  private runTests?: () => Promise<TestResult>
  private onMergeConflict?: (context: MergeConflictContext) => Promise<"resolved" | "abort">
  private stopped = false
  private paused = false
  private pauseResolver: (() => void) | null = null
  private currentWorkId: string | null = null
  private state: WorkerState = "idle"
  private workCounter = 0

  constructor(options: WorkerLoopOptions) {
    super()
    this.workerName = options.workerName
    this.mainWorkspacePath = options.mainWorkspacePath
    this.worktreeManager = new WorktreeManager(options.mainWorkspacePath)
    this.runAgent = options.runAgent
    this.runTests = options.runTests
    this.onMergeConflict = options.onMergeConflict
  }

  /**
   * Type-safe event emitter methods.
   */
  override emit<K extends keyof WorkerLoopEvents>(event: K, ...args: WorkerLoopEvents[K]): boolean {
    return super.emit(event, ...args)
  }

  override on<K extends keyof WorkerLoopEvents>(
    event: K,
    listener: (...args: WorkerLoopEvents[K]) => void,
  ): this {
    return super.on(event, listener as (...args: unknown[]) => void)
  }

  /**
   * Run the loop continuously until stopped.
   */
  async runLoop(): Promise<void> {
    this.stopped = false
    this.state = "running"

    while (!this.stopped) {
      // Check if paused before starting next iteration
      await this.waitWhilePaused()
      if (this.stopped) break

      await this.runOnce()

      // Check if paused after completing work
      await this.waitWhilePaused()
    }

    this.state = "idle"
  }

  /**
   * Run a single work iteration.
   * Creates a worktree, runs the agent (which picks its own task), merges, and cleans up.
   */
  async runOnce(): Promise<void> {
    const workId = this.generateWorkId()

    try {
      this.currentWorkId = workId
      this.emit("work_started", { workId })

      // 1. Pull latest main
      await this.worktreeManager.pullLatest()

      // 2. Create worktree with work-specific branch
      const worktree = await this.worktreeManager.create({
        workerName: this.workerName,
        taskId: workId, // WorktreeManager uses "taskId" but we pass workId
      })
      this.emit("worktree_created", { workId, worktreePath: worktree.path })

      // 3. Run agent in the worktree (agent picks its own task)
      await this.runAgentWithRetry(workId, worktree.path)

      // 4. Work iteration complete
      this.currentWorkId = null
      this.emit("work_completed", { workId })
    } catch (error) {
      this.currentWorkId = null
      this.emit("error", error instanceof Error ? error : new Error(String(error)))
    }
  }

  /**
   * Run the agent and handle merge/test failures with retry.
   * Worker never gives up - keeps retrying until successful.
   */
  private async runAgentWithRetry(
    /** Unique identifier for this work iteration */
    workId: string,
    /** The worktree path where the agent runs */
    worktreePath: string,
  ): Promise<void> {
    let success = false

    while (!success && !this.stopped) {
      // Run the agent session
      this.emit("agent_started", { workId, sessionId: "" })
      const result = await this.runAgent(worktreePath)
      this.emit("agent_completed", {
        workId,
        exitCode: result.exitCode,
        sessionId: result.sessionId,
      })

      if (result.exitCode !== 0) {
        this.emit("error", new Error(`Agent exited with code ${result.exitCode}`))
        // Continue to try merge anyway - agent may have made useful changes
      }

      // Attempt to merge
      const mergeResult = await this.worktreeManager.merge(this.workerName, workId)

      if (mergeResult.hadConflicts) {
        const conflictingFiles = await this.worktreeManager.getConflictingFiles()
        this.emit("merge_conflict", {
          workId,
          hadConflicts: true,
          conflictingFiles,
        })

        // Handle conflict
        if (this.onMergeConflict) {
          const resolution = await this.onMergeConflict({
            workId,
            workerName: this.workerName,
            worktreePath,
            conflictingFiles,
          })

          if (resolution === "abort") {
            await this.worktreeManager.abortMerge()
            throw new Error("Merge conflict could not be resolved")
          }

          // Conflict was resolved - abort current merge and retry with new changes
          await this.worktreeManager.abortMerge()
          continue // Retry the loop
        } else {
          // Default behavior: abort merge and let agent try again
          await this.worktreeManager.abortMerge()
          continue // Retry the loop
        }
      }

      if (!mergeResult.success) {
        this.emit("error", new Error(mergeResult.message))
        continue // Retry
      }

      this.emit("merge_completed", { workId })

      // Run tests if configured
      if (this.runTests) {
        const testResult = await this.runTests()

        if (!testResult.success) {
          this.emit("error", new Error(`Tests failed: ${testResult.output}`))
          // Tests failed - need to revert merge and let agent fix
          continue
        }
      }

      // Cleanup worktree (already merged)
      await this.worktreeManager.remove(this.workerName, workId)

      success = true
    }
  }

  /**
   * Stop the loop after the current work iteration completes.
   */
  stop(): void {
    this.stopped = true
  }

  /**
   * Force stop the worker loop immediately.
   */
  forceStop(): void {
    this.stopped = true
  }

  /**
   * Pause the worker loop. The worker will complete the current agent session
   * but will wait before continuing to the next step or work iteration.
   */
  pause(): void {
    if (this.paused) return
    this.paused = true
    this.state = "paused"
    this.emit("paused", { workId: this.currentWorkId ?? undefined })
  }

  /**
   * Resume the worker loop from a paused state.
   */
  resume(): void {
    if (!this.paused) return
    this.paused = false
    this.state = "running"
    this.emit("resumed")
    if (this.pauseResolver) {
      this.pauseResolver()
      this.pauseResolver = null
    }
  }

  /**
   * Check if the worker is currently paused.
   */
  isPaused(): boolean {
    return this.paused
  }

  /**
   * Get the current state of the worker.
   */
  getState(): WorkerState {
    return this.state
  }

  /**
   * Get the current work ID (if any).
   */
  getCurrentWorkId(): string | null {
    return this.currentWorkId
  }

  /**
   * Generate a unique work ID for a work iteration.
   * Format: {counter}-{timestamp} to ensure uniqueness and sorting.
   */
  private generateWorkId(): string {
    this.workCounter++
    return `${this.workCounter}-${Date.now()}`
  }

  /**
   * Wait while paused. Returns a promise that resolves when resumed or stopped.
   */
  private async waitWhilePaused(): Promise<void> {
    while (this.paused && !this.stopped) {
      await new Promise<void>(resolve => {
        this.pauseResolver = resolve
        // Also set a timeout to re-check periodically in case of edge cases
        setTimeout(() => {
          if (this.pauseResolver === resolve) {
            this.pauseResolver = null
            resolve()
          }
        }, 100)
      })
    }
  }
}
