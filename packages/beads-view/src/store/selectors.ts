import type { BeadsViewState } from "./types"

/** Select the task list. */
export const selectTasks = (state: BeadsViewState) => state.tasks

/** Select the issue prefix. */
export const selectIssuePrefix = (state: BeadsViewState) => state.issuePrefix

/** Select the accent color. */
export const selectAccentColor = (state: BeadsViewState) => state.accentColor

/** Select the task search query. */
export const selectTaskSearchQuery = (state: BeadsViewState) => state.taskSearchQuery

/** Select the selected task ID. */
export const selectSelectedTaskId = (state: BeadsViewState) => state.selectedTaskId

/** Select the visible task IDs. */
export const selectVisibleTaskIds = (state: BeadsViewState) => state.visibleTaskIds

/** Select the closed tasks time filter. */
export const selectClosedTimeFilter = (state: BeadsViewState) => state.closedTimeFilter

/** Select the status collapsed state map. */
export const selectStatusCollapsedState = (state: BeadsViewState) => state.statusCollapsedState

/** Select the parent collapsed state map. */
export const selectParentCollapsedState = (state: BeadsViewState) => state.parentCollapsedState

/** Select the task input draft. */
export const selectTaskInputDraft = (state: BeadsViewState) => state.taskInputDraft

/** Select the initial task count. */
export const selectInitialTaskCount = (state: BeadsViewState) => state.initialTaskCount

/** Select the comment drafts map. */
export const selectCommentDrafts = (state: BeadsViewState) => state.commentDrafts

/** Select a comment draft by task ID. */
export function selectCommentDraft(
  /** Store state. */
  state: BeadsViewState,
  /** Task ID. */
  taskId: string,
): string {
  return state.commentDrafts[taskId] ?? ""
}
