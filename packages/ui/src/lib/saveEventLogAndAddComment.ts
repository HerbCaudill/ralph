import { linkSessionToTask } from "@herbcaudill/beads-view"

/**
 * @deprecated Use linkSessionToTask instead.
 * This function is kept for backward compatibility but now just delegates to linkSessionToTask.
 */
export async function saveEventLogAndAddComment(
  /** Task ID to update. */
  taskId: string,
  /** Deprecated task title (unused). */
  _taskTitle: string,
  /** Session events for backward compatibility. */
  events: unknown[],
  /** Deprecated workspace path (unused). */
  _workspacePath: string | null,
  /** Session ID to link. */
  sessionId?: string | null,
): Promise<string | null> {
  if (events.length === 0 && !sessionId) {
    return null
  }

  const success = await linkSessionToTask(taskId, sessionId ?? null)
  return success ? (sessionId ?? null) : null
}
