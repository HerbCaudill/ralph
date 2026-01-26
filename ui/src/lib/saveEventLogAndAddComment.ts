/**
 * Add a closing comment to a task with a link to the session.
 *
 * When a task is closed, this adds a comment linking to the current session
 * for viewing the event log later.
 */
export async function linkSessionToTask(
  taskId: string,
  sessionId: string | null,
): Promise<boolean> {
  if (!sessionId) {
    return false
  }

  try {
    // Add closing comment to the task via API
    const commentResponse = await fetch(`/api/tasks/${taskId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        comment: `Closed. Session log: #session=${sessionId}`,
        author: "Ralph",
      }),
    })

    if (!commentResponse.ok) {
      console.error("Failed to add closing comment:", await commentResponse.text())
      return false
    }

    return true
  } catch (err) {
    console.error("Error linking session to task:", err)
    return false
  }
}

/**
 * @deprecated Use linkSessionToTask instead.
 * This function is kept for backward compatibility but now just delegates to linkSessionToTask.
 */
export async function saveEventLogAndAddComment(
  taskId: string,
  _taskTitle: string,
  events: unknown[],
  _workspacePath: string | null,
  sessionId?: string | null,
): Promise<string | null> {
  if (events.length === 0 && !sessionId) {
    return null
  }

  const success = await linkSessionToTask(taskId, sessionId ?? null)
  return success ? (sessionId ?? null) : null
}
