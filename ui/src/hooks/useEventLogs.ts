import { useState, useEffect, useCallback } from "react"
import { eventDatabase, type EventLogMetadata } from "@/lib/persistence"

/**
 * Summary of an event log (without full event data).
 * Returned by the list endpoint for efficient browsing.
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
 * Converts EventLogMetadata from IndexedDB to EventLogSummary for consumers.
 */
function toEventLogSummary(metadata: EventLogMetadata): EventLogSummary {
  return {
    id: metadata.id,
    createdAt: new Date(metadata.createdAt).toISOString(),
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
 * Hook to fetch and manage event log summaries from IndexedDB.
 * Returns summaries (without full event data) for efficient browsing.
 *
 * Event logs are stored client-side in IndexedDB and persist across sessions.
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
          await eventDatabase.getEventLogsForTask(taskId)
        : await eventDatabase.listEventLogs()

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
