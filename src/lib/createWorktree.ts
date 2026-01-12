import { execSync } from "child_process"
import { mkdirSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { randomUUID } from "crypto"
import { WorktreeInfo, execOptions } from "./types.js"

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
