/**
 * Parse a text message to detect task lifecycle events.
 * Returns TaskLifecycleInfo if the text matches the pattern, null otherwise.
 *
 * Patterns recognized:
 * - "<start_task>task-id</start_task>"
 * - "<end_task>task-id</end_task>"
 */
export function parseTaskLifecycleEvent(
  /** The text message to parse */
  text: string,
): TaskLifecycleInfo | null {
  // Match starting pattern: <start_task>task-id</start_task>
  const startingMatch = text.match(/<start_task>([a-z]+-[a-z0-9]+(?:\.[a-z0-9]+)*)<\/start_task>/i)
  if (startingMatch) {
    return {
      action: "starting",
      taskId: startingMatch[1],
    }
  }

  // Match completed pattern: <end_task>task-id</end_task>
  const completedMatch = text.match(/<end_task>([a-z]+-[a-z0-9]+(?:\.[a-z0-9]+)*)<\/end_task>/i)
  if (completedMatch) {
    return {
      action: "completed",
      taskId: completedMatch[1],
    }
  }

  return null
}

/**
 * Result of parsing a task lifecycle event.
 */
export interface TaskLifecycleInfo {
  action: "starting" | "completed"
  taskId?: string
  taskTitle?: string
}
