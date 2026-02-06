import { createStore } from "zustand/vanilla"
import { createJSONStorage, persist } from "zustand/middleware"
import { apiFetch } from "../lib/apiClient"
import type { BeadsViewStore } from "./types"
import type { Task, TaskGroup } from "../types"

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
        taskSearchQuery: "",
        selectedTaskId: null,
        visibleTaskIds: [],
        closedTimeFilter: "past_day",
        statusCollapsedState: DEFAULT_STATUS_COLLAPSED_STATE,
        parentCollapsedState: {},
        taskInputDraft: "",
        commentDrafts: {},
        setIssuePrefix: prefix => set({ issuePrefix: prefix }),
        setAccentColor: color => set({ accentColor: color }),
        setTasks: tasks => set({ tasks }),
        updateTask: (id, updates) =>
          set(state => ({
            tasks: state.tasks.map(task => (task.id === id ? { ...task, ...updates } : task)),
          })),
        removeTask: id =>
          set(state => ({
            tasks: state.tasks.filter(task => task.id !== id),
          })),
        clearTasks: () => set({ tasks: [] }),
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
              if (data.ok && data.issues) {
                set({ tasks: data.issues })
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
        ...initialState,
      }),
      {
        name: "beads-view-store",
        storage: createJSONStorage(() => localStorage),
        partialize: state => ({
          issuePrefix: state.issuePrefix,
          accentColor: state.accentColor,
          tasks: state.tasks,
          taskSearchQuery: state.taskSearchQuery,
          selectedTaskId: state.selectedTaskId,
          closedTimeFilter: state.closedTimeFilter,
          statusCollapsedState: state.statusCollapsedState,
          parentCollapsedState: state.parentCollapsedState,
          taskInputDraft: state.taskInputDraft,
          commentDrafts: state.commentDrafts,
        }),
      },
    ),
  )
}
