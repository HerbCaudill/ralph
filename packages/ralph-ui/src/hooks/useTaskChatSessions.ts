import { useState, useEffect, useRef, useCallback } from "react"
import type { SessionIndexEntry } from "@herbcaudill/agent-view"
import { fetchTaskChatSessions } from "../lib/fetchTaskChatSessions"

/**
 * Hook that manages task-chat session history.
 * Fetches sessions on mount and when currentSessionId or workspaceId changes.
 * Exposes a `refetchSessions` callback to force a refresh (e.g. when streaming ends).
 */
export function useTaskChatSessions(
  /** The current active session ID (from useTaskChat). */
  currentSessionId: string | null,
  /** Workspace ID to filter sessions by. */
  workspaceId?: string,
): UseTaskChatSessionsReturn {
  const [sessions, setSessions] = useState<SessionIndexEntry[]>([])

  // Track the last params to avoid unnecessary refetches
  const lastParamsRef = useRef<{ sessionId: string | null; workspaceId: string | undefined }>({
    sessionId: undefined as unknown as string | null,
    workspaceId: undefined,
  })

  // Store workspace ID ref for refetch callback
  const workspaceIdRef = useRef(workspaceId)
  useEffect(() => {
    workspaceIdRef.current = workspaceId
  }, [workspaceId])

  /**
   * Force refetch sessions from the server.
   * Call this when the agent finishes streaming to update isActive flags.
   */
  const refetchSessions = useCallback(async () => {
    try {
      const result = await fetchTaskChatSessions({ workspaceId: workspaceIdRef.current })
      setSessions(result)
    } catch (error) {
      console.error("[useTaskChatSessions] Failed to refetch sessions:", error)
    }
  }, [])

  // Fetch sessions on mount and when currentSessionId or workspaceId changes
  useEffect(() => {
    if (
      lastParamsRef.current.sessionId === currentSessionId &&
      lastParamsRef.current.workspaceId === workspaceId
    ) {
      return
    }
    lastParamsRef.current = { sessionId: currentSessionId, workspaceId }

    const loadSessions = async () => {
      try {
        const result = await fetchTaskChatSessions({ workspaceId })
        setSessions(result)
      } catch (error) {
        console.error("[useTaskChatSessions] Failed to fetch sessions:", error)
      }
    }

    loadSessions()
  }, [currentSessionId, workspaceId])

  return {
    sessions,
    refetchSessions,
  }
}

/** Return type of the useTaskChatSessions hook. */
export interface UseTaskChatSessionsReturn {
  /** List of task-chat sessions. */
  sessions: SessionIndexEntry[]
  /** Force refetch sessions from the server (e.g., when streaming ends). */
  refetchSessions: () => Promise<void>
}
