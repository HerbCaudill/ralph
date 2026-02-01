import type { TasksResponse } from "../types"
import { apiFetch } from "./apiClient"

/**
 * Fetch blocked tasks from the API.
 */
export async function fetchBlockedTasks(
  /** Optional parent ID to filter descendant tasks. */
  parent?: string,
): Promise<TasksResponse> {
  const params = new URLSearchParams()
  if (parent) {
    params.set("parent", parent)
  }

  const path = `/api/tasks/blocked${params.toString() ? `?${params.toString()}` : ""}`

  try {
    const response = await apiFetch(path)
    return (await response.json()) as TasksResponse
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to fetch blocked tasks",
    }
  }
}
