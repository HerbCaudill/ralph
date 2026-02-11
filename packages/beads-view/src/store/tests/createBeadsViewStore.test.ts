import { beforeEach, describe, expect, it, vi } from "vitest"
import { configureApiClient } from "../../lib/apiClient"
import { createBeadsViewStore } from "../createBeadsViewStore"
import type { Task } from "../../types"

const STORAGE_KEY = "beads-view-store"
const WORKSPACE_STORAGE_KEY = "ralph-workspace-path"

const TASK_A: Task = {
  id: "a-1",
  title: "Workspace A task",
  status: "open",
}

const TASK_B: Task = {
  id: "b-1",
  title: "Workspace B task",
  status: "open",
}

describe("createBeadsViewStore workspace cache", () => {
  beforeEach(() => {
    localStorage.clear()
    configureApiClient({})
    vi.useRealTimers()
  })

  it("migrates legacy single-cache persisted tasks into workspace cache", async () => {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, "workspace/a")
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: {
          issuePrefix: null,
          accentColor: null,
          tasks: [TASK_A],
          taskSearchQuery: "",
          selectedTaskId: null,
          closedTimeFilter: "past_day",
          statusCollapsedState: { open: false, deferred: true, closed: true },
          parentCollapsedState: {},
          taskInputDraft: "",
          commentDrafts: {},
        },
        version: 0,
      }),
    )

    const store = createBeadsViewStore()
    expect(store.getState().tasks).toEqual([TASK_A])

    store.getState().setTaskSearchQuery("updated")

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as {
      state?: { taskCacheByWorkspace?: Record<string, Task[]> }
    }
    expect(persisted.state?.taskCacheByWorkspace?.["workspace/a"]).toEqual([TASK_A])
  })

  it("hydrates tasks for the selected workspace without showing other workspace tasks", () => {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, "workspace/a")
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: {
          issuePrefix: null,
          accentColor: null,
          tasks: [TASK_A],
          taskCacheByWorkspace: {
            "workspace/a": [TASK_A],
            "workspace/b": [TASK_B],
          },
          taskSearchQuery: "",
          selectedTaskId: null,
          closedTimeFilter: "past_day",
          statusCollapsedState: { open: false, deferred: true, closed: true },
          parentCollapsedState: {},
          taskInputDraft: "",
          commentDrafts: {},
        },
        version: 1,
      }),
    )

    const store = createBeadsViewStore()
    expect(store.getState().tasks).toEqual([TASK_A])

    const hydrateTasksForWorkspace = (
      store.getState() as { hydrateTasksForWorkspace?: (workspacePath: string) => void }
    ).hydrateTasksForWorkspace

    expect(hydrateTasksForWorkspace).toBeTypeOf("function")
    hydrateTasksForWorkspace?.("workspace/b")

    expect(store.getState().tasks).toEqual([TASK_B])
  })

  it("writes refresh results into the selected workspace cache", async () => {
    vi.useFakeTimers()
    localStorage.setItem(WORKSPACE_STORAGE_KEY, "workspace/a")
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, issues: [TASK_A] }),
    })
    global.fetch = fetchMock as typeof fetch

    const store = createBeadsViewStore()
    store.getState().refreshTasks()

    await vi.advanceTimersByTimeAsync(100)

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as {
      state?: { taskCacheByWorkspace?: Record<string, Task[]> }
    }

    expect(persisted.state?.taskCacheByWorkspace?.["workspace/a"]).toEqual([TASK_A])
  })

  it("caches comments by workspace and task ID", () => {
    const store = createBeadsViewStore()
    const commentsA = [
      {
        id: 1,
        issue_id: "task-123",
        author: "a",
        text: "workspace a comment",
        created_at: "2026-02-11T00:00:00Z",
      },
    ]
    const commentsB = [
      {
        id: 2,
        issue_id: "task-123",
        author: "b",
        text: "workspace b comment",
        created_at: "2026-02-11T00:00:01Z",
      },
    ]

    store.getState().setCachedCommentsForTask("task-123", commentsA, "workspace/a")
    store.getState().setCachedCommentsForTask("task-123", commentsB, "workspace/b")

    expect(store.getState().getCachedCommentsForTask("task-123", "workspace/a")).toEqual(commentsA)
    expect(store.getState().getCachedCommentsForTask("task-123", "workspace/b")).toEqual(commentsB)

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as {
      state?: { commentCacheByWorkspaceTask?: Record<string, unknown[]> }
    }

    expect(Object.keys(persisted.state?.commentCacheByWorkspaceTask ?? {})).toContain(
      "workspace/a::task-123",
    )
    expect(Object.keys(persisted.state?.commentCacheByWorkspaceTask ?? {})).toContain(
      "workspace/b::task-123",
    )
  })
})
