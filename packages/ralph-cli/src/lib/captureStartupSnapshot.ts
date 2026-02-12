import { existsSync } from "fs"
import { join } from "path"
import { captureBeadsSnapshot } from "./captureBeadsSnapshot.js"
import { captureTodoSnapshot } from "./captureTodoSnapshot.js"
import type { StartupSnapshot } from "./types.js"

const beadsDir = join(process.cwd(), ".beads")
const ralphDir = join(process.cwd(), ".ralph")
const todoFile = join(ralphDir, "todo.md")

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

/**  @deprecated Use captureStartupSnapshot instead */
export const getInitialBeadsCount = (): number | undefined => {
  const snapshot = captureStartupSnapshot()
  return snapshot?.initialCount
}
