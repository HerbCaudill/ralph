import { execSync } from "child_process"
import { execOptions } from "./types.js"

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
