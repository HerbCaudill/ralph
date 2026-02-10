import { useState, useEffect, useRef } from "react"
import type { SessionIndexEntry } from "@herbcaudill/agent-view"
import { fetchTaskChatSessions } from "../lib/fetchTaskChatSessions"

/**
 * Hook that manages task-chat session history.
 * Fetches sessions on mount and when currentSessionId or workspaceId changes.
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
  }
}

/** Return type of the useTaskChatSessions hook. */
export interface UseTaskChatSessionsReturn {
  /** List of task-chat sessions. */
  sessions: SessionIndexEntry[]
}
