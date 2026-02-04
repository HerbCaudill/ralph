import { useState, useEffect, useCallback } from "react"
import { eventDatabase } from "@/lib/persistence"

export interface UseTasksWithSessionsResult {
  /** Set of task IDs that have sessions */
  taskIdsWithSessions: Set<string>
  /** Whether the data is currently loading */
  isLoading: boolean
  /** Error message if fetch failed */
  error: string | null
  /** Manually refresh the set of task IDs */
  refresh: () => Promise<void>
}

/**
 * Hook to efficiently check which tasks have saved sessions.
 * Returns a Set of task IDs for fast lookups in TaskCard.
 *
 * This is more efficient than calling useEventLogs for each task
 * because it fetches all task IDs in a single database query.
 */
export function useTasksWithSessions(): UseTasksWithSessionsResult {
  const [taskIdsWithSessions, setTaskIdsWithSessions] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      await eventDatabase.init()
      const taskIds = await eventDatabase.getTaskIdsWithSessions()
      setTaskIdsWithSessions(taskIds)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load task IDs with sessions")
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    refresh()
  }, [refresh])

  return { taskIdsWithSessions, isLoading, error, refresh }
}
