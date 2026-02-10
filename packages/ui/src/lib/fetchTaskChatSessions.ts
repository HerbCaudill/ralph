import type { AgentType, SessionIndexEntry } from "@herbcaudill/agent-view"

/** Response from GET /api/sessions?app=task-chat. */
interface SessionsResponse {
  sessions: Array<{
    sessionId: string
    adapter: string
    createdAt: number
    lastMessageAt?: number
    /** Session status: "idle" | "processing" | "error". */
    status?: string
  }>
}

/** Options for fetchTaskChatSessions. */
export interface FetchTaskChatSessionsOptions {
  /** Base URL for the agent server (e.g., "http://localhost:4244"). Defaults to "". */
  baseUrl?: string
  /** Custom fetch function for testing. */
  fetchFn?: typeof fetch
}

/**
 * Fetch task-chat sessions from the agent server.
 * Returns sessions sorted by lastMessageAt (most recent first).
 */
export async function fetchTaskChatSessions(
  /** Options for the fetch operation. */
  options: FetchTaskChatSessionsOptions = {},
): Promise<SessionIndexEntry[]> {
  const { baseUrl = "", fetchFn = fetch } = options

  try {
    const response = await fetchFn(`${baseUrl}/api/sessions?app=task-chat`)
    if (!response.ok) {
      return []
    }

    const data = (await response.json()) as SessionsResponse
    const sessions = data.sessions ?? []

    // Transform to SessionIndexEntry
    const entries: SessionIndexEntry[] = sessions.map(session => ({
      sessionId: session.sessionId,
      adapter: (session.adapter || "claude") as AgentType,
      firstMessageAt: session.createdAt,
      lastMessageAt: session.lastMessageAt ?? session.createdAt,
      firstUserMessage: "",
      // Mark session as active when status is "processing"
      isActive: session.status === "processing",
    }))

    // Sort by lastMessageAt descending (most recent first)
    return entries.sort((a, b) => b.lastMessageAt - a.lastMessageAt)
  } catch {
    return []
  }
}
