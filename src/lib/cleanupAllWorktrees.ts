import { execSync } from "child_process"
import { existsSync, rmSync } from "fs"
import { execOptions, getWorktreesDir } from "./types.js"

/**
 * Clean up all ralph worktrees (useful for recovery)
 */
export function cleanupAllWorktrees(repoRoot: string): void {
  try {
    const worktreesDir = getWorktreesDir(repoRoot)
    if (existsSync(worktreesDir)) {
      rmSync(worktreesDir, { recursive: true, force: true })
    }

    // Prune any stale worktree references
    execSync("git worktree prune", {
      ...execOptions,
      cwd: repoRoot,
    })
  } catch (error) {
    console.error(`Warning: Failed to cleanup all worktrees: ${error}`)
  }
}
