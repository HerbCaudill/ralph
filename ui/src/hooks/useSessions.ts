import { useState, useEffect, useCallback } from "react"
import { eventDatabase, type PersistedSession } from "@/lib/persistence"
import type { ChatEvent } from "@/types"

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

/**
 * A session with its events loaded.
 * Combines session summary with the full event data from IndexedDB.
 */
export interface SessionWithEvents extends SessionSummary {
  /** Events for this session, loaded from the events table */
  events: ChatEvent[]
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
  /** Load events for a specific session */
  loadSessionEvents: (sessionId: string) => Promise<SessionWithEvents | null>
  /** Currently selected session with events */
  selectedSession: SessionWithEvents | null
  /** Whether events are currently loading for the selected session */
  isLoadingEvents: boolean
  /** Error message if loading events failed */
  eventsError: string | null
  /** Clear the selected session */
  clearSelectedSession: () => void
}

/**
 * Validates a timestamp and returns a valid Date, or null if invalid.
 * A timestamp is considered invalid if it's undefined, null, NaN, or 0.
 */
function isValidTimestamp(timestamp: number | undefined | null): timestamp is number {
  return timestamp !== undefined && timestamp !== null && !isNaN(timestamp) && timestamp > 0
}

/**
 * Converts PersistedSession from IndexedDB to SessionSummary for consumers.
 * Returns null if the session has an invalid timestamp.
 */
function toSessionSummary(metadata: PersistedSession): SessionSummary | null {
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
 *
 * Use `loadSessionEvents` to fetch events for a specific session when needed
 * (e.g., when viewing a historical session).
 */
export function useSessions(options: UseSessionsOptions = {}): UseSessionsResult {
  const { taskId } = options

  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // State for selected session with events
  const [selectedSession, setSelectedSession] = useState<SessionWithEvents | null>(null)
  const [isLoadingEvents, setIsLoadingEvents] = useState(false)
  const [eventsError, setEventsError] = useState<string | null>(null)

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

  /**
   * Load events for a specific session from IndexedDB.
   * Returns the session with its events, or null if not found.
   * Also sets the selected session state for easy access.
   */
  const loadSessionEvents = useCallback(
    async (sessionId: string): Promise<SessionWithEvents | null> => {
      setIsLoadingEvents(true)
      setEventsError(null)

      try {
        await eventDatabase.init()

        // Get session metadata
        const metadata = await eventDatabase.getSessionMetadata(sessionId)
        if (!metadata) {
          setEventsError("Session not found")
          setSelectedSession(null)
          return null
        }

        // Get events for this session from the events table
        const persistedEvents = await eventDatabase.getEventsForSession(sessionId)

        // Convert PersistedEvent to ChatEvent
        const events = persistedEvents.map(pe => pe.event)

        // Combine metadata with events
        const summary = toSessionSummary(metadata)
        if (!summary) {
          setEventsError("Invalid session metadata")
          setSelectedSession(null)
          return null
        }

        const sessionWithEvents: SessionWithEvents = {
          ...summary,
          events,
        }

        setSelectedSession(sessionWithEvents)
        return sessionWithEvents
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load session events"
        setEventsError(errorMessage)
        setSelectedSession(null)
        return null
      } finally {
        setIsLoadingEvents(false)
      }
    },
    [],
  )

  /** Clear the selected session and its events. */
  const clearSelectedSession = useCallback(() => {
    setSelectedSession(null)
    setEventsError(null)
  }, [])

  // Initial fetch
  useEffect(() => {
    refresh()
  }, [refresh])

  return {
    sessions,
    isLoading,
    error,
    refresh,
    loadSessionEvents,
    selectedSession,
    isLoadingEvents,
    eventsError,
    clearSelectedSession,
  }
}
