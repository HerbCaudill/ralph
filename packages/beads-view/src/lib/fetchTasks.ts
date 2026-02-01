import type { TasksResponse, TaskStatus } from "../types"

/**
 * Fetch tasks from the API with optional filters.
 */
export async function fetchTasks(
  /** Filter options for the request. */
  options: FetchTasksOptions = {},
): Promise<TasksResponse> {
  const params = new URLSearchParams()

  if (options.status) {
    params.set("status", options.status)
  }
  if (options.ready) {
    params.set("ready", "true")
  }
  if (options.all) {
    params.set("all", "true")
  }

  const url = `/api/tasks${params.toString() ? `?${params.toString()}` : ""}`

  try {
    const response = await fetch(url)
    return (await response.json()) as TasksResponse
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to fetch tasks" }
  }
}

export interface FetchTasksOptions {
  /** Filter by status. */
  status?: TaskStatus
  /** Show only ready tasks (open and unblocked). */
  ready?: boolean
  /** Include closed tasks. */
  all?: boolean
}
