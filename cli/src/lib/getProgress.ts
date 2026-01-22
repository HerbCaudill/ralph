import { existsSync } from "fs"
import { join } from "path"
import { getBeadsProgress } from "./getBeadsProgress.js"
import { getTodoProgress } from "./getTodoProgress.js"
import type { ProgressData } from "./types.js"

const beadsDir = join(process.cwd(), ".beads")
const ralphDir = join(process.cwd(), ".ralph")
const todoFile = join(ralphDir, "todo.md")

/**
 * Get progress data from the workspace.
 *
 * For beads workspaces: Uses timestamp-based counting to accurately track
 * issues closed and created since startup.
 * For todo.md workspaces: completed = checked items, total = all items
 */
export const getProgress = (
  /** Initial count of open + in_progress issues at startup */
  initialCount: number,
  /** RFC3339 timestamp for counting issues created after this time */
  startupTimestamp: string,
): ProgressData => {
  // Check for beads workspace first
  if (existsSync(beadsDir)) {
    return getBeadsProgress(initialCount, startupTimestamp)
  }

  // Check for todo.md
  if (existsSync(todoFile)) {
    return getTodoProgress()
  }

  return { type: "none", completed: 0, total: 0 }
}
