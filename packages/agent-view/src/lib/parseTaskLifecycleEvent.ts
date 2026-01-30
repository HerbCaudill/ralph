import type { TaskLifecycleEventData } from "../types"

/**
 * Parse a text message to detect task lifecycle events.
 * Returns TaskLifecycleEventData if the text matches the pattern, null otherwise.
 *
 * Patterns recognized:
 * - "<start_task>task-id</start_task>"
 * - "<end_task>task-id</end_task>"
 */
export function parseTaskLifecycleEvent(
  /** The text message to parse */
  text: string,
  /** Timestamp for the event */
  timestamp: number | undefined,
): TaskLifecycleEventData | null {
  const startingMatch = text.match(/<start_task>([a-z]+-[a-z0-9]+(?:\.[a-z0-9]+)*)<\/start_task>/i)
  if (startingMatch) {
    return {
      type: "task_lifecycle",
      timestamp,
      action: "starting",
      taskId: startingMatch[1],
    }
  }

  const completedMatch = text.match(/<end_task>([a-z]+-[a-z0-9]+(?:\.[a-z0-9]+)*)<\/end_task>/i)
  if (completedMatch) {
    return {
      type: "task_lifecycle",
      timestamp,
      action: "completed",
      taskId: completedMatch[1],
    }
  }

  return null
}
