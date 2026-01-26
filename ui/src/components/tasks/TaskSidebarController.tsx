import { TaskSidebar } from "./TaskSidebar"
import { TaskList } from "./TaskList"
import { type SearchInputHandle } from "./SearchInput"
import { TaskProgressBar } from "./TaskProgressBar"
import { IterationHistorySheet } from "@/components/events"
import { useTasks } from "@/hooks"

/**
 * Controller component for TaskSidebar.
 *
 * Connects data hooks to the TaskSidebar presentational component.
 * Handles task loading and wires up the iteration history and progress bar.
 */
export function TaskSidebarController({
  /** Ref to access SearchInput methods */
  searchInputRef,
  /** Handler when a task is clicked */
  onTaskClick,
  /** Handler when a task should be opened */
  onOpenTask,
  /** Whether the search input is visible */
  isSearchVisible,
  /** Handler to hide the search input */
  onHideSearch,
}: TaskSidebarControllerProps) {
  const { tasks, isLoading } = useTasks({ all: true })

  return (
    <TaskSidebar
      taskList={<TaskList tasks={tasks} onTaskClick={onTaskClick} isLoading={isLoading} />}
      searchInputRef={searchInputRef}
      onOpenTask={onOpenTask}
      isSearchVisible={isSearchVisible}
      onHideSearch={onHideSearch}
      iterationHistory={<IterationHistorySheet />}
      progressBar={<TaskProgressBar />}
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
  /** Whether the search input is visible */
  isSearchVisible?: boolean
  /** Handler to hide the search input */
  onHideSearch?: () => void
}
