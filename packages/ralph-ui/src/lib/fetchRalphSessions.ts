import type { AgentType, SessionIndexEntry } from "@herbcaudill/agent-view"
import { getWorkspaceId } from "@herbcaudill/beads-sdk"
import { fetchSessionEvents } from "./fetchSessionEvents"
import { extractTaskIdFromEvents, getSessionTaskId, setSessionTaskId } from "./sessionTaskIdCache"

/** Extended session index entry with task details for Ralph sessions. */
export interface RalphSessionIndexEntry extends SessionIndexEntry {
  /** The task ID this session worked on (from start_task tag). */
  taskId?: string
  /** The resolved title of the task. */
  taskTitle?: string
}

/** Session metadata returned by GET /api/sessions. */
interface SessionSummary {
  sessionId: string
  adapter: string
  createdAt: number
  lastMessageAt?: number
  /** Working directory this session was created in. */
  cwd?: string
  /** App namespace for the session (for example `task-chat` or a worker name). */
  app?: string
  /** Workspace identifier when the server knows it. */
  workspace?: string
  /** Session status: "idle" | "processing" | "error". */
  status?: string
}

/** Response from GET /api/sessions. */
interface SessionsResponse {
  sessions: SessionSummary[]
}

/** Minimal task shape needed for title lookup. */
interface TaskLike {
  /** Task identifier. */
  id: string
  /** Task title. */
  title: string
}

/** Check whether a session belongs to the current Ralph workspace. */
function isSessionInWorkspace(
  /** The session metadata from the server. */
  session: SessionSummary,
  /** The current workspace identifier. */
  workspaceId?: string,
): boolean {
  if (!workspaceId) return true

  const normalizedWorkspaceId = workspaceId.toLowerCase()

  if (session.workspace?.toLowerCase() === normalizedWorkspaceId) {
    return true
  }

  if (!session.cwd) {
    return false
  }

  if (getWorkspaceId({ workspacePath: session.cwd }) === normalizedWorkspaceId) {
    return true
  }

  const segments = session.cwd.split("/").filter(Boolean)
  const [, expectedRepo] = normalizedWorkspaceId.split("/")
  const worktreesDir = `.${expectedRepo}-worktrees`

  return segments.includes(worktreesDir)
}

/** Check whether a session should appear in Ralph's session picker. */
function isRalphSession(
  /** The session metadata from the server. */
  session: SessionSummary,
): boolean {
  return session.app !== "task-chat"
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
 * Fetch Ralph sessions from the agent server and resolve task IDs from client-side cache.
 * For sessions without cached task IDs, fetches events and extracts the task ID.
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
    const response = await fetchFn(`${baseUrl}/api/sessions`)
    if (!response.ok) {
      return []
    }

    const data = (await response.json()) as SessionsResponse
    const allSessions = data.sessions ?? []

    // Filter to Ralph sessions for the current workspace, including worker worktrees.
    const sessions = allSessions.filter(session => {
      return isRalphSession(session) && isSessionInWorkspace(session, workspaceId)
    })

    // Resolve task IDs: check localStorage cache first, fetch events for uncached sessions
    const uncachedSessions = sessions.filter(s => !getSessionTaskId(s.sessionId))

    // Fetch events in parallel for uncached sessions and extract task IDs
    await Promise.all(
      uncachedSessions.map(async session => {
        const events = await fetchSessionEvents(session.sessionId, { baseUrl, fetchFn })
        const taskId = extractTaskIdFromEvents(events)
        if (taskId) {
          setSessionTaskId(session.sessionId, taskId)
        }
      }),
    )

    /** Build a task lookup URL, preserving workspace scoping when available. */
    const getTaskUrl = (
      /** The task identifier to fetch. */
      taskId: string,
    ): string => {
      const query = workspaceId ? `?workspace=${encodeURIComponent(workspaceId)}` : ""
      return `${baseUrl}/api/tasks/${taskId}${query}`
    }

    const missingTaskIds = Array.from(
      new Set(
        sessions
          .map(session => getSessionTaskId(session.sessionId))
          .filter((taskId): taskId is string => Boolean(taskId && !taskTitleMap.has(taskId))),
      ),
    )

    const fetchedTaskTitles = new Map<string, string>()

    await Promise.all(
      missingTaskIds.map(async taskId => {
        try {
          const taskResponse = await fetchFn(getTaskUrl(taskId))
          if (!taskResponse.ok) return

          const taskData = (await taskResponse.json()) as {
            ok?: boolean
            issue?: { title?: string }
          }
          const title = taskData.issue?.title
          if (taskData.ok && title) {
            fetchedTaskTitles.set(taskId, title)
          }
        } catch {
          // Ignore task title lookup failures and fall back to showing only the task ID.
        }
      }),
    )

    // Transform to RalphSessionIndexEntry with resolved task IDs and titles
    const entries = sessions.map((session): RalphSessionIndexEntry => {
      const taskId = getSessionTaskId(session.sessionId)

      const entry: RalphSessionIndexEntry = {
        sessionId: session.sessionId,
        adapter: (session.adapter || "claude") as AgentType,
        firstMessageAt: session.createdAt,
        lastMessageAt: session.lastMessageAt ?? session.createdAt,
        firstUserMessage: taskId ?? "",
        taskId,
        // Mark session as active when status is "processing"
        isActive: session.status === "processing",
      }

      if (taskId) {
        entry.taskTitle = taskTitleMap.get(taskId) ?? fetchedTaskTitles.get(taskId)
      }

      return entry
    })

    // Sort by lastMessageAt descending (most recent first)
    return entries.sort((a, b) => b.lastMessageAt - a.lastMessageAt)
  } catch {
    return []
  }
}
