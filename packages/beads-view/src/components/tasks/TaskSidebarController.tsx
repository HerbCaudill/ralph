import { TaskSidebar } from "./TaskSidebar"
import { TaskList } from "./TaskList"
import { type SearchInputHandle } from "./SearchInput"
import { TaskProgressBar } from "./TaskProgressBar"
import { useTasks } from "../../hooks"

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
}: TaskSidebarControllerProps) {
  const { tasks, isLoading } = useTasks({ all: true })

  return (
    <TaskSidebar
      taskList={
        <TaskList
          tasks={tasks}
          onTaskClick={onTaskClick}
          isLoading={isLoading}
          activelyWorkingTaskIds={activelyWorkingTaskIds}
          taskIdsWithSessions={taskIdsWithSessions}
        />
      }
      searchInputRef={searchInputRef}
      onOpenTask={onOpenTask}
      progressBar={<TaskProgressBar isRunning={isRunning} />}
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
}
