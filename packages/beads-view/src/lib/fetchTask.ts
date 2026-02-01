import type { TaskResponse } from "../types"
import { apiFetch } from "./apiClient"

/**
 * Fetch a single task by ID.
 */
export async function fetchTask(
  /** Task ID to fetch. */
  id: string,
): Promise<TaskResponse> {
  try {
    const response = await apiFetch(`/api/tasks/${id}`)

    const contentType = response.headers.get("content-type")
    if (!contentType?.includes("application/json")) {
      return { ok: false, error: `Server error: ${response.status} ${response.statusText}` }
    }

    return (await response.json()) as TaskResponse
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to fetch task" }
  }
}
