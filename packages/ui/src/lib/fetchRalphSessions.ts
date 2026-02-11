import type { AgentType, SessionIndexEntry } from "@herbcaudill/agent-view"
import { getWorkspaceId } from "@herbcaudill/ralph-shared"

/** Extended session index entry with task details for Ralph sessions. */
export interface RalphSessionIndexEntry extends SessionIndexEntry {
  /** The task ID this session worked on (from start_task tag). */
  taskId?: string
  /** The resolved title of the task. */
  taskTitle?: string
}

/** Response from GET /api/sessions?app=ralph&include=summary. */
interface SessionsResponse {
  sessions: Array<{
    sessionId: string
    adapter: string
    createdAt: number
    lastMessageAt?: number
    taskId?: string
    /** Working directory this session was created in. */
    cwd?: string
    /** Session status: "idle" | "processing" | "error". */
    status?: string
  }>
}

/** Minimal task shape needed for title lookup. */
interface TaskLike {
  /** Task identifier. */
  id: string
  /** Task title. */
  title: string
}

/** Options for fetchRalphSessions. */
export interface FetchRalphSessionsOptions {
  /** Base URL for the agent server (e.g., "http://localhost:4244"). Defaults to "". */
  baseUrl?: string
  /** Custom fetch function for testing. */
  fetchFn?: typeof fetch
  /** Workspace ID (`owner/repo`) to include as a query parameter for task lookups. */
  workspaceId?: string
  /** Local tasks array to look up task titles from (avoids API calls). */
  tasks?: TaskLike[]
}

/**
 * Fetch Ralph sessions from the agent server and resolve task titles from the local task cache.
 * Returns sessions sorted by lastMessageAt (most recent first).
 */
export async function fetchRalphSessions(
  /** Options for the fetch operation. */
  options: FetchRalphSessionsOptions = {},
): Promise<RalphSessionIndexEntry[]> {
  const { baseUrl = "", fetchFn = fetch, workspaceId, tasks = [] } = options

  // Build a lookup map from task ID to title for O(1) resolution
  const taskTitleMap = new Map(tasks.map(t => [t.id, t.title]))

  try {
    const response = await fetchFn(`${baseUrl}/api/sessions?app=ralph&include=summary`)
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

    // Transform to RalphSessionIndexEntry and resolve task titles from local cache
    const entries = sessions.map((session): RalphSessionIndexEntry => {
      const entry: RalphSessionIndexEntry = {
        sessionId: session.sessionId,
        adapter: (session.adapter || "claude") as AgentType,
        firstMessageAt: session.createdAt,
        lastMessageAt: session.lastMessageAt ?? session.createdAt,
        firstUserMessage: session.taskId ?? "",
        taskId: session.taskId,
        // Mark session as active when status is "processing"
        isActive: session.status === "processing",
      }

      // Look up task title from local cache
      if (session.taskId) {
        const title = taskTitleMap.get(session.taskId)
        if (title) {
          entry.taskTitle = title
        }
      }

      return entry
    })

    // Sort by lastMessageAt descending (most recent first)
    return entries.sort((a, b) => b.lastMessageAt - a.lastMessageAt)
  } catch {
    return []
  }
}
