import type { AgentType, SessionIndexEntry } from "@herbcaudill/agent-view"
import { getWorkspaceId } from "@herbcaudill/beads-sdk"

/** Response from GET /api/sessions?app=task-chat&include=summary. */
interface SessionsResponse {
  sessions: Array<{
    sessionId: string
    adapter: string
    createdAt: number
    lastMessageAt?: number
    /** Working directory this session was created in. */
    cwd?: string
    /** Session status: "idle" | "processing" | "error". */
    status?: string
    /** Preview text from the first user message in the session. */
    firstUserMessage?: string
  }>
}

/** Options for fetchTaskChatSessions. */
export interface FetchTaskChatSessionsOptions {
  /** Base URL for the agent server (e.g., "http://localhost:4244"). Defaults to "". */
  baseUrl?: string
  /** Custom fetch function for testing. */
  fetchFn?: typeof fetch
  /** Workspace ID (`owner/repo`) to filter sessions by. */
  workspaceId?: string
}

/**
 * Fetch task-chat sessions from the agent server.
 * Returns sessions sorted by lastMessageAt (most recent first).
 */
export async function fetchTaskChatSessions(
  /** Options for the fetch operation. */
  options: FetchTaskChatSessionsOptions = {},
): Promise<SessionIndexEntry[]> {
  const { baseUrl = "", fetchFn = fetch, workspaceId } = options

  try {
    const response = await fetchFn(`${baseUrl}/api/sessions?app=task-chat&include=summary`)
    if (!response.ok) {
      return []
    }

    const data = (await response.json()) as SessionsResponse
    const allSessions = data.sessions ?? []

    // Filter to sessions matching the current workspace
    const sessions =
      workspaceId ?
        allSessions.filter(s => s.cwd && getWorkspaceId({ workspacePath: s.cwd }) === workspaceId)
      : allSessions

    // Transform to SessionIndexEntry
    const entries: SessionIndexEntry[] = sessions.map(session => ({
      sessionId: session.sessionId,
      adapter: (session.adapter || "claude") as AgentType,
      firstMessageAt: session.createdAt,
      lastMessageAt: session.lastMessageAt ?? session.createdAt,
      firstUserMessage: session.firstUserMessage ?? "",
      // Mark session as active when status is "processing"
      isActive: session.status === "processing",
    }))

    // Sort by lastMessageAt descending (most recent first)
    return entries.sort((a, b) => b.lastMessageAt - a.lastMessageAt)
  } catch {
    return []
  }
}
