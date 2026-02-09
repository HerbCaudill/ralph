import { useState, useEffect, useCallback, useMemo } from "react"
import { useBeadsViewStore } from "../store"
import { fetchTasks } from "../lib/fetchTasks"
import { filterTasks } from "../lib/filterTasks"
import type { Task, TaskStatus } from "../types"

/**
 * Hook to fetch and manage tasks from the beads API.
 */
export function useTasks(
  /** Options for filtering and polling. */
  options: UseTasksOptions = {},
): UseTasksResult {
  const { status, ready, all, pollInterval = 30000 } = options

  const storeTasks = useBeadsViewStore(state => state.tasks)

  const [isLoading, setIsLoading] = useState(storeTasks.length === 0)
  const [error, setError] = useState<string | null>(null)
  const setStoreTasks = useBeadsViewStore(state => state.setTasks)

  const tasks = useMemo(
    () => filterTasks(storeTasks, { status, ready, all }),
    [storeTasks, status, ready, all],
  )

  const refresh = useCallback(async () => {
    const result = await fetchTasks({ status: undefined, ready: undefined, all: true })

    if (result.ok && result.issues) {
      setStoreTasks(result.issues)
      setError(null)
    } else {
      setError(result.error ?? "Failed to fetch tasks")
    }

    setIsLoading(false)
  }, [setStoreTasks])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (pollInterval <= 0) return

    const intervalId = setInterval(refresh, pollInterval)
    return () => clearInterval(intervalId)
  }, [refresh, pollInterval])

  return { tasks, isLoading, error, refresh }
}

export interface UseTasksOptions {
  /** Filter by status. */
  status?: TaskStatus
  /** Show only ready tasks (open and unblocked). */
  ready?: boolean
  /** Include closed tasks. */
  all?: boolean
  /** Polling interval in ms (default: 30000). */
  pollInterval?: number
}

export interface UseTasksResult {
  /** List of tasks. */
  tasks: Task[]
  /** Whether tasks are currently loading. */
  isLoading: boolean
  /** Error message if fetch failed. */
  error: string | null
  /** Manually refresh tasks. */
  refresh: () => Promise<void>
}
