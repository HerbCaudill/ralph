import type { Task, TaskStatus } from "../types"

/**
 * Filter tasks based on status, readiness, and closed inclusion.
 */
export function filterTasks(
  /** Tasks to filter. */
  tasks: Task[],
  /** Filter options. */
  options: FilterTasksOptions,
): Task[] {
  const { status, ready, all } = options

  return tasks.filter(task => {
    if (status && task.status !== status) {
      return false
    }

    if (ready) {
      if (task.status !== "open") return false
      if (task.blocked_by && task.blocked_by.length > 0) return false
    }

    if (!all && task.status === "closed") {
      return false
    }

    return true
  })
}

export interface FilterTasksOptions {
  /** Filter by status. */
  status?: TaskStatus
  /** Show only ready tasks (open and unblocked). */
  ready?: boolean
  /** Include closed tasks. */
  all?: boolean
}
