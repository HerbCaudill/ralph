import { existsSync, readFileSync } from "fs"
import { join } from "path"
import { execSync } from "child_process"

export type ProgressData = {
  type: "beads" | "todo" | "none"
  remaining: number
  total: number
}

const beadsDir = join(process.cwd(), ".beads")
const ralphDir = join(process.cwd(), ".ralph")
const todoFile = join(ralphDir, "todo.md")

/**
 * Get progress data from the workspace.
 *
 * For beads workspaces: remaining = open issues, total = provided initialOpen or calculated
 * For todo.md workspaces: remaining = unchecked items, total = all items
 */
export const getProgress = (initialOpen?: number): ProgressData => {
  // Check for beads workspace first
  if (existsSync(beadsDir)) {
    return getBeadsProgress(initialOpen)
  }

  // Check for todo.md
  if (existsSync(todoFile)) {
    return getTodoProgress()
  }

  return { type: "none", remaining: 0, total: 0 }
}

const getBeadsProgress = (initialOpen?: number): ProgressData => {
  try {
    // Get open issues count using bd list
    const output = execSync("bd list --status=open,in_progress --format='{{.ID}}'", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    })

    const openIssues = output
      .trim()
      .split("\n")
      .filter(line => line.trim().length > 0)
    const remaining = openIssues.length

    // Total is the initial count (baseline) when provided, otherwise current remaining
    // If more issues are opened during the run (remaining > initialOpen), use the larger value
    const total = initialOpen !== undefined ? Math.max(initialOpen, remaining) : remaining

    return { type: "beads", remaining, total }
  } catch {
    // If bd command fails, return no progress
    return { type: "none", remaining: 0, total: 0 }
  }
}

const getTodoProgress = (): ProgressData => {
  try {
    const content = readFileSync(todoFile, "utf-8")

    // Count unchecked items: - [ ]
    const uncheckedMatches = content.match(/- \[ \]/g)
    const unchecked = uncheckedMatches ? uncheckedMatches.length : 0

    // Count checked items: - [x] or - [X]
    const checkedMatches = content.match(/- \[[xX]\]/g)
    const checked = checkedMatches ? checkedMatches.length : 0

    const total = unchecked + checked

    return { type: "todo", remaining: unchecked, total }
  } catch {
    return { type: "none", remaining: 0, total: 0 }
  }
}

/**
 * Get the initial open issue count for beads workspaces.
 * Call this once at startup to capture the baseline.
 */
export const getInitialBeadsCount = (): number | undefined => {
  if (!existsSync(beadsDir)) {
    return undefined
  }

  try {
    const output = execSync("bd list --status=open,in_progress --format='{{.ID}}'", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    })

    const openIssues = output
      .trim()
      .split("\n")
      .filter(line => line.trim().length > 0)
    return openIssues.length
  } catch {
    return undefined
  }
}
