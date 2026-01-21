import { cn } from "@/lib/utils"
import type { ReactNode, RefObject } from "react"
import { TaskProgressBar } from "./TaskProgressBar"
import { SearchInput, type SearchInputHandle } from "./SearchInput"

// Types

export interface TaskSidebarProps {
  /**
   * Quick task input component (rendered at top).
   */
  quickInput?: ReactNode

  /**
   * Task list component (rendered below input).
   */
  taskList?: ReactNode

  /**
   * Ref for the search input (for focus handling).
   */
  searchInputRef?: RefObject<SearchInputHandle | null>

  /**
   * Callback when a task should be opened (triggered by Enter key in search).
   */
  onOpenTask?: (taskId: string) => void

  /**
   * Whether the search input is visible.
   * @default false
   */
  isSearchVisible?: boolean

  /**
   * Callback when the search should be hidden.
   */
  onHideSearch?: () => void

  /**
   * Additional CSS classes.
   */
  className?: string
}

// TaskSidebar Component

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
      {/* Quick Input Area */}
      {quickInput && <div className="border-border shrink-0 border-b px-4 py-3">{quickInput}</div>}

      {/* Search Input - only visible when activated via Cmd+F */}
      {isSearchVisible && (
        <div className="border-border shrink-0 border-b px-3 py-2">
          <SearchInput ref={searchInputRef} onOpenTask={onOpenTask} onHide={onHideSearch} />
        </div>
      )}

      {/* Task List Area - scrolling is handled by TaskList sections */}
      <div className="min-h-0 flex-1">
        {taskList ?? (
          <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-center text-sm">
            No tasks yet
          </div>
        )}
      </div>

      {/* Task Progress Bar */}
      <TaskProgressBar />
    </div>
  )
}
