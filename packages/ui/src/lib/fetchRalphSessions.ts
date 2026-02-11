import type { AgentType, SessionIndexEntry } from "@herbcaudill/agent-view"
import type { TaskResponse } from "@herbcaudill/beads-view"
import { getWorkspaceId } from "@herbcaudill/ralph-shared"

/** Sentinel value for task IDs that were looked up but not found. */
const NOT_FOUND = Symbol("not-found")

/** Cache for resolved task titles to avoid repeated API calls. */
const taskTitleCache = new Map<string, string | typeof NOT_FOUND>()

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

/** Options for fetchRalphSessions. */
export interface FetchRalphSessionsOptions {
  /** Base URL for the agent server (e.g., "http://localhost:4244"). Defaults to "". */
  baseUrl?: string
  /** Custom fetch function for testing. */
  fetchFn?: typeof fetch
  /** Workspace ID (`owner/repo`) to include as a query parameter for task lookups. */
  workspaceId?: string
}

/**
 * Fetch Ralph sessions from the agent server and resolve task titles.
 * Returns sessions sorted by lastMessageAt (most recent first).
 */
export async function fetchRalphSessions(
  /** Options for the fetch operation. */
  options: FetchRalphSessionsOptions = {},
): Promise<RalphSessionIndexEntry[]> {
  const { baseUrl = "", fetchFn = fetch, workspaceId } = options

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
          // Mark session as active when status is "processing"
          isActive: session.status === "processing",
        }

        // Resolve task title if we have a taskId
        if (session.taskId) {
          const taskTitle = await resolveTaskTitle(session.taskId, baseUrl, fetchFn, workspaceId)
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

/**
 * Resolve a task title from the beads server.
 * Results are cached to avoid repeated API calls for the same task ID.
 */
async function resolveTaskTitle(
  /** The task ID to look up. */
  taskId: string,
  /** Base URL for the beads server. */
  baseUrl: string,
  /** Fetch function to use. */
  fetchFn: typeof fetch,
  /** Workspace ID to include as query param. */
  workspaceId?: string,
): Promise<string | undefined> {
  // Check cache first (includes negative results)
  const cached = taskTitleCache.get(taskId)
  if (cached !== undefined) {
    return cached === NOT_FOUND ? undefined : cached
  }

  try {
    let url = `${baseUrl}/api/tasks/${taskId}`
    if (workspaceId) {
      url += `?workspace=${encodeURIComponent(workspaceId)}`
    }
    const response = await fetchFn(url)
    if (!response.ok) {
      taskTitleCache.set(taskId, NOT_FOUND)
      return undefined
    }

    const data = (await response.json()) as TaskResponse
    if (data.ok && data.issue) {
      taskTitleCache.set(taskId, data.issue.title)
      return data.issue.title
    }

    taskTitleCache.set(taskId, NOT_FOUND)
    return undefined
  } catch {
    // Don't cache network errors — they may be transient
    return undefined
  }
}

/** Clear the task title cache. Useful for testing. */
export function clearTaskTitleCache(): void {
  taskTitleCache.clear()
}
