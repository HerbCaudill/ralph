import type { AgentType, SessionIndexEntry } from "@herbcaudill/agent-view"
import type { TaskResponse } from "@herbcaudill/beads-view"

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
  }>
}

/** Options for fetchRalphSessions. */
export interface FetchRalphSessionsOptions {
  /** Base URL for the agent server (e.g., "http://localhost:4244"). Defaults to "". */
  baseUrl?: string
  /** Custom fetch function for testing. */
  fetchFn?: typeof fetch
}

/**
 * Fetch Ralph sessions from the agent server and resolve task titles.
 * Returns sessions sorted by lastMessageAt (most recent first).
 */
export async function fetchRalphSessions(
  /** Options for the fetch operation. */
  options: FetchRalphSessionsOptions = {},
): Promise<RalphSessionIndexEntry[]> {
  const { baseUrl = "", fetchFn = fetch } = options

  try {
    const response = await fetchFn(`${baseUrl}/api/sessions?app=ralph&include=summary`)
    if (!response.ok) {
      return []
    }

    const data = (await response.json()) as SessionsResponse
    const sessions = data.sessions ?? []

    // Transform to RalphSessionIndexEntry and resolve task titles in parallel
    const entries = await Promise.all(
      sessions.map(async (session): Promise<RalphSessionIndexEntry> => {
        const entry: RalphSessionIndexEntry = {
          sessionId: session.sessionId,
          adapter: (session.adapter || "claude") as AgentType,
          firstMessageAt: session.createdAt,
          lastMessageAt: session.lastMessageAt ?? session.createdAt,
          firstUserMessage: session.taskId ?? "",
          taskId: session.taskId,
        }

        // Resolve task title if we have a taskId
        if (session.taskId) {
          const taskTitle = await resolveTaskTitle(session.taskId, fetchFn)
          if (taskTitle) {
            entry.taskTitle = taskTitle
          }
        }

        return entry
      }),
    )

    // Sort by lastMessageAt descending (most recent first)
    return entries.sort((a, b) => b.lastMessageAt - a.lastMessageAt)
  } catch {
    return []
  }
}

/** Resolve a task title from the beads server. */
async function resolveTaskTitle(
  /** The task ID to look up. */
  taskId: string,
  /** Fetch function to use. */
  fetchFn: typeof fetch,
): Promise<string | undefined> {
  try {
    const response = await fetchFn(`/api/tasks/${taskId}`)
    if (!response.ok) {
      return undefined
    }

    const data = (await response.json()) as TaskResponse
    if (data.ok && data.issue) {
      return data.issue.title
    }

    return undefined
  } catch {
    return undefined
  }
}
