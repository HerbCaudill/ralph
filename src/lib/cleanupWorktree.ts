import { execSync } from "child_process"
import { existsSync, rmSync } from "fs"
import { WorktreeInfo, execOptions } from "./types.js"

/**
 * Remove a worktree and its branch
 */
export function cleanupWorktree(repoRoot: string, worktree: WorktreeInfo): void {
  try {
    // Remove the worktree
    execSync(`git worktree remove "${worktree.path}" --force`, {
      ...execOptions,
      cwd: repoRoot,
    })

    // Delete the branch
    execSync(`git branch -D ${worktree.branch}`, {
      ...execOptions,
      cwd: repoRoot,
    })
  } catch (error) {
    // Try to clean up the directory even if git commands fail
    try {
      if (existsSync(worktree.path)) {
        rmSync(worktree.path, { recursive: true, force: true })
      }
    } catch {
      // Ignore cleanup errors
    }

    console.error(`Warning: Failed to fully cleanup worktree: ${error}`)
  }
}
