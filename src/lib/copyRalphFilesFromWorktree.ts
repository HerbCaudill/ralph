import { copyFileSync, existsSync } from "fs"
import { join } from "path"

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
