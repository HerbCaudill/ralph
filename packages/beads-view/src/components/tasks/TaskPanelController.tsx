import { useCallback } from "react"
import { TaskPanel } from "./TaskPanel"
import { type SearchInputHandle } from "./SearchInput"
import { useTasks } from "../../hooks"
import {
  useBeadsViewStore,
  selectTaskSearchQuery,
  selectClosedTimeFilter,
  selectTasks,
  selectInitialTaskCount,
  selectAccentColor,
} from "../../store"
import type { ClosedTasksTimeFilter } from "../../types"

/**
 * Controller component for TaskPanel.
 *
 * Connects data hooks to the TaskPanel presentational component.
 * Handles task loading and wires up the session history and progress bar.
 */
export function TaskPanelController({
  searchInputRef,
  onTaskClick,
  onOpenTask,
  activelyWorkingTaskIds,
  taskIdsWithSessions,
  isRunning = false,
  isLoadingExternal = false,
  hideQuickInput = true,
}: TaskPanelControllerProps) {
  const { tasks, isLoading: isLoadingTasks, refresh } = useTasks({ all: true })
  const isLoading = isLoadingTasks || isLoadingExternal
  const searchQuery = useBeadsViewStore(selectTaskSearchQuery)
  const closedTimeFilter = useBeadsViewStore(selectClosedTimeFilter)
  const setClosedTimeFilter = useBeadsViewStore(state => state.setClosedTimeFilter)
  const setVisibleTaskIds = useBeadsViewStore(state => state.setVisibleTaskIds)
  const allStoreTasks = useBeadsViewStore(selectTasks)
  const initialTaskCount = useBeadsViewStore(selectInitialTaskCount)
  const accentColor = useBeadsViewStore(selectAccentColor)

  const handleClosedTimeFilterChange = useCallback(
    (filter: ClosedTasksTimeFilter) => setClosedTimeFilter(filter),
    [setClosedTimeFilter],
  )

  const handleVisibleTaskIdsChange = useCallback(
    (ids: string[]) => setVisibleTaskIds(ids),
    [setVisibleTaskIds],
  )

  const handleTaskCreated = useCallback(() => {
    void refresh()
  }, [refresh])

  return (
    <TaskPanel
      tasks={tasks}
      onTaskClick={onTaskClick}
      isLoading={isLoading}
      activelyWorkingTaskIds={activelyWorkingTaskIds}
      taskIdsWithSessions={taskIdsWithSessions}
      searchQuery={searchQuery}
      closedTimeFilter={closedTimeFilter}
      onClosedTimeFilterChange={handleClosedTimeFilterChange}
      onVisibleTaskIdsChange={handleVisibleTaskIdsChange}
      showQuickInput={!hideQuickInput}
      onTaskCreated={handleTaskCreated}
      isRunning={isRunning}
      progressTasks={allStoreTasks}
      initialTaskCount={initialTaskCount}
      accentColor={accentColor}
      searchInputRef={searchInputRef}
      onOpenTask={onOpenTask}
    />
  )
}

/** Props for TaskPanelController component. */
export interface TaskPanelControllerProps {
  /** Ref to access SearchInput methods */
  searchInputRef?: React.RefObject<SearchInputHandle | null>
  /** Handler when a task is clicked */
  onTaskClick?: (taskId: string) => void
  /** Handler when a task should be opened */
  onOpenTask?: (taskId: string) => void
  /** Task IDs actively being worked on */
  activelyWorkingTaskIds?: string[]
  /** Task IDs with saved sessions */
  taskIdsWithSessions?: string[]
  /** Whether to show progress (host decides if Ralph is running). */
  isRunning?: boolean
  /** External loading state (e.g., when workspace is switching). */
  isLoadingExternal?: boolean
  /** Hide quick task input */
  hideQuickInput?: boolean
}
