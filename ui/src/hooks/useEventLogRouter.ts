import { useEffect, useCallback, useRef } from "react"
import { useAppStore } from "../store"
import { eventDatabase, type PersistedSession, type PersistedEvent } from "@/lib/persistence"
import type { EventLog } from "@/types"

/**
 * Parse the URL to extract session ID.
 * Supports format: /session/{id}
 *
 * Session IDs are alphanumeric with dashes (e.g., "default-1706123456789").
 * For backward compatibility, also supports legacy hash formats:
 * - #session={id}
 * - #eventlog={8-char-hex}
 */
export function parseSessionIdFromUrl(url: { pathname: string; hash: string }): string | null {
  // Check path-based format first: /session/{id}
  const pathMatch = url.pathname.match(/^\/session\/([a-zA-Z0-9-]+)$/)
  if (pathMatch) {
    const id = pathMatch[1]
    if (id) {
      return id
    }
  }

  // Backward compatibility: support legacy hash formats
  const hash = url.hash
  if (hash && hash !== "#") {
    const hashContent = hash.startsWith("#") ? hash.slice(1) : hash

    // Check for session= prefix
    if (hashContent.startsWith("session=")) {
      const id = hashContent.slice("session=".length)
      if (id && /^[a-zA-Z0-9-]+$/.test(id)) {
        return id
      }
    }

    // Check for legacy eventlog= prefix
    if (hashContent.startsWith("eventlog=")) {
      const id = hashContent.slice("eventlog=".length)
      if (id && /^[a-f0-9]{8}$/i.test(id)) {
        return id
      }
    }
  }

  return null
}

/**  Build a URL path for a session ID. */
export function buildSessionPath(id: string): string {
  return `/session/${id}`
}

// Legacy exports for backwards compatibility with tests
export const parseEventLogHash = (hash: string): string | null => {
  return parseSessionIdFromUrl({ pathname: "/", hash })
}

export const buildEventLogHash = (id: string): string => {
  return `#session=${id}`
}

/**
 * Convert a PersistedSession and its events from IndexedDB to EventLog for the store.
 */
function toEventLog(session: PersistedSession, events: PersistedEvent[]): EventLog {
  return {
    id: session.id,
    createdAt: new Date(session.startedAt).toISOString(),
    events: events.map(e => e.event),
    metadata:
      session.taskId || session.taskTitle || session.workspaceId ?
        {
          taskId: session.taskId ?? undefined,
          title: session.taskTitle ?? undefined,
          source: "session",
          workspacePath: session.workspaceId ?? undefined,
        }
      : undefined,
  }
}

export interface UseEventLogRouterReturn {
  /** Navigate to view an event log by ID */
  navigateToEventLog: (id: string) => void
  /** Close the event log viewer and clear the URL path */
  closeEventLogViewer: () => void
  /** Current event log ID from URL (if any) */
  eventLogId: string | null
}

/**
 * Hook for URL routing for event log viewing.
 *
 * Handles:
 * - Parsing /session/{id} from URL on mount (also supports legacy hash formats)
 * - Listening to popstate events for browser back/forward
 * - Fetching event log data when ID changes
 * - Updating URL path when navigating
 */
export function useEventLogRouter(): UseEventLogRouterReturn {
  const viewingEventLogId = useAppStore(state => state.viewingEventLogId)
  const setViewingEventLogId = useAppStore(state => state.setViewingEventLogId)
  const setViewingEventLog = useAppStore(state => state.setViewingEventLog)
  const setEventLogLoading = useAppStore(state => state.setEventLogLoading)
  const setEventLogError = useAppStore(state => state.setEventLogError)
  const clearEventLogViewer = useAppStore(state => state.clearEventLogViewer)

  // Track if we're programmatically changing the URL (to avoid loops)
  const isProgrammaticChange = useRef(false)
  // Track current session ID from URL
  const sessionIdFromUrlRef = useRef<string | null>(null)

  // Navigate to view an event log
  const navigateToEventLog = useCallback((id: string) => {
    isProgrammaticChange.current = true
    // Update URL to path-based format
    window.history.pushState({ sessionId: id }, "", buildSessionPath(id))
    sessionIdFromUrlRef.current = id
    // Reset flag after the change propagates
    setTimeout(() => {
      isProgrammaticChange.current = false
    }, 0)
    // Trigger fetch directly since we're using pushState
    fetchSessionById(id)
  }, [])

  // Close the event log viewer
  const closeEventLogViewer = useCallback(() => {
    isProgrammaticChange.current = true
    // Navigate back to root
    window.history.pushState(null, "", "/")
    sessionIdFromUrlRef.current = null
    // Clear store
    clearEventLogViewer()
    // Reset flag after the change propagates
    setTimeout(() => {
      isProgrammaticChange.current = false
    }, 0)
  }, [clearEventLogViewer])

  // Helper to fetch session data by ID
  const fetchSessionById = useCallback(
    async (id: string) => {
      setViewingEventLogId(id)
      setEventLogLoading(true)
      setEventLogError(null)

      try {
        await eventDatabase.init()
        const session = await eventDatabase.getSession(id)

        if (session) {
          const events = await eventDatabase.getEventsForSession(id)
          setViewingEventLog(toEventLog(session, events))
          setEventLogError(null)
        } else {
          setViewingEventLog(null)
          setEventLogError("Session not found")
        }
      } catch (err) {
        setViewingEventLog(null)
        setEventLogError(err instanceof Error ? err.message : "Failed to fetch session")
      } finally {
        setEventLogLoading(false)
      }
    },
    [setViewingEventLogId, setViewingEventLog, setEventLogLoading, setEventLogError],
  )

  // Handle URL changes and fetch event log data from IndexedDB
  useEffect(() => {
    async function handleUrlChange() {
      // Skip if this is a programmatic change we initiated
      if (isProgrammaticChange.current) {
        return
      }

      const id = parseSessionIdFromUrl(window.location)
      const previousId = sessionIdFromUrlRef.current
      sessionIdFromUrlRef.current = id

      if (id) {
        await fetchSessionById(id)
      } else if (previousId) {
        // URL was cleared (had an ID before, now doesn't) - clear viewer
        clearEventLogViewer()
      }
    }

    // Check URL on mount
    handleUrlChange()

    // Listen for popstate events (back/forward navigation)
    window.addEventListener("popstate", handleUrlChange)
    // Also listen for hashchange for legacy URL support
    window.addEventListener("hashchange", handleUrlChange)

    return () => {
      window.removeEventListener("popstate", handleUrlChange)
      window.removeEventListener("hashchange", handleUrlChange)
    }
  }, [fetchSessionById, clearEventLogViewer])

  return {
    navigateToEventLog,
    closeEventLogViewer,
    eventLogId: viewingEventLogId,
  }
}
