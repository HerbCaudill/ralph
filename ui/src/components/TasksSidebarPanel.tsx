import { useCallback } from "react"
import { TaskSidebar } from "./tasks/TaskSidebar"
import { TaskList } from "./tasks/TaskList"
import { QuickTaskInput, type QuickTaskInputHandle } from "./tasks/QuickTaskInput"
import { type SearchInputHandle } from "./tasks/SearchInput"
import { useTasks } from "@/hooks"

/**
 * Sidebar panel containing task list and quick task input.
 */
export function TasksSidebarPanel({
  /** Ref to access QuickTaskInput methods */
  quickInputRef,
  /** Ref to access SearchInput methods */
  searchInputRef,
  /** Handler when a task is clicked */
  onTaskClick,
  /** Handler when a task should be opened */
  onOpenTask,
  /** Handler when a task is created */
  onTaskCreated,
  /** Whether the search input is visible */
  isSearchVisible,
  /** Handler to hide the search input */
  onHideSearch,
}: TasksSidebarPanelProps) {
  const { tasks, refresh } = useTasks({ all: true })

  const handleTaskCreated = useCallback(async () => {
    await refresh()
    onTaskCreated?.()
  }, [refresh, onTaskCreated])

  return (
    <TaskSidebar
      quickInput={<QuickTaskInput ref={quickInputRef} onTaskCreated={handleTaskCreated} />}
      taskList={<TaskList tasks={tasks} onTaskClick={onTaskClick} showEmptyGroups />}
      searchInputRef={searchInputRef}
      onOpenTask={onOpenTask}
      isSearchVisible={isSearchVisible}
      onHideSearch={onHideSearch}
    />
  )
}

interface TasksSidebarPanelProps {
  quickInputRef?: React.RefObject<QuickTaskInputHandle | null>
  searchInputRef?: React.RefObject<SearchInputHandle | null>
  onTaskClick?: (taskId: string) => void
  onOpenTask?: (taskId: string) => void
  onTaskCreated?: () => void
  isSearchVisible?: boolean
  onHideSearch?: () => void
}
