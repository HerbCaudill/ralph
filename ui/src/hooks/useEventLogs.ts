import { useState, useEffect, useCallback } from "react"
import type { EventLogMetadata } from "@/types"

/**
 * Summary of an event log (without full event data).
 * Returned by the list endpoint for efficient browsing.
 */
export interface EventLogSummary {
  id: string
  createdAt: string
  eventCount: number
  metadata?: EventLogMetadata
}

export interface UseEventLogsOptions {
  /** Polling interval in ms (default: 30000, 0 to disable) */
  pollInterval?: number
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

interface EventLogsResponse {
  ok: boolean
  eventlogs?: EventLogSummary[]
  error?: string
}

/**
 * Fetch event log summaries from the API.
 */
async function fetchEventLogs(): Promise<EventLogsResponse> {
  try {
    const response = await fetch("/api/eventlogs")
    return (await response.json()) as EventLogsResponse
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to fetch event logs" }
  }
}

/**
 * Hook to fetch and manage event log summaries from the API.
 * Returns summaries (without full event data) for efficient browsing.
 */
export function useEventLogs(options: UseEventLogsOptions = {}): UseEventLogsResult {
  const { pollInterval = 30000 } = options

  const [eventLogs, setEventLogs] = useState<EventLogSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const result = await fetchEventLogs()

    if (result.ok && result.eventlogs) {
      setEventLogs(result.eventlogs)
      setError(null)
    } else {
      setError(result.error ?? "Failed to fetch event logs")
    }

    setIsLoading(false)
  }, [])

  // Initial fetch
  useEffect(() => {
    refresh()
  }, [refresh])

  // Polling
  useEffect(() => {
    if (pollInterval <= 0) return

    const intervalId = setInterval(refresh, pollInterval)
    return () => clearInterval(intervalId)
  }, [refresh, pollInterval])

  return { eventLogs, isLoading, error, refresh }
}
