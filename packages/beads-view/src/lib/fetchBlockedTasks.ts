import type { TasksResponse } from "../types"

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

  const url = `/api/tasks/blocked${params.toString() ? `?${params.toString()}` : ""}`

  try {
    const response = await fetch(url)
    return (await response.json()) as TasksResponse
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to fetch blocked tasks",
    }
  }
}
