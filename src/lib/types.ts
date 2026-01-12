import { ExecSyncOptions } from "child_process"
import { basename, dirname, join } from "path"

export interface WorktreeInfo {
  path: string
  branch: string
  guid: string
}

export const execOptions: ExecSyncOptions = {
  stdio: "pipe",
  encoding: "utf-8",
}

/**
 * Get the worktrees directory for a given repo root.
 * Creates a sibling directory named `<repo-name>-worktrees`.
 */
export function getWorktreesDir(repoRoot: string): string {
  const repoName = basename(repoRoot)
  const parentDir = dirname(repoRoot)
  return join(parentDir, `${repoName}-worktrees`)
}
