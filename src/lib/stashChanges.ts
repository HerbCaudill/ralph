import { execSync } from "child_process"
import { execOptions } from "./types.js"

/**
 * Stash any uncommitted changes in the main repository
 * Returns true if changes were stashed, false if working tree was clean
 */
export function stashChanges(repoRoot: string): boolean {
  try {
    // Check if there are any changes to stash
    const status = execSync("git status --porcelain", {
      ...execOptions,
      cwd: repoRoot,
    })

    if (!status.toString().trim()) {
      return false // Nothing to stash
    }

    execSync(
      "git stash push --include-untracked -m 'Ralph: stashing changes before worktree iterations'",
      {
        ...execOptions,
        cwd: repoRoot,
      },
    )
    return true
  } catch (error) {
    throw new Error(`Failed to stash changes: ${error}`)
  }
}
