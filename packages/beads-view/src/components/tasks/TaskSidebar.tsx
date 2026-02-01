import type { ReactNode, RefObject } from "react"
import { cn } from "../../lib/cn"
import { SearchInput, type SearchInputHandle } from "./SearchInput"

/**
 * Sidebar container for task management.
 * Contains quick task input at top and task list below.
 *
 * This is a presentational component that receives all content via props.
 * Use TaskSidebarController for the connected version.
 */
export function TaskSidebar({
  /** Quick task input element to display at the top */
  quickInput,
  /** Task list element to display below the input */
  taskList,
  /** Reference to the search input element */
  searchInputRef,
  /** Callback when a task is opened from search results */
  onOpenTask,
  /** Element to display in the progress bar slot (bottom) */
  progressBar,
  /** Additional CSS classes to apply */
  className,
}: TaskSidebarProps) {
  return (
    <div
      className={cn("flex h-full flex-col", className)}
      role="complementary"
      aria-label="Task sidebar"
    >
      {quickInput && <div className="border-border shrink-0 border-b px-4 py-3">{quickInput}</div>}

      {/* Main content area with floating search input */}
      <div className="relative min-h-0 flex-1">
        {/* Floating search input */}
        <div className="bg-background/95 absolute inset-x-0 top-0 z-10 px-3 py-2 backdrop-blur-sm">
          <SearchInput ref={searchInputRef} onOpenTask={onOpenTask} />
        </div>

        {/* Task list with top padding to account for floating search */}
        <div className="h-full overflow-y-auto pt-[52px]">
          {taskList ?? (
            <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-center text-sm">
              No tasks yet
            </div>
          )}
        </div>
      </div>

      {progressBar}
    </div>
  )
}

/**  Props for the TaskSidebar component. */
export type TaskSidebarProps = {
  /** Quick task input element to display at the top */
  quickInput?: ReactNode
  /** Task list element to display below the input */
  taskList?: ReactNode
  /** Reference to the search input element */
  searchInputRef?: RefObject<SearchInputHandle | null>
  /** Callback when a task is opened from search results */
  onOpenTask?: (taskId: string) => void
  /** Element to display in the progress bar slot (bottom) */
  progressBar?: ReactNode
  /** Additional CSS classes to apply */
  className?: string
}
