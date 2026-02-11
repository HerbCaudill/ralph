import { createStore } from "zustand/vanilla"
import { createJSONStorage, persist } from "zustand/middleware"
import { apiFetch, getApiClientConfig } from "../lib/apiClient"
import type { BeadsViewStore } from "./types"
import type { Task, TaskGroup, Comment } from "../types"

/** Default collapsed state for status groups. */
const DEFAULT_STATUS_COLLAPSED_STATE: Record<TaskGroup, boolean> = {
  open: false,
  deferred: true,
  closed: true,
}

/** Debounce window for task refresh requests (ms). */
const TASK_REFRESH_DEBOUNCE_MS = 50

/** Maximum number of comment drafts to keep. */
const MAX_COMMENT_DRAFTS = 50

/** LocalStorage key for persisted workspace path. */
const WORKSPACE_STORAGE_KEY = "ralph-workspace-path"

/** Fallback key when no workspace is selected. */
const DEFAULT_WORKSPACE_CACHE_KEY = "__default__"

/** Persist version for workspace-scoped task cache support. */
const PERSIST_VERSION = 2

/** Separator used for workspace/task comment cache keys. */
const WORKSPACE_TASK_KEY_SEPARATOR = "::"

/**
 * Resolve the active workspace cache key.
 * Prefers explicit path, then localStorage, then apiClient config.
 */
function getWorkspaceCacheKey(
  /** Explicit workspace path/ID to use. */
  workspacePath?: string,
): string {
  if (workspacePath?.trim()) return workspacePath.trim()

  try {
    const savedWorkspacePath = localStorage.getItem(WORKSPACE_STORAGE_KEY)
    if (savedWorkspacePath?.trim()) return savedWorkspacePath.trim()
  } catch {
    // Ignore storage errors.
  }

  const config = getApiClientConfig()
  if (config.workspaceId?.trim()) return config.workspaceId.trim()
  if (config.workspacePath?.trim()) return config.workspacePath.trim()
  return DEFAULT_WORKSPACE_CACHE_KEY
}

/**
 * Build an updated workspace task cache map from the current state and task list.
 */
function createUpdatedWorkspaceTaskCache(
  /** Existing cache map. */
  taskCacheByWorkspace: Record<string, Task[]>,
  /** Task list to store for the active workspace. */
  tasks: Task[],
  /** Optional explicit workspace path/ID. */
  workspacePath?: string,
): Record<string, Task[]> {
  const workspaceKey = getWorkspaceCacheKey(workspacePath)
  return {
    ...taskCacheByWorkspace,
    [workspaceKey]: tasks,
  }
}

/**
 * Build the comments cache key for a workspace/task pair.
 */
function buildWorkspaceTaskCommentCacheKey(
  /** Task ID to scope comments to. */
  taskId: string,
  /** Optional explicit workspace path/ID. */
  workspacePath?: string,
): string {
  const workspaceKey = getWorkspaceCacheKey(workspacePath)
  return `${workspaceKey}${WORKSPACE_TASK_KEY_SEPARATOR}${taskId}`
}

/**
 * Get cached comments for a specific workspace/task pair.
 */
function getCachedCommentsByWorkspaceTask(
  /** Comment cache keyed by workspace/task. */
  commentCacheByWorkspaceTask: Record<string, Comment[]>,
  /** Task ID to load comments for. */
  taskId: string,
  /** Optional explicit workspace path/ID. */
  workspacePath?: string,
): Comment[] {
  const key = buildWorkspaceTaskCommentCacheKey(taskId, workspacePath)
  return commentCacheByWorkspaceTask[key] ?? []
}

/**
 * Update cached comments for a specific workspace/task pair.
 */
function updateCachedCommentsByWorkspaceTask(
  /** Existing comment cache keyed by workspace/task. */
  commentCacheByWorkspaceTask: Record<string, Comment[]>,
  /** Task ID to store comments for. */
  taskId: string,
  /** Comments to store. */
  comments: Comment[],
  /** Optional explicit workspace path/ID. */
  workspacePath?: string,
): Record<string, Comment[]> {
  const key = buildWorkspaceTaskCommentCacheKey(taskId, workspacePath)
  return {
    ...commentCacheByWorkspaceTask,
    [key]: comments,
  }
}

/** Create a beads-view store instance. */
export function createBeadsViewStore(
  /** Optional initial state overrides. */
  initialState: Partial<BeadsViewStore> = {},
) {
  let taskRefreshPending = false
  let taskRefreshDebounceTimeout: ReturnType<typeof setTimeout> | null = null

  return createStore<BeadsViewStore>()(
    persist(
      (set, get) => ({
        issuePrefix: null,
        accentColor: null,
        initialTaskCount: null,
        tasks: [],
        taskCacheByWorkspace: {},
        taskSearchQuery: "",
        selectedTaskId: null,
        visibleTaskIds: [],
        closedTimeFilter: "past_day",
        statusCollapsedState: DEFAULT_STATUS_COLLAPSED_STATE,
        parentCollapsedState: {},
        taskInputDraft: "",
        commentDrafts: {},
        commentCacheByWorkspaceTask: {},
        setIssuePrefix: prefix => set({ issuePrefix: prefix }),
        setAccentColor: color => set({ accentColor: color }),
        setTasks: tasks =>
          set(state => ({
            tasks,
            taskCacheByWorkspace: createUpdatedWorkspaceTaskCache(
              state.taskCacheByWorkspace,
              tasks,
            ),
          })),
        updateTask: (id, updates) =>
          set(state => ({
            tasks: state.tasks.map(task => (task.id === id ? { ...task, ...updates } : task)),
            taskCacheByWorkspace: createUpdatedWorkspaceTaskCache(
              state.taskCacheByWorkspace,
              state.tasks.map(task => (task.id === id ? { ...task, ...updates } : task)),
            ),
          })),
        removeTask: id =>
          set(state => ({
            tasks: state.tasks.filter(task => task.id !== id),
            taskCacheByWorkspace: createUpdatedWorkspaceTaskCache(
              state.taskCacheByWorkspace,
              state.tasks.filter(task => task.id !== id),
            ),
          })),
        clearTasks: () =>
          set(state => ({
            tasks: [],
            taskCacheByWorkspace: createUpdatedWorkspaceTaskCache(state.taskCacheByWorkspace, []),
          })),
        hydrateTasksForWorkspace: workspacePath =>
          set(state => {
            const workspaceKey = getWorkspaceCacheKey(workspacePath)
            return {
              tasks: state.taskCacheByWorkspace[workspaceKey] ?? [],
            }
          }),
        refreshTasks: () => {
          taskRefreshPending = true
          if (taskRefreshDebounceTimeout !== null) return

          taskRefreshDebounceTimeout = setTimeout(async () => {
            taskRefreshDebounceTimeout = null
            if (!taskRefreshPending) return
            taskRefreshPending = false

            try {
              const response = await apiFetch("/api/tasks?all=true")
              const data = (await response.json()) as { ok: boolean; issues?: Task[] }
              const issues = data.issues
              if (data.ok && issues) {
                set(state => ({
                  tasks: issues,
                  taskCacheByWorkspace: createUpdatedWorkspaceTaskCache(
                    state.taskCacheByWorkspace,
                    issues,
                  ),
                }))
              }
            } catch (err) {
              console.error("Failed to refresh tasks:", err)
            }
          }, TASK_REFRESH_DEBOUNCE_MS)
        },
        setTaskSearchQuery: query => set({ taskSearchQuery: query }),
        clearTaskSearchQuery: () => set({ taskSearchQuery: "" }),
        setSelectedTaskId: id => set({ selectedTaskId: id }),
        clearSelectedTaskId: () => set({ selectedTaskId: null }),
        setVisibleTaskIds: ids => {
          const current = get().visibleTaskIds
          // Only update if the arrays actually differ to prevent infinite loops
          if (current.length === ids.length && current.every((id, i) => id === ids[i])) {
            return
          }
          set({ visibleTaskIds: ids })
        },
        setClosedTimeFilter: filter => set({ closedTimeFilter: filter }),
        setStatusCollapsedState: state => set({ statusCollapsedState: state }),
        toggleStatusGroup: group =>
          set(state => ({
            statusCollapsedState: {
              ...state.statusCollapsedState,
              [group]: !state.statusCollapsedState[group],
            },
          })),
        setParentCollapsedState: state => set({ parentCollapsedState: state }),
        toggleParentGroup: parentId =>
          set(state => ({
            parentCollapsedState: {
              ...state.parentCollapsedState,
              [parentId]: !state.parentCollapsedState[parentId],
            },
          })),
        setTaskInputDraft: draft => set({ taskInputDraft: draft }),
        setInitialTaskCount: count => set({ initialTaskCount: count }),
        setCommentDraft: (taskId, draft) =>
          set(state => {
            if (!draft) {
              const { [taskId]: _, ...rest } = state.commentDrafts
              return { commentDrafts: rest }
            }
            const updated = {
              ...state.commentDrafts,
              [taskId]: draft,
            }
            const keys = Object.keys(updated)
            if (keys.length > MAX_COMMENT_DRAFTS) {
              const excess = keys.length - MAX_COMMENT_DRAFTS
              for (let i = 0; i < excess; i++) {
                delete updated[keys[i]]
              }
            }
            return { commentDrafts: updated }
          }),
        clearCommentDraft: taskId =>
          set(state => {
            const { [taskId]: _, ...rest } = state.commentDrafts
            return { commentDrafts: rest }
          }),
        getCachedCommentsForTask: (taskId, workspacePath) =>
          getCachedCommentsByWorkspaceTask(
            get().commentCacheByWorkspaceTask,
            taskId,
            workspacePath,
          ),
        setCachedCommentsForTask: (taskId, comments, workspacePath) =>
          set(state => ({
            commentCacheByWorkspaceTask: updateCachedCommentsByWorkspaceTask(
              state.commentCacheByWorkspaceTask,
              taskId,
              comments,
              workspacePath,
            ),
          })),
        ...initialState,
      }),
      {
        name: "beads-view-store",
        version: PERSIST_VERSION,
        storage: createJSONStorage(() => localStorage),
        migrate: persistedState => {
          const state = persistedState as Partial<BeadsViewStore> | undefined
          if (!state) return persistedState

          const hasWorkspaceCache =
            typeof state.taskCacheByWorkspace === "object" && state.taskCacheByWorkspace !== null
          const hasCommentWorkspaceTaskCache =
            typeof state.commentCacheByWorkspaceTask === "object" &&
            state.commentCacheByWorkspaceTask !== null

          if (hasWorkspaceCache && hasCommentWorkspaceTaskCache) return state
          if (hasWorkspaceCache) {
            return {
              ...state,
              commentCacheByWorkspaceTask: state.commentCacheByWorkspaceTask ?? {},
            }
          }

          const workspaceKey = getWorkspaceCacheKey()
          const tasks = Array.isArray(state.tasks) ? state.tasks : []
          return {
            ...state,
            taskCacheByWorkspace: {
              [workspaceKey]: tasks,
            },
            commentCacheByWorkspaceTask: state.commentCacheByWorkspaceTask ?? {},
          }
        },
        merge: (persistedState, currentState) => {
          const state = persistedState as Partial<BeadsViewStore> | undefined
          if (!state) return currentState

          const taskCacheByWorkspace = state.taskCacheByWorkspace ?? {}
          const workspaceKey = getWorkspaceCacheKey()
          return {
            ...currentState,
            ...state,
            taskCacheByWorkspace,
            tasks: taskCacheByWorkspace[workspaceKey] ?? [],
            commentCacheByWorkspaceTask: state.commentCacheByWorkspaceTask ?? {},
          }
        },
        partialize: state => ({
          issuePrefix: state.issuePrefix,
          accentColor: state.accentColor,
          tasks: state.tasks,
          taskCacheByWorkspace: state.taskCacheByWorkspace,
          taskSearchQuery: state.taskSearchQuery,
          selectedTaskId: state.selectedTaskId,
          closedTimeFilter: state.closedTimeFilter,
          statusCollapsedState: state.statusCollapsedState,
          parentCollapsedState: state.parentCollapsedState,
          taskInputDraft: state.taskInputDraft,
          commentDrafts: state.commentDrafts,
          commentCacheByWorkspaceTask: state.commentCacheByWorkspaceTask,
        }),
      },
    ),
  )
}
