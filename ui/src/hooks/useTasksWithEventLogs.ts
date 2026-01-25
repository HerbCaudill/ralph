import { useState, useEffect, useCallback } from "react"
import { eventDatabase } from "@/lib/persistence"

export interface UseTasksWithEventLogsResult {
  /** Set of task IDs that have event logs */
  taskIdsWithEventLogs: Set<string>
  /** Whether the data is currently loading */
  isLoading: boolean
  /** Error message if fetch failed */
  error: string | null
  /** Manually refresh the set of task IDs */
  refresh: () => Promise<void>
}

/**
 * Hook to efficiently check which tasks have saved event logs.
 * Returns a Set of task IDs for fast lookups in TaskCard.
 *
 * This is more efficient than calling useEventLogs for each task
 * because it fetches all task IDs in a single database query.
 */
export function useTasksWithEventLogs(): UseTasksWithEventLogsResult {
  const [taskIdsWithEventLogs, setTaskIdsWithEventLogs] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      await eventDatabase.init()
      const taskIds = await eventDatabase.getTaskIdsWithEventLogs()
      setTaskIdsWithEventLogs(taskIds)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load task IDs with event logs")
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    refresh()
  }, [refresh])

  return { taskIdsWithEventLogs, isLoading, error, refresh }
}
