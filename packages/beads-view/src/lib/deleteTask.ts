import type { DeleteResponse } from "../types"

/**
 * Delete a task by ID.
 */
export async function deleteTask(
  /** Task ID to delete. */
  id: string,
): Promise<DeleteResponse> {
  try {
    const response = await fetch(`/api/tasks/${id}`, {
      method: "DELETE",
    })

    const contentType = response.headers.get("content-type")
    if (!contentType?.includes("application/json")) {
      return { ok: false, error: `Server error: ${response.status} ${response.statusText}` }
    }

    return (await response.json()) as DeleteResponse
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to delete task" }
  }
}
