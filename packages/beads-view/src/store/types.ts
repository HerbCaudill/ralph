import type { ClosedTasksTimeFilter, Task, TaskGroup } from "../types"

/** Beads-view store state. */
export interface BeadsViewState {
  /** Issue prefix for the current workspace. */
  issuePrefix: string | null
  /** Accent color for task UI accents. */
  accentColor: string | null
  /** Task count at the start of a run. */
  initialTaskCount: number | null
  /** Tasks loaded from beads. */
  tasks: Task[]
  /** Task search query string. */
  taskSearchQuery: string
  /** Selected task ID for keyboard navigation. */
  selectedTaskId: string | null
  /** Visible task IDs for keyboard navigation. */
  visibleTaskIds: string[]
  /** Closed task time filter. */
  closedTimeFilter: ClosedTasksTimeFilter
  /** Collapsed state for status groups. */
  statusCollapsedState: Record<TaskGroup, boolean>
  /** Collapsed state for parent groups. */
  parentCollapsedState: Record<string, boolean>
  /** Draft text for the task input. */
  taskInputDraft: string
  /** Draft comments keyed by task ID. */
  commentDrafts: Record<string, string>
}

/** Beads-view store actions. */
export interface BeadsViewActions {
  /** Set the issue prefix. */
  setIssuePrefix: (prefix: string | null) => void
  /** Set the accent color. */
  setAccentColor: (color: string | null) => void
  /** Replace all tasks. */
  setTasks: (tasks: Task[]) => void
  /** Update a task by ID. */
  updateTask: (id: string, updates: Partial<Task>) => void
  /** Remove a task by ID. */
  removeTask: (id: string) => void
  /** Clear all tasks. */
  clearTasks: () => void
  /** Refresh tasks from the API (debounced). */
  refreshTasks: () => void
  /** Set the task search query. */
  setTaskSearchQuery: (query: string) => void
  /** Clear the task search query. */
  clearTaskSearchQuery: () => void
  /** Set the selected task ID. */
  setSelectedTaskId: (id: string | null) => void
  /** Clear the selected task ID. */
  clearSelectedTaskId: () => void
  /** Set the visible task IDs. */
  setVisibleTaskIds: (ids: string[]) => void
  /** Set the closed tasks time filter. */
  setClosedTimeFilter: (filter: ClosedTasksTimeFilter) => void
  /** Set collapsed state for status groups. */
  setStatusCollapsedState: (state: Record<TaskGroup, boolean>) => void
  /** Toggle a status group collapsed state. */
  toggleStatusGroup: (group: TaskGroup) => void
  /** Set collapsed state for parent groups. */
  setParentCollapsedState: (state: Record<string, boolean>) => void
  /** Toggle a parent group collapsed state. */
  toggleParentGroup: (parentId: string) => void
  /** Set the task input draft. */
  setTaskInputDraft: (draft: string) => void
  /** Set the initial task count for a run. */
  setInitialTaskCount: (count: number | null) => void
  /** Set a comment draft for a task. */
  setCommentDraft: (taskId: string, draft: string) => void
  /** Clear a comment draft for a task. */
  clearCommentDraft: (taskId: string) => void
}

/** Combined beads-view store shape. */
export type BeadsViewStore = BeadsViewState & BeadsViewActions
