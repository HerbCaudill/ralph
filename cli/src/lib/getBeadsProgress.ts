import { execSync } from "child_process"
import type { ProgressData } from "./types.js"

/**
 * Get progress for a beads workspace by counting issues created and closed since startup.
 */
export const getBeadsProgress = (
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
