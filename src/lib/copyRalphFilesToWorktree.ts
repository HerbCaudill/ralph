import { copyFileSync, mkdirSync, existsSync } from "fs"
import { join } from "path"

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
