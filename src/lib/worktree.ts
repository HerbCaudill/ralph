import { execSync, ExecSyncOptions } from "child_process"
import { copyFileSync, mkdirSync, rmSync, existsSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { randomUUID } from "crypto"

export interface WorktreeInfo {
  path: string
  branch: string
  guid: string
}

const execOptions: ExecSyncOptions = {
  stdio: "pipe",
  encoding: "utf-8",
}

/**
 * Get the root directory of the git repository
 */
export function getGitRoot(cwd: string): string {
  try {
    const root = execSync("git rev-parse --show-toplevel", {
      ...execOptions,
      cwd,
    })
    return root.toString().trim()
  } catch (error) {
    throw new Error("Not in a git repository")
  }
}

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

/**
 * Pop the most recent stash
 */
export function popStash(repoRoot: string): void {
  try {
    execSync("git stash pop", {
      ...execOptions,
      cwd: repoRoot,
    })
  } catch (error) {
    throw new Error(`Failed to pop stash: ${error}`)
  }
}

/**
 * Create a new git worktree for an iteration
 */
export function createWorktree(repoRoot: string): WorktreeInfo {
  const guid = randomUUID()
  const branch = `ralph-${guid}`
  const worktreesDir = join(tmpdir(), "ralph-worktrees")
  const worktreePath = join(worktreesDir, guid)

  try {
    // Ensure worktrees directory exists
    mkdirSync(worktreesDir, { recursive: true })

    // Create worktree with new branch from current HEAD
    execSync(`git worktree add -b ${branch} "${worktreePath}"`, {
      ...execOptions,
      cwd: repoRoot,
    })

    return {
      path: worktreePath,
      branch,
      guid,
    }
  } catch (error) {
    throw new Error(`Failed to create worktree: ${error}`)
  }
}

/**
 * Copy .ralph files from main repo to worktree
 */
export function copyRalphFilesToWorktree(repoRoot: string, worktreePath: string): void {
  const ralphDir = join(repoRoot, ".ralph")
  const worktreeRalphDir = join(worktreePath, ".ralph")

  // Create .ralph directory in worktree
  mkdirSync(worktreeRalphDir, { recursive: true })

  // Copy required files
  const files = ["prompt.md", "todo.md", "progress.md"]
  for (const file of files) {
    const src = join(ralphDir, file)
    const dest = join(worktreeRalphDir, file)
    if (existsSync(src)) {
      copyFileSync(src, dest)
    }
  }
}

/**
 * Copy updated .ralph files from worktree back to main repo
 */
export function copyRalphFilesFromWorktree(repoRoot: string, worktreePath: string): void {
  const ralphDir = join(repoRoot, ".ralph")
  const worktreeRalphDir = join(worktreePath, ".ralph")

  // Copy back todo.md and progress.md (prompt.md doesn't change)
  const files = ["todo.md", "progress.md"]
  for (const file of files) {
    const src = join(worktreeRalphDir, file)
    const dest = join(ralphDir, file)
    if (existsSync(src)) {
      copyFileSync(src, dest)
    }
  }
}

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

/**
 * Clean up all ralph worktrees (useful for recovery)
 */
export function cleanupAllWorktrees(repoRoot: string): void {
  try {
    const worktreesDir = join(tmpdir(), "ralph-worktrees")
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
