import { useEffect, useCallback } from "react"
import { useAppStore } from "../store"
import { eventDatabase, type PersistedSession, type PersistedEvent } from "@/lib/persistence"
import type { EventLog } from "@/types"

/**
 * Parse the URL hash to extract session ID.
 * Supports format: #session={id}
 *
 * Session IDs are alphanumeric with dashes (e.g., "default-1706123456789").
 * For backward compatibility, also supports the legacy #eventlog={8-char-hex} format.
 */
export function parseEventLogHash(hash: string): string | null {
  if (!hash || hash === "#") return null

  // Remove leading #
  const hashContent = hash.startsWith("#") ? hash.slice(1) : hash

  // Check for session= prefix (new format)
  if (hashContent.startsWith("session=")) {
    const id = hashContent.slice("session=".length)
    // Validate: IDs are alphanumeric with dashes, at least 1 char
    if (id && /^[a-zA-Z0-9-]+$/.test(id)) {
      return id
    }
  }

  // Backward compatibility: support legacy eventlog= format
  if (hashContent.startsWith("eventlog=")) {
    const id = hashContent.slice("eventlog=".length)
    // Validate: legacy IDs are 8 character hex strings
    if (id && /^[a-f0-9]{8}$/i.test(id)) {
      return id
    }
  }

  return null
}

/**  Build a URL hash for a session ID. */
export function buildEventLogHash(id: string): string {
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
  /** Close the event log viewer and clear the URL hash */
  closeEventLogViewer: () => void
  /** Current event log ID from URL (if any) */
  eventLogId: string | null
}

/**
 * Hook for URL hash routing for event log viewing.
 *
 * Handles:
 * - Parsing #eventlog={id} from URL on mount
 * - Listening to hashchange events
 * - Fetching event log data when ID changes
 * - Updating URL hash when navigating
 */
export function useEventLogRouter(): UseEventLogRouterReturn {
  const viewingEventLogId = useAppStore(state => state.viewingEventLogId)
  const setViewingEventLogId = useAppStore(state => state.setViewingEventLogId)
  const setViewingEventLog = useAppStore(state => state.setViewingEventLog)
  const setEventLogLoading = useAppStore(state => state.setEventLogLoading)
  const setEventLogError = useAppStore(state => state.setEventLogError)
  const clearEventLogViewer = useAppStore(state => state.clearEventLogViewer)

  // Navigate to view an event log
  const navigateToEventLog = useCallback((id: string) => {
    // Update URL hash
    window.location.hash = buildEventLogHash(id)
    // Store will be updated by hashchange listener
  }, [])

  // Close the event log viewer
  const closeEventLogViewer = useCallback(() => {
    // Clear URL hash
    // Use pushState to avoid a page jump to top
    window.history.pushState(null, "", window.location.pathname + window.location.search)
    // Clear store
    clearEventLogViewer()
  }, [clearEventLogViewer])

  // Handle hash changes and fetch event log data from IndexedDB
  useEffect(() => {
    async function handleHashChange() {
      const id = parseEventLogHash(window.location.hash)

      if (id) {
        // Set the ID and start loading
        setViewingEventLogId(id)
        setEventLogLoading(true)
        setEventLogError(null)

        try {
          // Initialize database and fetch session from IndexedDB
          await eventDatabase.init()
          const session = await eventDatabase.getSession(id)

          if (session) {
            // Fetch events separately (v3+ stores events in separate table)
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
      } else {
        // No event log ID in hash, clear viewer
        clearEventLogViewer()
      }
    }

    // Check hash on mount
    handleHashChange()

    // Listen for hash changes
    window.addEventListener("hashchange", handleHashChange)

    return () => {
      window.removeEventListener("hashchange", handleHashChange)
    }
  }, [
    setViewingEventLogId,
    setViewingEventLog,
    setEventLogLoading,
    setEventLogError,
    clearEventLogViewer,
  ])

  return {
    navigateToEventLog,
    closeEventLogViewer,
    eventLogId: viewingEventLogId,
  }
}
