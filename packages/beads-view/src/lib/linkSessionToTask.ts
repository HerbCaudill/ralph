import { apiFetch } from "./apiClient"

/**
 * Add a closing comment to a task with a link to the session.
 */
export async function linkSessionToTask(
  /** Task ID to update. */
  taskId: string,
  /** Session ID to link. */
  sessionId: string | null,
): Promise<boolean> {
  if (!sessionId) {
    return false
  }

  try {
    const commentResponse = await apiFetch(`/api/tasks/${taskId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        comment: `Closed. Session log: /session/${sessionId}`,
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
