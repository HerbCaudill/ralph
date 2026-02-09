import { useState, useEffect, useCallback, useRef } from "react"
import type { ChatEvent } from "@herbcaudill/agent-view"
import { fetchRalphSessions, type RalphSessionIndexEntry } from "../lib/fetchRalphSessions"
import { fetchSessionEvents } from "../lib/fetchSessionEvents"

/**
 * Hook that manages Ralph session history.
 * Fetches sessions on mount and when currentSessionId changes.
 * Allows selecting a historical session to view its events.
 */
export function useRalphSessions(
  /** The current active session ID (from useRalphLoop). */
  currentSessionId: string | null,
): UseRalphSessionsReturn {
  const [sessions, setSessions] = useState<RalphSessionIndexEntry[]>([])
  const [historicalEvents, setHistoricalEvents] = useState<ChatEvent[] | null>(null)

  // Track the last session ID to avoid unnecessary refetches
  const lastSessionIdRef = useRef<string | null | undefined>(undefined)

  // Fetch sessions on mount and when currentSessionId changes
  useEffect(() => {
    // Skip if session ID hasn't changed
    if (lastSessionIdRef.current === currentSessionId) {
      return
    }
    lastSessionIdRef.current = currentSessionId

    const loadSessions = async () => {
      try {
        const result = await fetchRalphSessions()
        setSessions(result)
      } catch (error) {
        console.error("[useRalphSessions] Failed to fetch sessions:", error)
      }
    }

    loadSessions()
  }, [currentSessionId])

  /**
   * Select a historical session and load its events.
   * Sets historicalEvents to the fetched events.
   */
  const selectSession = useCallback(async (sessionId: string) => {
    try {
      const events = await fetchSessionEvents(sessionId, {})
      setHistoricalEvents(events)
    } catch (error) {
      console.error("[useRalphSessions] Failed to fetch session events:", error)
      // Don't change state on error
    }
  }, [])

  /** Clear historical events and return to viewing the live session. */
  const clearHistorical = useCallback(() => {
    setHistoricalEvents(null)
  }, [])

  // Derive isViewingHistorical from historicalEvents
  const isViewingHistorical = historicalEvents !== null

  return {
    sessions,
    selectSession,
    historicalEvents,
    isViewingHistorical,
    clearHistorical,
  }
}

/** Return type of the useRalphSessions hook. */
export interface UseRalphSessionsReturn {
  /** List of Ralph sessions with task info. */
  sessions: RalphSessionIndexEntry[]
  /** Select a historical session to view its events. */
  selectSession: (sessionId: string) => Promise<void>
  /** Events from the selected historical session, or null if viewing live. */
  historicalEvents: ChatEvent[] | null
  /** Whether viewing a historical session (vs the live session). */
  isViewingHistorical: boolean
  /** Clear historical events and return to the live session. */
  clearHistorical: () => void
}
