import { useEffect, useCallback } from "react"
import { useAppStore } from "../store"

/**
 * Parse the URL hash to extract eventlog ID.
 * Supports format: #eventlog={id}
 */
export function parseEventLogHash(hash: string): string | null {
  if (!hash || hash === "#") return null

  // Remove leading #
  const hashContent = hash.startsWith("#") ? hash.slice(1) : hash

  // Check for eventlog= prefix
  if (hashContent.startsWith("eventlog=")) {
    const id = hashContent.slice("eventlog=".length)
    // Validate: IDs are 8 character hex strings
    if (id && /^[a-f0-9]{8}$/i.test(id)) {
      return id
    }
  }

  return null
}

/**
 * Build a URL hash for an event log ID.
 */
export function buildEventLogHash(id: string): string {
  return `#eventlog=${id}`
}

/**
 * Fetch an event log by ID from the API.
 */
async function fetchEventLog(id: string): Promise<{
  ok: boolean
  eventlog?: {
    id: string
    createdAt: string
    events: Array<{ type: string; timestamp: number; [key: string]: unknown }>
    metadata?: { taskId?: string; title?: string; source?: string; workspacePath?: string }
  }
  error?: string
}> {
  const response = await fetch(`/api/eventlogs/${id}`)
  return response.json()
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

  // Handle hash changes and fetch event log data
  useEffect(() => {
    async function handleHashChange() {
      const id = parseEventLogHash(window.location.hash)

      if (id) {
        // Set the ID and start loading
        setViewingEventLogId(id)
        setEventLogLoading(true)
        setEventLogError(null)

        try {
          const result = await fetchEventLog(id)

          if (result.ok && result.eventlog) {
            setViewingEventLog(result.eventlog)
            setEventLogError(null)
          } else {
            setViewingEventLog(null)
            setEventLogError(result.error ?? "Event log not found")
          }
        } catch (err) {
          setViewingEventLog(null)
          setEventLogError(err instanceof Error ? err.message : "Failed to fetch event log")
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
