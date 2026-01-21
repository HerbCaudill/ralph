import { spawn } from "node:child_process"
import { stat, mkdir } from "node:fs/promises"
import { join, dirname, basename } from "node:path"
import { createDebugLogger } from "./debug.js"

const log = createDebugLogger("worktree")

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

    log(`Creating worktree at ${worktreePath} with branch ${branchName}`)

    // Ensure the worktrees base directory exists
    await this.ensureWorktreesDirectory()

    // Create the worktree with a new branch
    await this.git(["worktree", "add", worktreePath, "-b", branchName])

    log(`Worktree created successfully`)

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

    log(`Merging branch ${branchName} to main`)

    try {
      // First, make sure we're on main
      const mainBranch = await this.getMainBranch()
      await this.git(["checkout", mainBranch])

      // Attempt to merge
      await this.git(["merge", branchName, "--no-ff", "-m", `Merge ${branchName}`])

      log(`Merge successful`)

      return {
        success: true,
        hadConflicts: false,
        message: `Successfully merged ${branchName} to ${mainBranch}`,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Check if it's a merge conflict
      if (errorMessage.includes("CONFLICT") || errorMessage.includes("Automatic merge failed")) {
        log(`Merge had conflicts`)
        return {
          success: false,
          hadConflicts: true,
          message: `Merge conflicts detected in ${branchName}`,
        }
      }

      log(`Merge failed: ${errorMessage}`)
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

    log(`Rebasing worktree ${worktreePath} on ${mainBranch}`)

    try {
      // Rebase the worktree branch on main
      await this.gitInDir(worktreePath, ["rebase", mainBranch])

      log(`Rebase successful`)

      return {
        success: true,
        hadConflicts: false,
        message: `Successfully rebased on ${mainBranch}`,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Check if it's a rebase conflict
      if (errorMessage.includes("CONFLICT") || errorMessage.includes("Cannot rebase")) {
        log(`Rebase had conflicts`)

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

      log(`Rebase failed: ${errorMessage}`)
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

    log(`Removing worktree at ${worktreePath}`)

    // Remove the worktree
    try {
      await this.git(["worktree", "remove", worktreePath, "--force"])
    } catch (error) {
      // If the worktree doesn't exist, that's fine
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (!errorMessage.includes("is not a working tree")) {
        throw error
      }
      log(`Worktree ${worktreePath} doesn't exist, skipping removal`)
    }

    // Delete the branch if requested
    if (deleteBranch) {
      log(`Deleting branch ${branchName}`)
      try {
        await this.git(["branch", "-D", branchName])
      } catch (error) {
        // If the branch doesn't exist, that's fine
        const errorMessage = error instanceof Error ? error.message : String(error)
        if (!errorMessage.includes("not found")) {
          throw error
        }
        log(`Branch ${branchName} doesn't exist, skipping deletion`)
      }
    }

    log(`Worktree removed successfully`)
  }

  /**
   * List all worktrees managed by this WorktreeManager.
   */
  async list(): Promise<WorktreeInfo[]> {
    log(`Listing worktrees`)

    const output = await this.git(["worktree", "list", "--porcelain"])
    const worktrees: WorktreeInfo[] = []

    // Parse porcelain output
    const lines = output.split("\n")
    let currentPath: string | null = null
    let currentBranch: string | null = null

    const processWorktree = () => {
      if (currentPath && currentBranch) {
        // Check if this is a ralph worktree
        if (currentBranch.startsWith("ralph/") && currentPath.startsWith(this.worktreesBasePath)) {
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
      currentPath = null
      currentBranch = null
    }

    for (const line of lines) {
      if (line.startsWith("worktree ")) {
        // Process previous worktree before starting new one
        processWorktree()
        currentPath = line.slice("worktree ".length)
      } else if (line.startsWith("branch refs/heads/")) {
        currentBranch = line.slice("branch refs/heads/".length)
      }
    }

    // Process the last worktree
    processWorktree()

    log(`Found ${worktrees.length} worktrees`)
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
   * Prune worktrees that no longer exist on disk.
   */
  async prune(): Promise<void> {
    log(`Pruning stale worktree entries`)
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
      log(`Creating worktrees directory at ${this.worktreesBasePath}`)
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
      log(`Running: git ${args.join(" ")} in ${cwd}`)

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
