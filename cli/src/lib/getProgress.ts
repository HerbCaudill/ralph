import { existsSync, readFileSync } from "fs"
import { join } from "path"
import { execSync } from "child_process"

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

/**
 * Get progress for a beads workspace by counting issues created and closed since startup.
 */
const getBeadsProgress = (
  /** Initial count of open + in_progress issues */
  initialCount: number,
  /** RFC3339 timestamp for counting issues created after this time */
  startupTimestamp: string,
): ProgressData => {
  try {
    // Count issues created since startup
    const createdSinceStartup = parseInt(
      execSync(`bd count --created-after="${startupTimestamp}"`, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim(),
      10,
    )

    // Count current open + in_progress issues
    const currentOpen = parseInt(
      execSync("bd count --status=open", {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim(),
      10,
    )
    const currentInProgress = parseInt(
      execSync("bd count --status=in_progress", {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim(),
      10,
    )
    const currentRemaining = currentOpen + currentInProgress

    // Total = initial open+in_progress + any new issues created
    const total = initialCount + createdSinceStartup
    // Completed = total - remaining (accounts for issues closed by any means)
    const completed = total - currentRemaining

    return { type: "beads", completed, total }
  } catch {
    // If bd command fails, return no progress
    return { type: "none", completed: 0, total: 0 }
  }
}

/**
 * Get progress for a todo.md workspace by counting checked and unchecked items.
 */
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

    return { type: "todo", completed: checked, total }
  } catch {
    return { type: "none", completed: 0, total: 0 }
  }
}

/**
 * Capture a startup snapshot for beads workspaces.
 * Call this once at startup to capture the baseline count and timestamp.
 * Returns undefined if not a beads workspace.
 */
export const captureStartupSnapshot = (): StartupSnapshot | undefined => {
  // Check for beads workspace
  if (existsSync(beadsDir)) {
    return captureBeadsSnapshot()
  }

  // Check for todo.md workspace
  if (existsSync(todoFile)) {
    return captureTodoSnapshot()
  }

  return undefined
}

/**
 * Capture a startup snapshot for a beads workspace.
 */
const captureBeadsSnapshot = (): StartupSnapshot | undefined => {
  try {
    const timestamp = new Date().toISOString()

    const openCount = parseInt(
      execSync("bd count --status=open", {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim(),
      10,
    )
    const inProgressCount = parseInt(
      execSync("bd count --status=in_progress", {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim(),
      10,
    )

    return {
      initialCount: openCount + inProgressCount,
      timestamp,
      type: "beads",
    }
  } catch {
    return undefined
  }
}

/**
 * Capture a startup snapshot for a todo.md workspace.
 */
const captureTodoSnapshot = (): StartupSnapshot | undefined => {
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

/**
 * @deprecated Use captureStartupSnapshot instead
 */
export const getInitialBeadsCount = (): number | undefined => {
  const snapshot = captureStartupSnapshot()
  return snapshot?.initialCount
}

export type ProgressData = {
  type: "beads" | "todo" | "none"
  /** Number of issues/tasks completed since startup */
  completed: number
  /** Total issues/tasks seen since startup (initial + created since) */
  total: number
}

export type StartupSnapshot = {
  /** Initial count of open + in_progress issues */
  initialCount: number
  /** RFC3339 timestamp of when the snapshot was taken */
  timestamp: string
  /** Type of workspace (beads or todo) */
  type: "beads" | "todo"
}
