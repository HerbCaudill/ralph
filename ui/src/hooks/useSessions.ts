import { useState, useEffect, useCallback, useMemo } from "react"
import { eventDatabase, type PersistedSession } from "@/lib/persistence"
import type { ChatEvent, Task } from "@/types"
import { useAppStore, selectTasks } from "@/store"

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
  /** Optional workspace ID to filter sessions by (recommended for cross-workspace isolation) */
  workspaceId?: string
  /** Include sessions without tasks (default: false) */
  includeTaskless?: boolean
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
      metadata.taskId ?
        {
          taskId: metadata.taskId,
          // Title will be looked up from beads by enrichedSessions
          title: undefined,
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
  const { taskId, workspaceId, includeTaskless = false } = options

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

      // Determine which query method to use based on filters
      let metadata
      if (taskId && workspaceId) {
        // Filter by both task and workspace
        metadata = await eventDatabase.getSessionsForTaskInWorkspace(taskId, workspaceId)
      } else if (taskId) {
        // Filter by task only (legacy behavior for backwards compatibility)
        metadata = await eventDatabase.getSessionsForTask(taskId)
      } else if (workspaceId) {
        // Filter by workspace only
        metadata = await eventDatabase.listSessionsByWorkspace(workspaceId)
      } else {
        // No filters - return all sessions (legacy behavior)
        metadata = await eventDatabase.listAllSessions()
      }

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
  }, [taskId, workspaceId])

  /**
   * Load events for a specific session from IndexedDB.
   * Returns the session with its events, or null if not found.
   * Also sets the selected session state for easy access.
   *
   * Additionally, derives task info from events and updates the session metadata
   * if it differs from what's stored, ensuring the dropdown shows consistent info.
   */
  const loadSessionEvents = useCallback(
    async (sessionId: string): Promise<SessionWithEvents | null> => {
      setIsLoadingEvents(true)
      setEventsError(null)

      try {
        await eventDatabase.init()

        // Get full session record (includes optional embedded events for backward compat)
        const fullSession = await eventDatabase.getSession(sessionId)
        if (!fullSession) {
          console.warn(`[useSessions] loadSessionEvents: session not found for ${sessionId}`)
          setEventsError("Session not found")
          setSelectedSession(null)
          return null
        }

        // Use the full record as metadata (strip events for summary later)
        const metadata = fullSession

        // Get events for this session from the events table (v3+ normalized storage)
        const persistedEvents = await eventDatabase.getEventsForSession(sessionId)

        let events: ChatEvent[]
        if (persistedEvents.length > 0) {
          // Events found in the events table (v3+ schema)
          events = persistedEvents.map(pe => pe.event)
        } else if (fullSession.events && fullSession.events.length > 0) {
          // Fallback: events embedded in the session record (pre-v3 schema or legacy data)
          console.debug(
            `[useSessions] loadSessionEvents: using ${fullSession.events.length} embedded events for session ${sessionId} (no events in events table)`,
          )
          events = fullSession.events
        } else {
          // No events found anywhere
          console.warn(
            `[useSessions] loadSessionEvents: session ${sessionId} has eventCount=${metadata.eventCount} in metadata but no events found in events table or session record.`,
          )
          events = []
        }

        // Derive task ID from events
        let derivedTaskId: string | undefined
        for (const event of events) {
          if ((event as { type: string }).type === "ralph_task_started") {
            derivedTaskId = (event as { taskId?: string }).taskId ?? undefined
            break
          }
        }

        // If we derived task ID from events that differs from stored metadata, update it
        if (derivedTaskId && derivedTaskId !== metadata.taskId) {
          const updatedMetadata = {
            ...metadata,
            taskId: derivedTaskId,
          }
          await eventDatabase.saveSession(updatedMetadata)
          // Refresh sessions to update the dropdown
          refresh()
        }

        // Use updated metadata for the summary
        const summaryMetadata =
          derivedTaskId && derivedTaskId !== metadata.taskId ?
            { ...metadata, taskId: derivedTaskId }
          : metadata

        // Combine metadata with events
        const summary = toSessionSummary(summaryMetadata)
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
    [refresh],
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

  // Get current tasks from store for on-the-fly title lookup
  const tasks = useAppStore(selectTasks)

  // Enrich sessions with task titles from the store
  // Task titles are always looked up on-the-fly from beads, never cached
  const enrichedSessions = useMemo(() => {
    // Wait until tasks are loaded before enriching sessions
    // This prevents showing sessions with undefined titles
    if (!tasks.length) return sessions

    // Filter out sessions without tasks unless includeTaskless is true
    const filteredSessions =
      includeTaskless ? sessions : sessions.filter(session => session.metadata?.taskId)

    return filteredSessions.map(session => {
      // If we have a taskId, look up the title from the current tasks
      if (session.metadata?.taskId) {
        const task = tasks.find((t: Task) => t.id === session.metadata?.taskId)
        if (task?.title) {
          return {
            ...session,
            metadata: {
              ...session.metadata,
              title: task.title,
            },
          }
        }
      }
      return session
    })
  }, [sessions, tasks, includeTaskless])

  return {
    sessions: enrichedSessions,
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
