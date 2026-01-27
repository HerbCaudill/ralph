import { useState, useEffect, useCallback } from "react"
import { eventDatabase, type SessionMetadata } from "@/lib/persistence"

/**
 * Summary of an event log (without full event data).
 * Returned by the list endpoint for efficient browsing.
 *
 * Note: This interface is kept for backward compatibility.
 * Internally, event logs are now stored as sessions.
 */
export interface EventLogSummary {
  id: string
  createdAt: string
  eventCount: number
  metadata?: {
    taskId?: string
    title?: string
  }
}

export interface UseEventLogsOptions {
  /** Optional task ID to filter event logs by */
  taskId?: string
}

export interface UseEventLogsResult {
  /** List of event log summaries */
  eventLogs: EventLogSummary[]
  /** Whether event logs are currently loading */
  isLoading: boolean
  /** Error message if fetch failed */
  error: string | null
  /** Manually refresh event logs */
  refresh: () => Promise<void>
}

/**
 * Converts SessionMetadata from IndexedDB to EventLogSummary for consumers.
 * Maps session fields to the event log summary interface.
 */
function toEventLogSummary(metadata: SessionMetadata): EventLogSummary {
  return {
    id: metadata.id,
    // Use startedAt as the creation time for the event log
    createdAt: new Date(metadata.startedAt).toISOString(),
    eventCount: metadata.eventCount,
    metadata:
      metadata.taskId ?
        {
          taskId: metadata.taskId,
          // Title will be looked up from beads by the component
          title: undefined,
        }
      : undefined,
  }
}

/**
 * Hook to fetch and manage event log summaries from IndexedDB.
 * Returns summaries (without full event data) for efficient browsing.
 *
 * Event logs are stored client-side in IndexedDB as sessions.
 */
export function useEventLogs(options: UseEventLogsOptions = {}): UseEventLogsResult {
  const { taskId } = options

  const [eventLogs, setEventLogs] = useState<EventLogSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      await eventDatabase.init()

      const metadata =
        taskId ?
          await eventDatabase.getSessionsForTask(taskId)
        : await eventDatabase.listAllSessions()

      const summaries = metadata.map(toEventLogSummary)
      setEventLogs(summaries)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load event logs")
    } finally {
      setIsLoading(false)
    }
  }, [taskId])

  // Initial fetch
  useEffect(() => {
    refresh()
  }, [refresh])

  return { eventLogs, isLoading, error, refresh }
}
