import type { TaskResponse, TaskUpdateData } from "../types"

/**
 * Update a task with new fields.
 */
export async function updateTask(
  /** Task ID to update. */
  id: string,
  /** Updated task data. */
  updates: TaskUpdateData,
): Promise<TaskResponse> {
  try {
    const response = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })

    const contentType = response.headers.get("content-type")
    if (!contentType?.includes("application/json")) {
      return { ok: false, error: `Server error: ${response.status} ${response.statusText}` }
    }

    return (await response.json()) as TaskResponse
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to update task" }
  }
}
