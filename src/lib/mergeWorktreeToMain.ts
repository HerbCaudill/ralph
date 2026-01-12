import { execSync } from "child_process"
import { WorktreeInfo, execOptions } from "./types.js"
import { resolveConflicts } from "./resolveConflicts.js"

/**
 * Merge worktree changes back to main branch and commit
 */
export function mergeWorktreeToMain(repoRoot: string, worktree: WorktreeInfo): void {
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

  // Try to merge the worktree branch into current branch
  try {
    execSync(`git merge --no-ff ${worktree.branch} -m "Merge iteration ${worktree.guid}"`, {
      ...execOptions,
      cwd: repoRoot,
    })
  } catch (mergeError) {
    // Merge failed, likely due to conflicts - try to resolve them with Claude
    console.log("\nMerge conflict detected. Attempting to resolve with Claude...")

    const resolved = resolveConflicts(repoRoot)
    if (!resolved) {
      // Abort the merge if we couldn't resolve
      try {
        execSync("git merge --abort", {
          ...execOptions,
          cwd: repoRoot,
        })
      } catch {
        // Ignore errors from abort
      }

      throw new Error(
        `Failed to merge worktree to main: ${mergeError}\n\n` +
          `Claude was unable to resolve the conflicts automatically.\n` +
          `You may need to resolve conflicts manually in the main repository.`,
      )
    }

    console.log("Conflicts resolved successfully.")
  }
}
