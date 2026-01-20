import { cn } from "@/lib/utils"
import { useAppStore, selectTaskSearchQuery } from "@/store"
import { forwardRef, useImperativeHandle, useRef, useCallback, type KeyboardEvent } from "react"
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
  { placeholder = "Search tasks...", disabled = false, className },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null)
  const query = useAppStore(selectTaskSearchQuery)
  const setQuery = useAppStore(state => state.setTaskSearchQuery)
  const clearQuery = useAppStore(state => state.clearTaskSearchQuery)

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
      // Escape clears the search
      if (e.key === "Escape") {
        e.preventDefault()
        clearQuery()
      }
    },
    [clearQuery],
  )

  return (
    <div className={cn("relative flex items-center", className)}>
      <IconSearch
        className="text-muted-foreground pointer-events-none absolute left-2 size-4"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "placeholder:text-muted-foreground bg-muted/50 text-foreground",
          "h-8 w-full rounded-md border-0 py-1 pr-8 pl-8 text-sm",
          "focus:ring-ring/50 focus:bg-muted focus:ring-1 focus:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
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
