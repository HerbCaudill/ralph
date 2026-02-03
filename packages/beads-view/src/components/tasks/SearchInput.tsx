import { forwardRef, useImperativeHandle, useRef, useCallback } from "react"
import type { KeyboardEvent } from "react"
import { IconSearch, IconX } from "@tabler/icons-react"
import {
  useBeadsViewStore,
  selectTaskSearchQuery,
  selectSelectedTaskId,
  selectVisibleTaskIds,
} from "../../store"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupButton } from "../ui/input-group"

/**
 * Search input for filtering tasks in the task list.
 * Uses Zustand store for state management to enable live filtering.
 */
export const SearchInput = forwardRef<SearchInputHandle, SearchInputProps>(function SearchInput(
  { placeholder = "Search tasks...", disabled = false, className, onOpenTask },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null)
  const query = useBeadsViewStore(selectTaskSearchQuery)
  const setQuery = useBeadsViewStore(state => state.setTaskSearchQuery)
  const clearQuery = useBeadsViewStore(state => state.clearTaskSearchQuery)
  const selectedTaskId = useBeadsViewStore(selectSelectedTaskId)
  const setSelectedTaskId = useBeadsViewStore(state => state.setSelectedTaskId)
  const clearSelectedTaskId = useBeadsViewStore(state => state.clearSelectedTaskId)
  const visibleTaskIds = useBeadsViewStore(selectVisibleTaskIds)

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

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && selectedTaskId && onOpenTask) {
        e.preventDefault()
        onOpenTask(selectedTaskId)
      }
      if (e.key === "ArrowDown") {
        e.preventDefault()
        const currentIndex = selectedTaskId ? visibleTaskIds.indexOf(selectedTaskId) : -1
        const nextIndex = Math.min(currentIndex + 1, visibleTaskIds.length - 1)
        const nextId = visibleTaskIds[nextIndex]
        if (nextId) setSelectedTaskId(nextId)
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        if (visibleTaskIds.length === 0) return
        const currentIndex =
          selectedTaskId ? visibleTaskIds.indexOf(selectedTaskId) : visibleTaskIds.length
        const prevIndex = Math.max(currentIndex - 1, 0)
        const prevId = visibleTaskIds[prevIndex]
        if (prevId) setSelectedTaskId(prevId)
      }
      if (e.key === "Escape") {
        if (query) {
          clearQuery()
        }
        clearSelectedTaskId()
        // Blur the input so keyboard navigation doesn't stay trapped
        inputRef.current?.blur()
      }
    },
    [
      selectedTaskId,
      onOpenTask,
      visibleTaskIds,
      setSelectedTaskId,
      query,
      clearQuery,
      clearSelectedTaskId,
    ],
  )

  const handleClear = useCallback(() => {
    clearQuery()
    clearSelectedTaskId()
  }, [clearQuery, clearSelectedTaskId])

  return (
    <InputGroup data-disabled={disabled} className={className}>
      <InputGroupAddon>
        <IconSearch className="size-4" />
      </InputGroupAddon>
      <InputGroupInput
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        aria-label="Search tasks"
      />
      {query && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            type="button"
            onClick={handleClear}
            size="icon-xs"
            variant="ghost"
            aria-label="Clear search"
          >
            <IconX className="size-4" />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  )
})

export type SearchInputProps = {
  placeholder?: string
  disabled?: boolean
  className?: string
  onOpenTask?: (taskId: string) => void
}

export type SearchInputHandle = {
  focus: () => void
  clear: () => void
}
