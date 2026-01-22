import { spawn } from "node:child_process"
import { stat, mkdir, realpath } from "node:fs/promises"
import { join, dirname, basename } from "node:path"

export interface WorktreeInfo {
  path: string
  branch: string
  instanceId: string
  instanceName: string
}

export interface CreateWorktreeOptions {
  instanceId: string
  instanceName: string
}

export interface MergeResult {
  success: boolean
  hadConflicts: boolean
  message: string
}

/**
 * Status of a worktree's integrity.
 */
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
   *
   * @param options - Instance ID and name
   * @returns Info about the created worktree
   */
  async create(options: CreateWorktreeOptions): Promise<WorktreeInfo> {
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
   *
   * @param instanceId - The instance ID
   * @param instanceName - The instance name
   * @returns Result of the merge operation
   */
  async merge(instanceId: string, instanceName: string): Promise<MergeResult> {
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
   * Rebase the worktree branch on top of main.
   *
   * @param instanceId - The instance ID
   * @param instanceName - The instance name
   * @returns Result of the rebase operation
   */
  async rebase(instanceId: string, instanceName: string): Promise<MergeResult> {
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
   * Remove a worktree and optionally delete its branch.
   *
   * @param instanceId - The instance ID
   * @param instanceName - The instance name
   * @param deleteBranch - Whether to delete the branch (default: true)
   */
  async remove(instanceId: string, instanceName: string, deleteBranch = true): Promise<void> {
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
   *
   * @param instanceId - The instance ID
   * @param instanceName - The instance name
   * @returns Status information about the worktree
   */
  async validate(instanceId: string, instanceName: string): Promise<WorktreeStatus> {
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
   * @param instanceId - The instance ID
   * @param instanceName - The instance name
   * @returns Info about the recreated worktree
   * @throws Error if worktree already exists and is valid
   */
  async recreate(instanceId: string, instanceName: string): Promise<WorktreeInfo> {
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
