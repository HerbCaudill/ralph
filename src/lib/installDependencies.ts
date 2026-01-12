import { execSync } from "child_process"
import { existsSync } from "fs"
import { join } from "path"
import { execOptions } from "./types.js"

/**
 * Install dependencies in a worktree if package.json exists
 */
export function installDependencies(worktreePath: string): void {
  const packageJsonPath = join(worktreePath, "package.json")

  if (!existsSync(packageJsonPath)) {
    return
  }

  try {
    execSync("pnpm install", {
      ...execOptions,
      cwd: worktreePath,
    })
  } catch (error) {
    throw new Error(`Failed to install dependencies: ${error}`)
  }
}
