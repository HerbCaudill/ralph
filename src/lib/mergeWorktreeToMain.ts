import { execSync } from "child_process"
import { WorktreeInfo, execOptions } from "./types.js"

/**
 * Merge worktree changes back to main branch and commit
 */
export function mergeWorktreeToMain(repoRoot: string, worktree: WorktreeInfo): void {
  try {
    // First, ensure all changes in worktree are committed
    // (Claude should have done this, but let's be safe)
    const status = execSync("git status --porcelain", {
      ...execOptions,
      cwd: worktree.path,
    })

    if (status.toString().trim()) {
      // There are uncommitted changes - commit them
      execSync("git add -A", {
        ...execOptions,
        cwd: worktree.path,
      })
      execSync(`git commit -m "Ralph iteration ${worktree.guid}: auto-commit remaining changes"`, {
        ...execOptions,
        cwd: worktree.path,
      })
    }

    // Get current branch in main repo
    const currentBranch = execSync("git branch --show-current", {
      ...execOptions,
      cwd: repoRoot,
    })
      .toString()
      .trim()

    // Merge the worktree branch into current branch
    execSync(`git merge --no-ff ${worktree.branch} -m "Merge iteration ${worktree.guid}"`, {
      ...execOptions,
      cwd: repoRoot,
    })
  } catch (error) {
    // If merge fails, it might be due to conflicts
    throw new Error(
      `Failed to merge worktree to main: ${error}\n\n` +
        `You may need to resolve conflicts manually in the main repository.`,
    )
  }
}
