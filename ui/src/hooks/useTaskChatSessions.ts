/**
 * Hook for fetching and managing task chat session history from IndexedDB.
 *
 * Returns session metadata for efficient browsing, with lazy loading
 * of full session data when needed.
 */

import { useState, useEffect, useCallback } from "react"
import { eventDatabase, type TaskChatSessionMetadata } from "@/lib/persistence"

export interface UseTaskChatSessionsOptions {
  /** ID of the Ralph instance to fetch sessions for */
  instanceId: string
  /** Whether to enable the hook (default: true) */
  enabled?: boolean
}

export interface UseTaskChatSessionsResult {
  /** List of task chat session metadata */
  sessions: TaskChatSessionMetadata[]
  /** Whether sessions are currently loading */
  isLoading: boolean
  /** Error message if fetch failed */
  error: string | null
  /** Manually refresh sessions */
  refresh: () => Promise<void>
}

/**
 * Hook to fetch and manage task chat session metadata from IndexedDB.
 * Returns session summaries (without full message/event data) for efficient browsing.
 */
export function useTaskChatSessions(
  options: UseTaskChatSessionsOptions,
): UseTaskChatSessionsResult {
  const { instanceId, enabled = true } = options

  const [sessions, setSessions] = useState<TaskChatSessionMetadata[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!enabled) {
      setIsLoading(false)
      return
    }

    try {
      await eventDatabase.init()
      const sessionList = await eventDatabase.listTaskChatSessions(instanceId)
      setSessions(sessionList)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch task chat sessions")
    } finally {
      setIsLoading(false)
    }
  }, [instanceId, enabled])

  // Initial fetch
  useEffect(() => {
    refresh()
  }, [refresh])

  return { sessions, isLoading, error, refresh }
}
