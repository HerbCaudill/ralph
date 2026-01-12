import { execSync } from "child_process"
import { execOptions } from "./types.js"

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
