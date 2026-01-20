import { cn } from "@/lib/utils"
import {
  useAppStore,
  selectTaskSearchQuery,
  selectSelectedTaskId,
  selectVisibleTaskIds,
} from "@/store"
import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useCallback,
  useState,
  type KeyboardEvent,
} from "react"
import { IconSearch, IconX } from "@tabler/icons-react"

// Types

export interface SearchInputProps {
  /**
   * Placeholder text for the input.
   * @default "Search tasks..."
   */
  placeholder?: string

  /**
   * Whether the input is disabled.
   * @default false
   */
  disabled?: boolean

  /**
   * Additional CSS classes.
   */
  className?: string

  /**
   * Callback when a task should be opened (triggered by Enter key).
   */
  onOpenTask?: (taskId: string) => void
}

export interface SearchInputHandle {
  focus: () => void
  clear: () => void
}

// SearchInput Component

/**
 * Search input for filtering tasks in the task list.
 * Uses Zustand store for state management to enable live filtering.
 */
export const SearchInput = forwardRef<SearchInputHandle, SearchInputProps>(function SearchInput(
  { placeholder = "Search tasks...", disabled = false, className, onOpenTask },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null)
  const query = useAppStore(selectTaskSearchQuery)
  const setQuery = useAppStore(state => state.setTaskSearchQuery)
  const clearQuery = useAppStore(state => state.clearTaskSearchQuery)
  const selectedTaskId = useAppStore(selectSelectedTaskId)
  const setSelectedTaskId = useAppStore(state => state.setSelectedTaskId)
  const clearSelectedTaskId = useAppStore(state => state.clearSelectedTaskId)
  const visibleTaskIds = useAppStore(selectVisibleTaskIds)
  const [isFocused, setIsFocused] = useState(false)

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus()
      inputRef.current?.select()
    },
    clear: () => {
      clearQuery()
    },
  }))

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value)
    },
    [setQuery],
  )

  const handleClear = useCallback(() => {
    clearQuery()
    inputRef.current?.focus()
  }, [clearQuery])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      // Escape clears the search and selection
      if (e.key === "Escape") {
        e.preventDefault()
        clearQuery()
        clearSelectedTaskId()
        return
      }

      // Arrow down - select next task
      if (e.key === "ArrowDown") {
        e.preventDefault()
        if (visibleTaskIds.length === 0) return

        if (!selectedTaskId) {
          // Select first task
          setSelectedTaskId(visibleTaskIds[0])
        } else {
          // Select next task
          const currentIndex = visibleTaskIds.indexOf(selectedTaskId)
          if (currentIndex < visibleTaskIds.length - 1) {
            setSelectedTaskId(visibleTaskIds[currentIndex + 1])
          }
        }
        return
      }

      // Arrow up - select previous task
      if (e.key === "ArrowUp") {
        e.preventDefault()
        if (visibleTaskIds.length === 0) return

        if (!selectedTaskId) {
          // Select last task
          setSelectedTaskId(visibleTaskIds[visibleTaskIds.length - 1])
        } else {
          // Select previous task
          const currentIndex = visibleTaskIds.indexOf(selectedTaskId)
          if (currentIndex > 0) {
            setSelectedTaskId(visibleTaskIds[currentIndex - 1])
          }
        }
        return
      }

      // Enter - open selected task
      if (e.key === "Enter") {
        e.preventDefault()
        if (selectedTaskId && onOpenTask) {
          onOpenTask(selectedTaskId)
          clearSelectedTaskId()
        }
        return
      }
    },
    [
      clearQuery,
      clearSelectedTaskId,
      visibleTaskIds,
      selectedTaskId,
      setSelectedTaskId,
      onOpenTask,
    ],
  )

  const handleFocus = useCallback(() => {
    setIsFocused(true)
  }, [])

  const handleBlur = useCallback(() => {
    setIsFocused(false)
  }, [])

  const isActive = isFocused || query.length > 0

  return (
    <div className={cn("relative flex items-center", className)}>
      <IconSearch
        className={cn(
          "pointer-events-none absolute left-2 size-4 transition-colors",
          isActive ? "text-muted-foreground" : "text-muted-foreground/60",
        )}
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "text-foreground h-8 w-full text-sm transition-all",
          "py-1 pr-8 pl-8",
          "focus:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          isActive ?
            [
              "placeholder:text-muted-foreground bg-muted/50",
              "rounded-md border-0",
              "focus:ring-ring/50 focus:bg-muted focus:ring-1",
            ]
          : ["placeholder:text-muted-foreground/60 bg-transparent", "rounded-none border-0"],
        )}
        aria-label="Search tasks"
      />
      {query && (
        <button
          type="button"
          onClick={handleClear}
          className={cn(
            "text-muted-foreground hover:text-foreground absolute right-2",
            "rounded-sm p-0.5 transition-colors",
            "focus:ring-ring/50 focus:ring-1 focus:outline-none",
          )}
          aria-label="Clear search"
        >
          <IconX className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  )
})
