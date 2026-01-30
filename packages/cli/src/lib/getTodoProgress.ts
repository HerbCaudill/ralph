import { readFileSync } from "fs"
import { join } from "path"
import type { ProgressData } from "./types.js"

const ralphDir = join(process.cwd(), ".ralph")
const todoFile = join(ralphDir, "todo.md")

/**  Get progress for a todo.md workspace by counting checked and unchecked items. */
export const getTodoProgress = (): ProgressData => {
  try {
    const content = readFileSync(todoFile, "utf-8")

    // Count unchecked items: - [ ]
    const uncheckedMatches = content.match(/- \[ \]/g)
    const unchecked = uncheckedMatches ? uncheckedMatches.length : 0

    // Count checked items: - [x] or - [X]
    const checkedMatches = content.match(/- \[[xX]\]/g)
    const checked = checkedMatches ? checkedMatches.length : 0

    const total = unchecked + checked

    return { type: "todo", completed: checked, total }
  } catch {
    return { type: "none", completed: 0, total: 0 }
  }
}
