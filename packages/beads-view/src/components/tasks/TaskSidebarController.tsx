import { useCallback } from "react"
import { TaskSidebar } from "./TaskSidebar"
import { TaskList } from "./TaskList"
import { type SearchInputHandle } from "./SearchInput"
import { TaskProgressBar } from "./TaskProgressBar"
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
 * Controller component for TaskSidebar.
 *
 * Connects data hooks to the TaskSidebar presentational component.
 * Handles task loading and wires up the session history and progress bar.
 */
export function TaskSidebarController({
  /** Ref to access SearchInput methods */
  searchInputRef,
  /** Handler when a task is clicked */
  onTaskClick,
  /** Handler when a task should be opened */
  onOpenTask,
  /** Task IDs actively being worked on */
  activelyWorkingTaskIds,
  /** Task IDs with saved sessions */
  taskIdsWithSessions,
  /** Whether to show progress (host decides if Ralph is running). */
  isRunning = false,
  /** External loading state (e.g., when workspace is switching). */
  isLoadingExternal = false,
}: TaskSidebarControllerProps) {
  const { tasks, isLoading: isLoadingTasks } = useTasks({ all: true })
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

  return (
    <TaskSidebar
      taskList={
        <TaskList
          tasks={tasks}
          onTaskClick={onTaskClick}
          isLoading={isLoading}
          activelyWorkingTaskIds={activelyWorkingTaskIds}
          taskIdsWithSessions={taskIdsWithSessions}
          searchQuery={searchQuery}
          closedTimeFilter={closedTimeFilter}
          onClosedTimeFilterChange={handleClosedTimeFilterChange}
          onVisibleTaskIdsChange={handleVisibleTaskIdsChange}
        />
      }
      searchInputRef={searchInputRef}
      onOpenTask={onOpenTask}
      progressBar={
        <TaskProgressBar
          isRunning={isRunning}
          tasks={allStoreTasks}
          initialTaskCount={initialTaskCount}
          accentColor={accentColor}
          closedTimeFilter={closedTimeFilter}
        />
      }
    />
  )
}

/** Props for TaskSidebarController component. */
export interface TaskSidebarControllerProps {
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
}
