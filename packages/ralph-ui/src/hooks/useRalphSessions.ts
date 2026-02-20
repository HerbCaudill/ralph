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
  /** The current active session ID (from useSessionEvents). */
  currentSessionId: string | null,
  /** Workspace ID for filtering sessions. */
  workspaceId?: string,
  /** Local tasks array for resolving task titles without API calls. */
  tasks?: Array<{ id: string; title: string }>,
): UseRalphSessionsReturn {
  const [sessions, setSessions] = useState<RalphSessionIndexEntry[]>([])
  const [historicalEvents, setHistoricalEvents] = useState<ChatEvent[] | null>(null)

  // Track the last session ID and workspace ID to avoid unnecessary refetches
  const lastParamsRef = useRef<{ sessionId: string | null; workspaceId: string | undefined }>({
    sessionId: undefined as unknown as string | null,
    workspaceId: undefined,
  })

  // Store references for refetch callback
  const workspaceIdRef = useRef(workspaceId)
  const tasksRef = useRef(tasks)
  useEffect(() => {
    workspaceIdRef.current = workspaceId
    tasksRef.current = tasks
  }, [workspaceId, tasks])

  /**
   * Force refetch sessions from the server.
   * Call this when orchestrator creates a new session.
   */
  const refetchSessions = useCallback(async () => {
    try {
      const result = await fetchRalphSessions({
        workspaceId: workspaceIdRef.current,
        tasks: tasksRef.current,
      })
      setSessions(result)
    } catch (error) {
      console.error("[useRalphSessions] Failed to refetch sessions:", error)
    }
  }, [])

  // Fetch sessions on mount and when currentSessionId, workspaceId, or tasks change
  useEffect(() => {
    // Skip if neither session ID nor workspace ID has changed
    if (
      lastParamsRef.current.sessionId === currentSessionId &&
      lastParamsRef.current.workspaceId === workspaceId
    ) {
      // Still re-resolve titles if tasks changed (sessions already fetched)
      if (tasks && sessions.length > 0) {
        const taskMap = new Map(tasks.map(t => [t.id, t.title]))
        const updated = sessions.map(s => ({
          ...s,
          taskTitle: s.taskId ? taskMap.get(s.taskId) : undefined,
        }))
        // Only update if titles actually changed
        const titlesChanged = updated.some((s, i) => s.taskTitle !== sessions[i].taskTitle)
        if (titlesChanged) {
          setSessions(updated)
        }
      }
      return
    }
    lastParamsRef.current = { sessionId: currentSessionId, workspaceId }

    const loadSessions = async () => {
      try {
        const result = await fetchRalphSessions({ workspaceId, tasks })
        setSessions(result)
      } catch (error) {
        console.error("[useRalphSessions] Failed to fetch sessions:", error)
      }
    }

    loadSessions()
  }, [currentSessionId, workspaceId, tasks]) // eslint-disable-line react-hooks/exhaustive-deps

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
    refetchSessions,
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
  /** Force refetch sessions from the server (e.g., when orchestrator creates new sessions). */
  refetchSessions: () => Promise<void>
}
