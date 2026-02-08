import { useCallback } from "react"
import { useBeadsViewStore, selectSelectedTaskId, selectVisibleTaskIds } from "../store"

/**
 * Hook for keyboard-driven task navigation.
 *
 * Provides navigatePrevious, navigateNext, and openSelected actions that
 * update the store's selectedTaskId and automatically open the task via
 * the onOpenTask callback.
 */
export function useTaskNavigation(
  /** Options for task navigation behavior. */
  options: UseTaskNavigationOptions = {},
): UseTaskNavigationResult {
  const { onOpenTask } = options

  const selectedTaskId = useBeadsViewStore(selectSelectedTaskId)
  const visibleTaskIds = useBeadsViewStore(selectVisibleTaskIds)
  const setSelectedTaskId = useBeadsViewStore(state => state.setSelectedTaskId)

  /** Navigate to the previous task in the list and open it. */
  const navigatePrevious = useCallback(() => {
    if (visibleTaskIds.length === 0) return
    const currentIndex =
      selectedTaskId ? visibleTaskIds.indexOf(selectedTaskId) : visibleTaskIds.length
    const prevIndex = Math.max(currentIndex - 1, 0)
    const prevId = visibleTaskIds[prevIndex]
    if (prevId) {
      setSelectedTaskId(prevId)
      onOpenTask?.(prevId)
    }
  }, [selectedTaskId, visibleTaskIds, setSelectedTaskId, onOpenTask])

  /** Navigate to the next task in the list and open it. */
  const navigateNext = useCallback(() => {
    if (visibleTaskIds.length === 0) return
    const currentIndex = selectedTaskId ? visibleTaskIds.indexOf(selectedTaskId) : -1
    const nextIndex = Math.min(currentIndex + 1, visibleTaskIds.length - 1)
    const nextId = visibleTaskIds[nextIndex]
    if (nextId) {
      setSelectedTaskId(nextId)
      onOpenTask?.(nextId)
    }
  }, [selectedTaskId, visibleTaskIds, setSelectedTaskId, onOpenTask])

  /** Open the currently selected task. */
  const openSelected = useCallback(() => {
    if (selectedTaskId) {
      onOpenTask?.(selectedTaskId)
    }
  }, [selectedTaskId, onOpenTask])

  return {
    navigatePrevious,
    navigateNext,
    openSelected,
  }
}

/** Options for the useTaskNavigation hook. */
export interface UseTaskNavigationOptions {
  /** Callback to open a task by ID (e.g., dialog.openDialogById). */
  onOpenTask?: (taskId: string) => void
}

/** Return value of the useTaskNavigation hook. */
export interface UseTaskNavigationResult {
  /** Navigate to the previous task and open it. */
  navigatePrevious: () => void
  /** Navigate to the next task and open it. */
  navigateNext: () => void
  /** Open the currently selected task. */
  openSelected: () => void
}
