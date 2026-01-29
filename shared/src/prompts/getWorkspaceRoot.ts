import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"

/**
 * Find the repository root by walking up from a starting directory.
 */
export function getWorkspaceRoot(
  /** Directory to start searching from */
  cwd: string = process.cwd(),
): string {
  const start = resolve(cwd)
  let current = start

  while (true) {
    const gitPath = resolve(current, ".git")
    if (existsSync(gitPath)) {
      return current
    }

    const parent = dirname(current)
    if (parent === current) {
      return start
    }
    current = parent
  }
}
