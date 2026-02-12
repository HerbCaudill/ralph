import { spawn } from "node:child_process"
import { stat, mkdir } from "node:fs/promises"
import { join, dirname, basename } from "node:path"

/**
 * Manages git worktrees for concurrent Ralph workers.
 *
 * Each worker gets its own worktree in a sibling folder,
 * allowing parallel work without conflicts:
 *
 * ```
 * project/                     # Main worktree (main branch)
 * project-worktrees/           # Sibling folder
 *   homer/                     # Worker folder
 *     bd-abc123/               # Worktree for task (branch: ralph/homer/bd-abc123)
 *   marge/                     # Another worker
 *     bd-def456/               # Another worktree (branch: ralph/marge/bd-def456)
 * ```
 */
export class WorktreeManager {
  private mainWorkspacePath: string
  private worktreesBasePath: string

  constructor(mainWorkspacePath: string) {
    this.mainWorkspacePath = mainWorkspacePath
    // Worktrees stored in sibling folder: {project}-worktrees/
    const projectName = basename(mainWorkspacePath)
    this.worktreesBasePath = join(dirname(mainWorkspacePath), `${projectName}-worktrees`)
  }

  /**
   * Get the path to the worktrees base directory.
   */
  getWorktreesBasePath(): string {
    return this.worktreesBasePath
  }

  /**
   * Get the path for a specific worker's task worktree.
   */
  getWorktreePath(workerName: string, taskId: string): string {
    return join(this.worktreesBasePath, workerName, taskId)
  }

  /**
   * Get the branch name for a specific worker and task.
   * Format: ralph/<worker-name>/<task-id>
   */
  getBranchName(workerName: string, taskId: string): string {
    return `ralph/${workerName}/${taskId}`
  }

  /**
   * Pull latest changes from remote (if configured).
   * Silently succeeds if no remote is configured.
   */
  async pullLatest(): Promise<void> {
    try {
      // Check if remote exists
      const remotes = await this.git(["remote"])
      if (!remotes.trim()) {
        return // No remote configured
      }

      // Fetch and merge
      await this.git(["pull", "--ff-only"])
    } catch {
      // Ignore pull errors (no remote, no tracking branch, etc.)
    }
  }

  /**
   * Create a new worktree for a worker's task.
   * Pulls latest main before creating the worktree.
   */
  async create(options: CreateWorktreeOptions): Promise<WorktreeInfo> {
    const { workerName, taskId } = options
    const worktreePath = this.getWorktreePath(workerName, taskId)
    const branchName = this.getBranchName(workerName, taskId)

    // Ensure the worktrees directory exists (including worker subdirectory)
    await this.ensureWorktreesDirectory(workerName)

    // Pull latest main before branching
    await this.pullLatest()

    // Create the worktree with a new branch
    await this.git(["worktree", "add", worktreePath, "-b", branchName])

    return {
      path: worktreePath,
      branch: branchName,
      workerName,
      taskId,
    }
  }

  /**
   * Merge the worktree branch back to main.
   */
  async merge(workerName: string, taskId: string): Promise<MergeResult> {
    const branchName = this.getBranchName(workerName, taskId)

    try {
      // First, make sure we're on main
      const mainBranch = await this.getMainBranch()
      await this.git(["checkout", mainBranch])

      // Attempt to merge
      await this.git(["merge", branchName, "--no-ff", "-m", `Merge ${branchName}`])

      return {
        success: true,
        hadConflicts: false,
        message: `Successfully merged ${branchName} to ${mainBranch}`,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Check if it's a merge conflict
      if (errorMessage.includes("CONFLICT") || errorMessage.includes("Automatic merge failed")) {
        return {
          success: false,
          hadConflicts: true,
          message: `Merge conflicts detected in ${branchName}`,
        }
      }

      return {
        success: false,
        hadConflicts: false,
        message: `Merge failed: ${errorMessage}`,
      }
    }
  }

  /**
   * Get a list of files with merge conflicts.
   * Returns an empty array if no merge is in progress or no conflicts exist.
   */
  async getConflictingFiles(): Promise<string[]> {
    try {
      const output = await this.git(["diff", "--name-only", "--diff-filter=U"])
      if (!output.trim()) {
        return []
      }
      return output.trim().split("\n")
    } catch {
      return []
    }
  }

  /**
   * Check if a merge is currently in progress.
   */
  async isMergeInProgress(): Promise<boolean> {
    try {
      // Check for MERGE_HEAD file which indicates a merge is in progress
      await this.git(["rev-parse", "--verify", "MERGE_HEAD"])
      return true
    } catch {
      return false
    }
  }

  /**
   * Abort an in-progress merge.
   */
  async abortMerge(): Promise<void> {
    await this.git(["merge", "--abort"])
  }

  /**
   * Complete a merge after conflicts have been resolved.
   * The caller must stage resolved files before calling this.
   */
  async completeMerge(workerName: string, taskId: string): Promise<MergeResult> {
    const branchName = this.getBranchName(workerName, taskId)

    try {
      // Check if there are still unresolved conflicts
      const conflicts = await this.getConflictingFiles()
      if (conflicts.length > 0) {
        return {
          success: false,
          hadConflicts: true,
          message: `Cannot complete merge: ${conflicts.length} file(s) still have conflicts`,
        }
      }

      // Complete the merge commit
      await this.git(["commit", "--no-edit"])

      return {
        success: true,
        hadConflicts: false,
        message: `Successfully completed merge of ${branchName}`,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return {
        success: false,
        hadConflicts: false,
        message: `Failed to complete merge: ${errorMessage}`,
      }
    }
  }

  /**
   * Remove a worktree and optionally delete its branch.
   */
  async remove(
    workerName: string,
    taskId: string,
    options: RemoveWorktreeOptions = {},
  ): Promise<void> {
    const { deleteBranch = true } = options
    const worktreePath = this.getWorktreePath(workerName, taskId)
    const branchName = this.getBranchName(workerName, taskId)

    // Remove the worktree
    try {
      await this.git(["worktree", "remove", worktreePath, "--force"])
    } catch (error) {
      // If the worktree doesn't exist, that's fine
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (!errorMessage.includes("is not a working tree")) {
        throw error
      }
    }

    // Delete the branch if requested
    if (deleteBranch) {
      try {
        await this.git(["branch", "-D", branchName])
      } catch (error) {
        // If the branch doesn't exist, that's fine
        const errorMessage = error instanceof Error ? error.message : String(error)
        if (!errorMessage.includes("not found")) {
          throw error
        }
      }
    }
  }

  /**
   * Cleanup after a task: merge to main and remove worktree.
   * Only removes the worktree if merge is successful.
   */
  async cleanup(workerName: string, taskId: string): Promise<CleanupResult> {
    // First attempt to merge
    const mergeResult = await this.merge(workerName, taskId)

    if (!mergeResult.success) {
      return {
        success: false,
        merged: false,
        removed: false,
        hadConflicts: mergeResult.hadConflicts,
        message: mergeResult.message,
      }
    }

    // Merge succeeded, now remove the worktree
    await this.remove(workerName, taskId)

    return {
      success: true,
      merged: true,
      removed: true,
      hadConflicts: false,
      message: "Successfully merged and cleaned up worktree",
    }
  }

  /**
   * List all worktrees managed by this WorktreeManager.
   * Optionally filter by worker name.
   */
  async list(workerName?: string): Promise<WorktreeInfo[]> {
    const output = await this.git(["worktree", "list", "--porcelain"])
    const worktrees: WorktreeInfo[] = []

    // Parse porcelain output
    const lines = output.split("\n")
    let currentPath: string | null = null
    let currentBranch: string | null = null

    for (const line of lines) {
      if (line.startsWith("worktree ")) {
        // Process previous worktree before starting new one
        this.addWorktreeIfValid(currentPath, currentBranch, worktrees, workerName)
        currentPath = line.slice("worktree ".length)
      } else if (line.startsWith("branch refs/heads/")) {
        currentBranch = line.slice("branch refs/heads/".length)
      }
    }

    // Process the last worktree
    this.addWorktreeIfValid(currentPath, currentBranch, worktrees, workerName)

    return worktrees
  }

  /**
   * Check if a worktree exists for a worker's task.
   */
  async exists(workerName: string, taskId: string): Promise<boolean> {
    const worktreePath = this.getWorktreePath(workerName, taskId)
    try {
      const stats = await stat(worktreePath)
      return stats.isDirectory()
    } catch {
      return false
    }
  }

  /**
   * Prune worktrees that no longer exist on disk.
   */
  async prune(): Promise<void> {
    await this.git(["worktree", "prune"])
  }

  /**
   * Add a worktree to the list if it's a valid ralph worktree.
   */
  private addWorktreeIfValid(
    currentPath: string | null,
    currentBranch: string | null,
    worktrees: WorktreeInfo[],
    filterWorkerName?: string,
  ): void {
    if (currentPath && currentBranch) {
      // Check if this is a ralph worktree
      if (currentBranch.startsWith("ralph/") && currentPath.startsWith(this.worktreesBasePath)) {
        const parsed = this.parseBranchName(currentBranch)
        if (parsed) {
          // Apply worker filter if specified
          if (filterWorkerName && parsed.workerName !== filterWorkerName) {
            return
          }
          worktrees.push({
            path: currentPath,
            branch: currentBranch,
            ...parsed,
          })
        }
      }
    }
  }

  /**
   * Parse worker name and task ID from a branch name.
   * Expected format: ralph/<worker-name>/<task-id>
   */
  private parseBranchName(branch: string): { workerName: string; taskId: string } | null {
    if (!branch.startsWith("ralph/")) {
      return null
    }

    const parts = branch.slice("ralph/".length).split("/")
    if (parts.length >= 2) {
      const workerName = parts[0]
      const taskId = parts.slice(1).join("/") // In case task ID contains slashes
      return { workerName, taskId }
    }
    return null
  }

  /**
   * Get the main branch name (main or master).
   */
  private async getMainBranch(): Promise<string> {
    // Check for main first, then master
    try {
      await this.git(["show-ref", "--verify", "--quiet", "refs/heads/main"])
      return "main"
    } catch {
      try {
        await this.git(["show-ref", "--verify", "--quiet", "refs/heads/master"])
        return "master"
      } catch {
        // Default to main
        return "main"
      }
    }
  }

  /**
   * Ensure the worktrees base directory and worker subdirectory exist.
   */
  private async ensureWorktreesDirectory(workerName: string): Promise<void> {
    const workerDir = join(this.worktreesBasePath, workerName)
    try {
      await stat(workerDir)
    } catch {
      await mkdir(workerDir, { recursive: true })
    }
  }

  /**
   * Execute a git command in the main workspace.
   */
  private git(args: string[]): Promise<string> {
    return this.gitInDir(this.mainWorkspacePath, args)
  }

  /**
   * Execute a git command in a specific directory.
   */
  private gitInDir(cwd: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn("git", args, {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
      })

      let stdout = ""
      let stderr = ""

      proc.stdout.on("data", data => {
        stdout += data.toString()
      })

      proc.stderr.on("data", data => {
        stderr += data.toString()
      })

      proc.on("close", code => {
        if (code === 0) {
          resolve(stdout.trim())
        } else {
          // Include both stdout and stderr in error message for better conflict detection
          const combinedOutput = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n")
          reject(new Error(combinedOutput || `git ${args[0]} failed with code ${code}`))
        }
      })

      proc.on("error", error => {
        reject(error)
      })
    })
  }
}

export interface WorktreeInfo {
  path: string
  branch: string
  workerName: string
  taskId: string
}

export interface CreateWorktreeOptions {
  workerName: string
  taskId: string
}

export interface RemoveWorktreeOptions {
  deleteBranch?: boolean
}

export interface MergeResult {
  success: boolean
  hadConflicts: boolean
  message: string
}

export interface CleanupResult {
  success: boolean
  merged: boolean
  removed: boolean
  hadConflicts?: boolean
  message: string
}
