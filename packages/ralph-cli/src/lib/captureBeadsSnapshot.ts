import { execSync } from "child_process"
import type { StartupSnapshot } from "./types.js"

/**  Capture a startup snapshot for a beads workspace. */
export const captureBeadsSnapshot = (): StartupSnapshot | undefined => {
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
