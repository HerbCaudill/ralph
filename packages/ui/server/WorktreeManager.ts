import { spawn } from "node:child_process"
import { stat, mkdir, realpath } from "node:fs/promises"
import { join, dirname, basename } from "node:path"

/**
 * Manages git worktrees for concurrent Ralph instances.
 *
 * Each Ralph instance gets its own worktree in a sibling folder,
 * allowing parallel work without conflicts:
 *
 * ```
 * project/                     # Main worktree (main branch)
 * project-worktrees/           # Sibling folder
 *   alice-abc123/              # Alice's worktree (branch: ralph/alice-abc123)
 *   bob-def456/                # Bob's worktree (branch: ralph/bob-def456)
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
   * Get the main workspace path.
   */
  getMainWorkspacePath(): string {
    return this.mainWorkspacePath
  }

  /**
   * Get the path to the worktrees base directory.
   */
  getWorktreesBasePath(): string {
    return this.worktreesBasePath
  }

  /**
   * Get the path for a specific instance's worktree.
   */
  getWorktreePath(instanceId: string, instanceName: string): string {
    return join(this.worktreesBasePath, `${instanceName}-${instanceId}`)
  }

  /**
   * Get the branch name for a specific instance.
   */
  getBranchName(instanceId: string, instanceName: string): string {
    return `ralph/${instanceName}-${instanceId}`
  }

  /**
   * Create a new worktree for an instance.
   */
  async create(
    /** Instance ID and name */
    options: CreateWorktreeOptions,
  ): Promise<WorktreeInfo> {
    const { instanceId, instanceName } = options
    const worktreePath = this.getWorktreePath(instanceId, instanceName)
    const branchName = this.getBranchName(instanceId, instanceName)

    // Ensure the worktrees base directory exists
    await this.ensureWorktreesDirectory()

    // Create the worktree with a new branch
    await this.git(["worktree", "add", worktreePath, "-b", branchName])

    return {
      path: worktreePath,
      branch: branchName,
      instanceId,
      instanceName,
    }
  }

  /**
   * Merge the worktree branch back to main.
   */
  async merge(
    /** The instance ID */
    instanceId: string,
    /** The instance name */
    instanceName: string,
  ): Promise<MergeResult> {
    const branchName = this.getBranchName(instanceId, instanceName)

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
        // Get list of conflicted files
        const conflictedFiles = await this.getConflictedFiles()
        return {
          success: false,
          hadConflicts: true,
          message: `Merge conflicts detected in ${branchName}`,
          conflictedFiles,
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
   * Rebase the worktree branch on top of main.
   */
  async rebase(
    /** The instance ID */
    instanceId: string,
    /** The instance name */
    instanceName: string,
  ): Promise<MergeResult> {
    const worktreePath = this.getWorktreePath(instanceId, instanceName)
    const mainBranch = await this.getMainBranch()

    try {
      // Rebase the worktree branch on main
      await this.gitInDir(worktreePath, ["rebase", mainBranch])

      return {
        success: true,
        hadConflicts: false,
        message: `Successfully rebased on ${mainBranch}`,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Check if it's a rebase conflict
      if (errorMessage.includes("CONFLICT") || errorMessage.includes("Cannot rebase")) {
        // Abort the rebase
        try {
          await this.gitInDir(worktreePath, ["rebase", "--abort"])
        } catch {
          // Ignore abort errors
        }

        return {
          success: false,
          hadConflicts: true,
          message: `Rebase conflicts detected`,
        }
      }

      return {
        success: false,
        hadConflicts: false,
        message: `Rebase failed: ${errorMessage}`,
      }
    }
  }

  /**
   * Perform the post-session merge workflow.
   *
   * This is the standard workflow after an session completes:
   * 1. Merge the instance branch to main
   * 2. If merge succeeds, rebase the worktree on the updated main
   *
   * If there are merge conflicts, the merge will fail and the caller
   * should handle conflict resolution before retrying.
   */
  async postSessionMerge(
    /** The instance ID */
    instanceId: string,
    /** The instance name */
    instanceName: string,
  ): Promise<PostSessionResult> {
    const branchName = this.getBranchName(instanceId, instanceName)

    // Step 1: Merge the instance branch to main
    const mergeResult = await this.merge(instanceId, instanceName)

    if (!mergeResult.success) {
      // Merge failed (possibly conflicts)
      return {
        success: false,
        merge: mergeResult,
        rebase: null,
        message:
          mergeResult.hadConflicts ?
            `Merge conflicts detected in ${branchName}. Resolve conflicts before continuing.`
          : `Merge failed: ${mergeResult.message}`,
      }
    }

    // Step 2: Rebase the worktree on the updated main
    const rebaseResult = await this.rebase(instanceId, instanceName)

    if (!rebaseResult.success) {
      // Rebase failed (possibly conflicts)
      return {
        success: false,
        merge: mergeResult,
        rebase: rebaseResult,
        message:
          rebaseResult.hadConflicts ?
            `Rebase conflicts detected after merge. Resolve conflicts in worktree.`
          : `Rebase failed: ${rebaseResult.message}`,
      }
    }

    // Both operations succeeded
    return {
      success: true,
      merge: mergeResult,
      rebase: rebaseResult,
      message: `Successfully merged ${branchName} to main and rebased worktree.`,
    }
  }

  /**
   * Remove a worktree and optionally delete its branch.
   */
  async remove(
    /** The instance ID */
    instanceId: string,
    /** The instance name */
    instanceName: string,
    /** Whether to delete the branch (default: true) */
    deleteBranch = true,
  ): Promise<void> {
    const worktreePath = this.getWorktreePath(instanceId, instanceName)
    const branchName = this.getBranchName(instanceId, instanceName)

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
   * Cleanup an instance's worktree completely.
   *
   * This is the standard workflow when removing an instance:
   * 1. Merge the instance branch to main (if there are commits)
   * 2. Remove the worktree
   * 3. Delete the branch
   *
   * If merge conflicts occur, the cleanup will fail and the caller
   * should handle conflict resolution before retrying.
   */
  async cleanup(
    /** The instance ID */
    instanceId: string,
    /** The instance name */
    instanceName: string,
  ): Promise<CleanupResult> {
    const branchName = this.getBranchName(instanceId, instanceName)
    const mainBranch = await this.getMainBranch()

    // Check if the branch has commits that aren't on main
    let hasUnmergedCommits = false
    try {
      // Get commits on branch that aren't on main
      const commits = await this.git(["rev-list", "--count", `${mainBranch}..${branchName}`])
      hasUnmergedCommits = parseInt(commits.trim(), 10) > 0
    } catch {
      // Branch might not exist, that's fine - no commits to merge
      hasUnmergedCommits = false
    }

    // Step 1: Merge if there are unmerged commits
    let mergeResult: MergeResult | null = null
    if (hasUnmergedCommits) {
      mergeResult = await this.merge(instanceId, instanceName)

      if (!mergeResult.success) {
        return {
          success: false,
          merge: mergeResult,
          removed: false,
          message:
            mergeResult.hadConflicts ?
              `Cannot cleanup: merge conflicts detected in ${branchName}. Resolve conflicts before removing.`
            : `Cannot cleanup: merge failed - ${mergeResult.message}`,
        }
      }
    }

    // Step 2: Remove the worktree and delete the branch
    try {
      await this.remove(instanceId, instanceName, true)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return {
        success: false,
        merge: mergeResult,
        removed: false,
        message: `Failed to remove worktree: ${errorMessage}`,
      }
    }

    // Success
    const mergeMessage =
      mergeResult?.success ? `Merged ${branchName} to ${mainBranch}. `
      : hasUnmergedCommits ? ""
      : "No commits to merge. "

    return {
      success: true,
      merge: mergeResult,
      removed: true,
      message: `${mergeMessage}Removed worktree and branch ${branchName}.`,
    }
  }

  /**
   * List all worktrees managed by this WorktreeManager.
   */
  async list(): Promise<WorktreeInfo[]> {
    const output = await this.git(["worktree", "list", "--porcelain"])
    const worktrees: WorktreeInfo[] = []

    // Resolve the real path for comparison (handles symlinks like /var -> /private/var on macOS)
    let resolvedBasePath: string
    try {
      resolvedBasePath = await realpath(this.worktreesBasePath)
    } catch {
      // If base path doesn't exist yet, no worktrees can exist
      return []
    }

    // Parse porcelain output
    const lines = output.split("\n")
    let currentPath: string | null = null
    let currentBranch: string | null = null

    const processWorktree = async () => {
      if (currentPath && currentBranch) {
        // Check if this is a ralph worktree by branch name
        if (currentBranch.startsWith("ralph/")) {
          // Resolve the worktree path to handle symlinks
          let resolvedPath: string
          try {
            resolvedPath = await realpath(currentPath)
          } catch {
            // Path doesn't exist, skip
            currentPath = null
            currentBranch = null
            return
          }

          // Check if the resolved path is under our worktrees base
          if (resolvedPath.startsWith(resolvedBasePath)) {
            const branchParts = currentBranch.slice("ralph/".length)
            // Parse {name}-{id} from branch name
            const lastDash = branchParts.lastIndexOf("-")
            if (lastDash > 0) {
              const instanceName = branchParts.slice(0, lastDash)
              const instanceId = branchParts.slice(lastDash + 1)
              worktrees.push({
                path: currentPath,
                branch: currentBranch,
                instanceId,
                instanceName,
              })
            }
          }
        }
      }
      currentPath = null
      currentBranch = null
    }

    const worktreeEntries: Array<{ path: string | null; branch: string | null }> = []
    let entry: { path: string | null; branch: string | null } = { path: null, branch: null }

    for (const line of lines) {
      if (line.startsWith("worktree ")) {
        // Save previous entry and start new one
        if (entry.path) {
          worktreeEntries.push(entry)
        }
        entry = { path: line.slice("worktree ".length), branch: null }
      } else if (line.startsWith("branch refs/heads/")) {
        entry.branch = line.slice("branch refs/heads/".length)
      }
    }

    // Save the last entry
    if (entry.path) {
      worktreeEntries.push(entry)
    }

    // Process all entries (needs to be done sequentially due to async realpath)
    for (const e of worktreeEntries) {
      currentPath = e.path
      currentBranch = e.branch
      await processWorktree()
    }

    return worktrees
  }

  /**
   * Check if a worktree exists for an instance.
   */
  async exists(instanceId: string, instanceName: string): Promise<boolean> {
    const worktreePath = this.getWorktreePath(instanceId, instanceName)
    try {
      const stats = await stat(worktreePath)
      return stats.isDirectory()
    } catch {
      return false
    }
  }

  /**
   * Validate a worktree and return its status.
   *
   * This detects cases where:
   * - The worktree directory was externally deleted
   * - The worktree is no longer registered with git
   * - The branch was deleted
   */
  async validate(
    /** The instance ID */
    instanceId: string,
    /** The instance name */
    instanceName: string,
  ): Promise<WorktreeStatus> {
    const worktreePath = this.getWorktreePath(instanceId, instanceName)
    const branchName = this.getBranchName(instanceId, instanceName)

    // Check if directory exists
    let directoryExists = false
    try {
      const stats = await stat(worktreePath)
      directoryExists = stats.isDirectory()
    } catch {
      directoryExists = false
    }

    // Check if git has the worktree registered
    let gitRegistered = false
    try {
      const output = await this.git(["worktree", "list", "--porcelain"])
      // Git stores the path, possibly with symlinks resolved (e.g. /private/var on macOS)
      // We need to check both the original path and all resolved variants
      const pathsToCheck = [worktreePath]

      // On macOS, /var is a symlink to /private/var, and /tmp is a symlink to /private/tmp
      // Git may store either version, so check both
      if (worktreePath.startsWith("/var/")) {
        pathsToCheck.push("/private" + worktreePath)
      } else if (worktreePath.startsWith("/tmp/")) {
        pathsToCheck.push("/private" + worktreePath)
      }

      if (directoryExists) {
        try {
          const resolved = await realpath(worktreePath)
          if (!pathsToCheck.includes(resolved)) {
            pathsToCheck.push(resolved)
          }
        } catch {
          // Ignore realpath errors
        }
      }

      gitRegistered = pathsToCheck.some(p => output.includes(`worktree ${p}`))
    } catch {
      gitRegistered = false
    }

    // Check if the branch exists
    let branchExists = false
    try {
      await this.git(["show-ref", "--verify", "--quiet", `refs/heads/${branchName}`])
      branchExists = true
    } catch {
      branchExists = false
    }

    // Determine overall validity and message
    const isValid = directoryExists && gitRegistered && branchExists

    let message: string
    if (isValid) {
      message = "Worktree is valid and ready"
    } else if (!directoryExists && !gitRegistered && !branchExists) {
      // Nothing exists - worktree was never created or fully cleaned up
      message = "Worktree does not exist"
    } else if (!directoryExists && gitRegistered) {
      message =
        "Worktree directory was externally deleted. Run prune() to clean up, or recreate the worktree."
    } else if (directoryExists && !gitRegistered) {
      message = "Worktree directory exists but is not registered with git. It may have been pruned."
    } else if (!branchExists) {
      message = "Worktree branch was deleted. The worktree may be unusable."
    } else {
      message = "Worktree is in an unknown state"
    }

    return {
      directoryExists,
      gitRegistered,
      branchExists,
      isValid,
      message,
    }
  }

  /**
   * Recreate a worktree that was externally deleted.
   *
   * If the branch still exists, recreates the worktree pointing to that branch.
   * If the branch was also deleted, creates a fresh worktree with a new branch.
   *
   * Throws Error if worktree already exists and is valid.
   */
  async recreate(
    /** The instance ID */
    instanceId: string,
    /** The instance name */
    instanceName: string,
  ): Promise<WorktreeInfo> {
    const status = await this.validate(instanceId, instanceName)
    const worktreePath = this.getWorktreePath(instanceId, instanceName)
    const branchName = this.getBranchName(instanceId, instanceName)

    // If the worktree is fully valid, don't recreate
    if (status.isValid) {
      throw new Error(
        `Worktree for ${instanceName}-${instanceId} is already valid. No need to recreate.`,
      )
    }

    // If git still has the worktree registered (but directory is gone), prune first
    if (status.gitRegistered && !status.directoryExists) {
      await this.prune()
    }

    // Ensure the worktrees base directory exists
    await this.ensureWorktreesDirectory()

    // Recreate the worktree
    if (status.branchExists) {
      // Branch exists, just create the worktree pointing to it
      await this.git(["worktree", "add", worktreePath, branchName])
    } else {
      // Branch is gone too, create fresh with new branch
      await this.git(["worktree", "add", worktreePath, "-b", branchName])
    }

    return {
      path: worktreePath,
      branch: branchName,
      instanceId,
      instanceName,
    }
  }

  /**
   * Get list of files with merge conflicts in the main workspace.
   */
  async getConflictedFiles(): Promise<string[]> {
    try {
      // git diff --name-only --diff-filter=U lists unmerged files
      const output = await this.git(["diff", "--name-only", "--diff-filter=U"])
      return output
        .split("\n")
        .map(f => f.trim())
        .filter(Boolean)
    } catch {
      return []
    }
  }

  /**
   * Check if the main workspace is currently in a merge state.
   */
  async isMergeInProgress(): Promise<boolean> {
    try {
      // Check for MERGE_HEAD which exists during a merge
      await this.git(["rev-parse", "--verify", "MERGE_HEAD"])
      return true
    } catch {
      return false
    }
  }

  /**
   * Abort an in-progress merge in the main workspace.
   *
   * Throws Error if no merge is in progress.
   */
  async abortMerge(): Promise<void> {
    await this.git(["merge", "--abort"])
  }

  /**
   * Mark a conflicted file as resolved after manual edits.
   */
  async markResolved(
    /** Path to the file that was manually resolved */
    filePath: string,
  ): Promise<void> {
    await this.git(["add", filePath])
  }

  /**
   * Resolve a conflict by accepting one side's version.
   */
  async resolveConflict(
    /** Path to the conflicted file */
    filePath: string,
    /** "ours" to keep main's version, "theirs" to keep branch's version */
    strategy: "ours" | "theirs",
  ): Promise<void> {
    await this.git(["checkout", `--${strategy}`, filePath])
    await this.git(["add", filePath])
  }

  /**
   * Complete a merge after all conflicts have been resolved.
   */
  async completeMerge(): Promise<MergeResult> {
    // Check if there are still unresolved conflicts
    const conflictedFiles = await this.getConflictedFiles()
    if (conflictedFiles.length > 0) {
      return {
        success: false,
        hadConflicts: true,
        message: `Cannot complete merge: ${conflictedFiles.length} file(s) still have conflicts`,
        conflictedFiles,
      }
    }

    try {
      // Complete the merge with commit
      await this.git(["commit", "--no-edit"])
      return {
        success: true,
        hadConflicts: false,
        message: "Merge completed successfully",
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
   * Prune worktrees that no longer exist on disk.
   */
  async prune(): Promise<void> {
    await this.git(["worktree", "prune"])
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
   * Ensure the worktrees base directory exists.
   */
  private async ensureWorktreesDirectory(): Promise<void> {
    try {
      await stat(this.worktreesBasePath)
    } catch {
      await mkdir(this.worktreesBasePath, { recursive: true })
    }
  }

  /**
   * Execute a git command in the main workspace.
   */
  private git(
    /** Git command arguments */
    args: string[],
  ): Promise<string> {
    return this.gitInDir(this.mainWorkspacePath, args)
  }

  /**
   * Execute a git command in a specific directory.
   */
  private gitInDir(
    /** Working directory for git command */
    cwd: string,
    /** Git command arguments */
    args: string[],
  ): Promise<string> {
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

/**  Information about a worktree. */
export interface WorktreeInfo {
  /** Path to the worktree directory */
  path: string

  /** Git branch name */
  branch: string

  /** Instance ID */
  instanceId: string

  /** Instance name */
  instanceName: string
}

/**  Options for creating a worktree. */
export interface CreateWorktreeOptions {
  /** Instance ID */
  instanceId: string

  /** Instance name */
  instanceName: string
}

/**  Result of a merge or rebase operation. */
export interface MergeResult {
  /** Whether the operation succeeded */
  success: boolean

  /** Whether conflicts were detected */
  hadConflicts: boolean

  /** Human-readable message */
  message: string

  /** Files with merge conflicts (only populated when hadConflicts is true) */
  conflictedFiles?: string[]
}

/**  Result of a cleanup operation. */
export interface CleanupResult {
  /** Overall success - true only if merge and removal succeeded */
  success: boolean

  /** Result of the merge operation (null if no uncommitted changes or merge not needed) */
  merge: MergeResult | null

  /** Whether the worktree and branch were removed */
  removed: boolean

  /** Summary message */
  message: string
}

/**  Result of post-session merge workflow. */
export interface PostSessionResult {
  /** Overall success - true only if both merge and rebase succeeded */
  success: boolean

  /** Result of the merge operation */
  merge: MergeResult

  /** Result of the rebase operation (only attempted if merge succeeded) */
  rebase: MergeResult | null

  /** Summary message */
  message: string
}

/**  Status of a worktree's integrity. */
export interface WorktreeStatus {
  /** Does the worktree directory exist on disk? */
  directoryExists: boolean

  /** Is the worktree registered with git? */
  gitRegistered: boolean

  /** Does the branch exist? */
  branchExists: boolean

  /** Is the worktree valid and usable? */
  isValid: boolean

  /** Human-readable status message */
  message: string
}
