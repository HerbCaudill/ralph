import { readFileSync } from "fs"
import { join } from "path"
import type { StartupSnapshot } from "./types.js"

const ralphDir = join(process.cwd(), ".ralph")
const todoFile = join(ralphDir, "todo.md")

/**
 * Capture a startup snapshot for a todo.md workspace.
 */
export const captureTodoSnapshot = (): StartupSnapshot | undefined => {
  try {
    const content = readFileSync(todoFile, "utf-8")

    // Count all items (checked + unchecked)
    const uncheckedMatches = content.match(/- \[ \]/g)
    const unchecked = uncheckedMatches ? uncheckedMatches.length : 0

    const checkedMatches = content.match(/- \[[xX]\]/g)
    const checked = checkedMatches ? checkedMatches.length : 0

    return {
      initialCount: unchecked + checked,
      timestamp: new Date().toISOString(),
      type: "todo",
    }
  } catch {
    return undefined
  }
}
