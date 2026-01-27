import { useState, useEffect, useCallback, useMemo } from "react"
import type { TaskCardTask, TaskStatus } from "@/types"
import { useAppStore } from "@/store"

// Types

export interface UseTasksOptions {
  /** Filter by status */
  status?: TaskStatus
  /** Show only ready tasks (open and unblocked) */
  ready?: boolean
  /** Include closed tasks */
  all?: boolean
  /**
   * Polling interval in ms (default: 5000).
   * Provides reliable updates when WebSocket mutation events are delayed or unavailable.
   */
  pollInterval?: number
}

export interface UseTasksResult {
  /** List of tasks */
  tasks: TaskCardTask[]
  /** Whether tasks are currently loading */
  isLoading: boolean
  /** Error message if fetch failed */
  error: string | null
  /** Manually refresh tasks */
  refresh: () => Promise<void>
}

// API Functions

interface TasksResponse {
  ok: boolean
  issues?: TaskCardTask[]
  error?: string
}

async function fetchTasks(options: UseTasksOptions = {}): Promise<TasksResponse> {
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

/**
 * Fetch blocked tasks (both status=blocked and dependency-blocked issues).
 *
 * Unlike bd list --status=blocked which only shows explicitly blocked issues,
 * this uses bd blocked to also include open issues with unsatisfied blocking dependencies.
 *
 * @param parent - Optional parent to filter descendants
 * @returns Promise with blocked issues including blocked_by field
 */
export async function fetchBlockedTasks(parent?: string): Promise<TasksResponse> {
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

// Hook

/**
 * Hook to fetch and manage tasks from the beads API.
 *
 * The hook subscribes to the global store's task list, which is updated by:
 * 1. Initial fetch when the hook mounts
 * 2. Mutation events from the beads daemon (create, update, delete, status changes)
 * 3. Manual refresh calls
 * 4. Polling every 5 seconds (configurable via pollInterval option)
 */
export function useTasks(options: UseTasksOptions = {}): UseTasksResult {
  const { status, ready, all, pollInterval = 5000 } = options

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Subscribe to tasks from the global store
  // Tasks are updated by mutation events in ralphConnection.ts
  const storeTasks = useAppStore(state => state.tasks)
  const setStoreTasks = useAppStore(state => state.setTasks)

  // Memoize filtered tasks to avoid creating new array references on every render
  const tasks = useMemo(
    () => filterTasks(storeTasks, { status, ready, all }),
    [storeTasks, status, ready, all],
  )

  const refresh = useCallback(async () => {
    const result = await fetchTasks({ status: undefined, ready: undefined, all: true })

    if (result.ok && result.issues) {
      // Always fetch all tasks and store in global state
      // Filtering is done locally based on the options
      setStoreTasks(result.issues)
      setError(null)
    } else {
      setError(result.error ?? "Failed to fetch tasks")
    }

    setIsLoading(false)
  }, [setStoreTasks])

  // Initial fetch
  useEffect(() => {
    refresh()
  }, [refresh])

  // Poll for updates (default: every 2 seconds)
  useEffect(() => {
    if (pollInterval <= 0) return

    const intervalId = setInterval(refresh, pollInterval)
    return () => clearInterval(intervalId)
  }, [refresh, pollInterval])

  return { tasks, isLoading, error, refresh }
}

/**
 * Filter tasks based on options.
 * Matches the server-side filtering logic.
 */
function filterTasks(
  tasks: TaskCardTask[],
  options: Pick<UseTasksOptions, "status" | "ready" | "all">,
): TaskCardTask[] {
  const { status, ready, all } = options

  return tasks.filter(task => {
    // Filter by status if specified
    if (status && task.status !== status) {
      return false
    }

    // Filter for ready tasks (open and unblocked)
    if (ready) {
      if (task.status !== "open") return false
      // Check if task is blocked by dependencies
      if (task.blocked_by && task.blocked_by.length > 0) return false
    }

    // Exclude closed tasks unless 'all' is specified
    if (!all && task.status === "closed") {
      return false
    }

    return true
  })
}
