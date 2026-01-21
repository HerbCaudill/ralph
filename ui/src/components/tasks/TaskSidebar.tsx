import type { ReactNode, RefObject } from "react"
import { cn } from "@/lib/utils"
import { TaskProgressBar } from "./TaskProgressBar"
import { SearchInput, type SearchInputHandle } from "./SearchInput"

/**
 * Sidebar container for task management.
 * Contains quick task input at top and task list below.
 */
export function TaskSidebar({
  quickInput,
  taskList,
  searchInputRef,
  onOpenTask,
  isSearchVisible = false,
  onHideSearch,
  className,
}: TaskSidebarProps) {
  return (
    <div
      className={cn("flex h-full flex-col", className)}
      role="complementary"
      aria-label="Task sidebar"
    >
      {quickInput && <div className="border-border shrink-0 border-b px-4 py-3">{quickInput}</div>}

      {isSearchVisible && (
        <div className="border-border shrink-0 border-b px-3 py-2">
          <SearchInput ref={searchInputRef} onOpenTask={onOpenTask} onHide={onHideSearch} />
        </div>
      )}

      <div className="min-h-0 flex-1">
        {taskList ?? (
          <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-center text-sm">
            No tasks yet
          </div>
        )}
      </div>

      <TaskProgressBar />
    </div>
  )
}

export type TaskSidebarProps = {
  quickInput?: ReactNode
  taskList?: ReactNode
  searchInputRef?: RefObject<SearchInputHandle | null>
  onOpenTask?: (taskId: string) => void
  isSearchVisible?: boolean
  onHideSearch?: () => void
  className?: string
}
