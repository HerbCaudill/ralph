import { useState, useEffect, useCallback } from "react"
import { eventDatabase, type SessionMetadata } from "@/lib/persistence"

/**
 * Summary of an session (without full event data).
 * Returned by the hook for efficient browsing of past sessions.
 */
export interface SessionSummary {
  id: string
  createdAt: string
  eventCount: number
  metadata?: {
    taskId?: string
    title?: string
  }
}

export interface UseSessionsOptions {
  /** Optional task ID to filter sessions by */
  taskId?: string
}

export interface UseSessionsResult {
  /** List of session summaries */
  sessions: SessionSummary[]
  /** Whether sessions are currently loading */
  isLoading: boolean
  /** Error message if fetch failed */
  error: string | null
  /** Manually refresh sessions */
  refresh: () => Promise<void>
}

/**
 * Validates a timestamp and returns a valid Date, or null if invalid.
 * A timestamp is considered invalid if it's undefined, null, NaN, or 0.
 */
function isValidTimestamp(timestamp: number | undefined | null): timestamp is number {
  return timestamp !== undefined && timestamp !== null && !isNaN(timestamp) && timestamp > 0
}

/**
 * Converts SessionMetadata from IndexedDB to SessionSummary for consumers.
 * Returns null if the metadata has an invalid timestamp.
 */
function toSessionSummary(metadata: SessionMetadata): SessionSummary | null {
  // Validate timestamp before attempting conversion
  if (!isValidTimestamp(metadata.startedAt)) {
    console.warn(
      `[useSessions] Skipping session ${metadata.id} with invalid startedAt: ${metadata.startedAt}`,
    )
    return null
  }

  return {
    id: metadata.id,
    createdAt: new Date(metadata.startedAt).toISOString(),
    eventCount: metadata.eventCount,
    metadata:
      metadata.taskId || metadata.taskTitle ?
        {
          taskId: metadata.taskId ?? undefined,
          title: metadata.taskTitle ?? undefined,
        }
      : undefined,
  }
}

/**
 * Hook to fetch and manage session summaries from IndexedDB.
 * Returns summaries (without full event data) for efficient browsing.
 *
 * Sessions are stored client-side in IndexedDB by useSessionPersistence
 * and persist across sessions.
 */
export function useSessions(options: UseSessionsOptions = {}): UseSessionsResult {
  const { taskId } = options

  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      await eventDatabase.init()

      const metadata =
        taskId ?
          await eventDatabase.getSessionsForTask(taskId)
        : await eventDatabase.listAllSessions()

      // Filter out sessions with invalid timestamps
      const summaries = metadata
        .map(toSessionSummary)
        .filter((s): s is SessionSummary => s !== null)
      setSessions(summaries)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions")
    } finally {
      setIsLoading(false)
    }
  }, [taskId])

  // Initial fetch
  useEffect(() => {
    refresh()
  }, [refresh])

  return { sessions, isLoading, error, refresh }
}
