import { EventEmitter } from "node:events"
import type { ChildProcess } from "node:child_process"
import { WorktreeManager, type CleanupResult } from "./WorktreeManager.js"

/**
 * Represents a task ready for work.
 */
export interface ReadyTask {
  id: string
  title: string
}

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
  taskId: string
  workerName: string
  worktreePath: string
  conflictingFiles: string[]
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
   * Function to spawn a Claude CLI process.
   * Receives the working directory (worktree path) where Claude should run.
   * Should return a ChildProcess.
   */
  spawnClaude: (cwd: string) => ChildProcess

  /**
   * Function to get the next ready task for this worker.
   * Should return null if no tasks are available.
   */
  getReadyTask: () => Promise<ReadyTask | null>

  /**
   * Function to claim a task (mark it as in_progress with this worker as assignee).
   */
  claimTask: (taskId: string) => Promise<void>

  /**
   * Function to close/complete a task.
   */
  closeTask: (taskId: string) => Promise<void>

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
   * If not provided, merge conflicts are retried by re-running Claude
   * in the worktree to let the agent resolve the conflict.
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
  /** Emitted when no tasks are available */
  idle: []

  /** Emitted when a task is started */
  task_started: [{ taskId: string; title: string }]

  /** Emitted when a worktree is created for a task */
  worktree_created: [{ taskId: string; worktreePath: string }]

  /** Emitted when Claude process starts */
  claude_started: [{ taskId: string; pid: number }]

  /** Emitted when Claude process completes */
  claude_completed: [{ taskId: string; exitCode: number }]

  /** Emitted when merge completes successfully */
  merge_completed: [{ taskId: string }]

  /** Emitted when merge has conflicts */
  merge_conflict: [{ taskId: string; hadConflicts: boolean; conflictingFiles: string[] }]

  /** Emitted when tests pass */
  tests_passed: [{ taskId: string }]

  /** Emitted when tests fail */
  tests_failed: [{ success: boolean; output?: string }]

  /** Emitted when a task is completed */
  task_completed: [{ taskId: string }]

  /** Emitted when worker is paused */
  paused: [{ taskId?: string }]

  /** Emitted when worker is resumed */
  resumed: []

  /** Emitted on error */
  error: [Error]
}

/**
 * The core worker loop that:
 * 1. Pulls latest main
 * 2. Creates a worktree with a task-specific branch
 * 3. Spawns Claude CLI in the worktree
 * 4. On completion, merges branch into main
 * 5. Resolves any merge conflicts via the agent
 * 6. Runs tests to verify clean merge
 * 7. Cleans up worktree and branch
 * 8. Repeats
 *
 * Worker never gives up on a task - retries until successful.
 */
export class WorkerLoop extends EventEmitter {
  private workerName: string
  private mainWorkspacePath: string
  private worktreeManager: WorktreeManager
  private spawnClaude: (cwd: string) => ChildProcess
  private getReadyTask: () => Promise<ReadyTask | null>
  private claimTask: (taskId: string) => Promise<void>
  private closeTask: (taskId: string) => Promise<void>
  private runTests?: () => Promise<TestResult>
  private onMergeConflict?: (context: MergeConflictContext) => Promise<"resolved" | "abort">
  private stopped = false
  private paused = false
  private pauseResolver: (() => void) | null = null
  private currentProcess: ChildProcess | null = null
  private currentTaskId: string | null = null
  private state: WorkerState = "idle"

  constructor(options: WorkerLoopOptions) {
    super()
    this.workerName = options.workerName
    this.mainWorkspacePath = options.mainWorkspacePath
    this.worktreeManager = new WorktreeManager(options.mainWorkspacePath)
    this.spawnClaude = options.spawnClaude
    this.getReadyTask = options.getReadyTask
    this.claimTask = options.claimTask
    this.closeTask = options.closeTask
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
   * Run the loop continuously until stopped or no more tasks.
   */
  async runLoop(): Promise<void> {
    this.stopped = false
    this.state = "running"

    while (!this.stopped) {
      // Check if paused before starting next iteration
      await this.waitWhilePaused()
      if (this.stopped) break

      const hadWork = await this.runOnce()
      if (!hadWork) {
        break
      }

      // Check if paused after completing a task
      await this.waitWhilePaused()
    }

    this.state = "idle"
  }

  /**
   * Run a single iteration of the worker loop.
   * Returns true if work was done, false if no tasks were available.
   */
  async runOnce(): Promise<boolean> {
    // 1. Check for available work
    const task = await this.getReadyTask()
    if (!task) {
      this.emit("idle")
      return false
    }

    try {
      // 2. Claim the task
      await this.claimTask(task.id)
      this.currentTaskId = task.id
      this.emit("task_started", { taskId: task.id, title: task.title })

      // 3. Pull latest main
      await this.worktreeManager.pullLatest()

      // 4. Create worktree with task-specific branch
      const worktree = await this.worktreeManager.create({
        workerName: this.workerName,
        taskId: task.id,
      })
      this.emit("worktree_created", { taskId: task.id, worktreePath: worktree.path })

      // 5. Spawn Claude CLI in the worktree
      await this.runClaudeWithRetry(task.id, worktree.path)

      // 6. Complete the task
      await this.closeTask(task.id)
      this.currentTaskId = null
      this.emit("task_completed", { taskId: task.id })

      return true
    } catch (error) {
      this.currentTaskId = null
      this.emit("error", error instanceof Error ? error : new Error(String(error)))
      return true // We did work, even if it failed
    }
  }

  /**
   * Run Claude and handle merge/test failures with retry.
   * Worker never gives up - keeps retrying until successful.
   */
  private async runClaudeWithRetry(taskId: string, worktreePath: string): Promise<void> {
    let success = false

    while (!success && !this.stopped) {
      // Spawn Claude
      const exitCode = await this.spawnClaudeProcess(taskId, worktreePath)

      if (exitCode !== 0) {
        this.emit("error", new Error(`Claude exited with code ${exitCode}`))
        // Continue to try merge anyway - Claude may have made useful changes
      }

      // Attempt to merge
      const mergeResult = await this.worktreeManager.merge(this.workerName, taskId)

      if (mergeResult.hadConflicts) {
        const conflictingFiles = await this.worktreeManager.getConflictingFiles()
        this.emit("merge_conflict", {
          taskId,
          hadConflicts: true,
          conflictingFiles,
        })

        // Handle conflict
        if (this.onMergeConflict) {
          const resolution = await this.onMergeConflict({
            taskId,
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
          // Default behavior: abort merge and let Claude try again
          await this.worktreeManager.abortMerge()
          continue // Retry the loop
        }
      }

      if (!mergeResult.success) {
        this.emit("error", new Error(mergeResult.message))
        continue // Retry
      }

      this.emit("merge_completed", { taskId })

      // Run tests if configured
      if (this.runTests) {
        const testResult = await this.runTests()

        if (!testResult.success) {
          this.emit("tests_failed", testResult)
          // Tests failed - need to revert merge and let Claude fix
          // For now, we continue anyway (TODO: implement proper revert)
          continue
        }

        this.emit("tests_passed", { taskId })
      }

      // Cleanup worktree (already merged)
      await this.worktreeManager.remove(this.workerName, taskId)

      success = true
    }
  }

  /**
   * Spawn Claude CLI process and wait for completion.
   * Returns the exit code.
   */
  private async spawnClaudeProcess(taskId: string, worktreePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const proc = this.spawnClaude(worktreePath)
      this.currentProcess = proc

      this.emit("claude_started", { taskId, pid: proc.pid ?? 0 })

      proc.on("close", code => {
        this.currentProcess = null
        const exitCode = code ?? 0
        this.emit("claude_completed", { taskId, exitCode })
        resolve(exitCode)
      })

      proc.on("error", error => {
        this.currentProcess = null
        reject(error)
      })
    })
  }

  /**
   * Stop the loop after the current task completes.
   */
  stop(): void {
    this.stopped = true
  }

  /**
   * Force stop by killing the current Claude process.
   */
  forceStop(): void {
    this.stopped = true
    if (this.currentProcess) {
      this.currentProcess.kill()
    }
  }

  /**
   * Pause the worker loop. The worker will complete the current Claude process
   * step but will wait before continuing to the next step or task.
   */
  pause(): void {
    if (this.paused) return
    this.paused = true
    this.state = "paused"
    this.emit("paused", { taskId: this.currentTaskId ?? undefined })
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
   * Get the current task ID (if any).
   */
  getCurrentTaskId(): string | null {
    return this.currentTaskId
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
