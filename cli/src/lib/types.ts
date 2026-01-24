/**  Progress data for tracking issues/tasks. */
export type ProgressData = {
  /** Type of workspace (beads, todo, or none) */
  type: "beads" | "todo" | "none"
  /** Number of issues/tasks completed since startup */
  completed: number
  /** Total issues/tasks seen since startup (initial + created since) */
  total: number
}

/**  Startup snapshot containing initial count and timestamp. */
export type StartupSnapshot = {
  /** Initial count of open + in_progress issues */
  initialCount: number
  /** RFC3339 timestamp of when the snapshot was taken */
  timestamp: string
  /** Type of workspace (beads or todo) */
  type: "beads" | "todo"
}
