import { useState, useEffect, useRef } from "react"
import type { SessionIndexEntry } from "@herbcaudill/agent-view"
import { fetchTaskChatSessions } from "../lib/fetchTaskChatSessions"

/**
 * Hook that manages task-chat session history.
 * Fetches sessions on mount and when currentSessionId changes.
 */
export function useTaskChatSessions(
  /** The current active session ID (from useTaskChat). */
  currentSessionId: string | null,
): UseTaskChatSessionsReturn {
  const [sessions, setSessions] = useState<SessionIndexEntry[]>([])

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
        const result = await fetchTaskChatSessions()
        setSessions(result)
      } catch (error) {
        console.error("[useTaskChatSessions] Failed to fetch sessions:", error)
      }
    }

    loadSessions()
  }, [currentSessionId])

  return {
    sessions,
  }
}

/** Return type of the useTaskChatSessions hook. */
export interface UseTaskChatSessionsReturn {
  /** List of task-chat sessions. */
  sessions: SessionIndexEntry[]
}
