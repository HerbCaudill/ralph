import { useEffect, useCallback, useRef } from "react"
import type { UseTaskDialogResult } from "./useTaskDialog"

/**
 * Parse the URL path to extract task ID.
 * Supports format: /issue/{taskId}
 * Also supports legacy format: #id={taskId} for backwards compatibility
 * Task IDs are typically like: r-xxxx or r-xxxx.n
 */
export function parseTaskIdFromUrl(url: { pathname: string; hash: string }): string | null {
  // Check path-based format first: /issue/{taskId}
  const pathMatch = url.pathname.match(/^\/issue\/([a-z0-9-]+(?:\.\d+)?)$/i)
  if (pathMatch) {
    const id = pathMatch[1]
    // Validate: Task IDs start with a prefix followed by alphanumeric characters
    // and optionally a dot and number for subtasks (e.g., r-abc1 or r-abc1.2)
    if (id && /^[a-z]+-[a-z0-9]+(\.\d+)?$/i.test(id)) {
      return id
    }
  }

  // Fallback to legacy hash format for backwards compatibility: #id={taskId}
  const hash = url.hash
  if (hash && hash !== "#") {
    const hashContent = hash.startsWith("#") ? hash.slice(1) : hash
    if (hashContent.startsWith("id=")) {
      const id = hashContent.slice("id=".length)
      if (id && /^[a-z]+-[a-z0-9]+(\.\d+)?$/i.test(id)) {
        return id
      }
    }
  }

  return null
}

/**
 * Build a URL path for a task ID.
 */
export function buildTaskIdPath(id: string): string {
  return `/issue/${id}`
}

// Legacy exports for backwards compatibility with tests
export const parseTaskIdHash = (hash: string): string | null => {
  return parseTaskIdFromUrl({ pathname: "/", hash })
}

export const buildTaskIdHash = (id: string): string => {
  return `#id=${id}`
}

export interface UseTaskDialogRouterOptions {
  /** The task dialog controller from useTaskDialog */
  taskDialog: UseTaskDialogResult
}

export interface UseTaskDialogRouterReturn {
  /** Navigate to view a task by ID */
  navigateToTask: (id: string) => void
  /** Close the task dialog and clear the URL */
  closeTaskDialog: () => void
  /** Current task ID from URL (if any) */
  taskIdFromUrl: string | null
}

/**
 * Hook for URL routing for task dialog.
 *
 * Handles:
 * - Parsing /issue/{taskId} from URL on mount (also supports legacy #id={taskId})
 * - Listening to popstate events for browser back/forward
 * - Opening task dialog when ID is found in URL
 * - Updating URL path when navigating
 * - Clearing path when dialog is closed
 */
export function useTaskDialogRouter({
  taskDialog,
}: UseTaskDialogRouterOptions): UseTaskDialogRouterReturn {
  // Track current task ID from URL
  const taskIdFromUrlRef = useRef<string | null>(null)
  // Track if we're programmatically changing the URL (to avoid loops)
  const isProgrammaticChange = useRef(false)

  // Navigate to view a task
  const navigateToTask = useCallback((id: string) => {
    isProgrammaticChange.current = true
    // Update URL to path-based format
    window.history.pushState({ taskId: id }, "", buildTaskIdPath(id))
    taskIdFromUrlRef.current = id
    // Reset flag after the change propagates
    setTimeout(() => {
      isProgrammaticChange.current = false
    }, 0)
  }, [])

  // Close the task dialog and clear URL
  const closeTaskDialog = useCallback(() => {
    isProgrammaticChange.current = true
    // Navigate back to root
    window.history.pushState(null, "", "/")
    taskIdFromUrlRef.current = null
    // Close the dialog
    taskDialog.closeDialog()
    // Reset flag after the change propagates
    setTimeout(() => {
      isProgrammaticChange.current = false
    }, 0)
  }, [taskDialog])

  // Handle URL changes and open dialog when task ID is found
  // This effect only runs once on mount and sets up the popstate listener
  useEffect(() => {
    async function handleUrlChange() {
      // Skip if this is a programmatic change we initiated
      if (isProgrammaticChange.current) {
        return
      }

      const id = parseTaskIdFromUrl(window.location)
      const previousId = taskIdFromUrlRef.current
      taskIdFromUrlRef.current = id

      if (id) {
        // Open the dialog by ID
        await taskDialog.openDialogById(id)
      } else if (previousId) {
        // URL was cleared (had an ID before, now doesn't) - close dialog
        taskDialog.closeDialog()
      }
    }

    // Check URL on mount
    handleUrlChange()

    // Listen for popstate events (back/forward navigation)
    window.addEventListener("popstate", handleUrlChange)
    // Also listen for hashchange for legacy URL support
    window.addEventListener("hashchange", handleUrlChange)

    return () => {
      window.removeEventListener("popstate", handleUrlChange)
      window.removeEventListener("hashchange", handleUrlChange)
    }
    // Note: We intentionally only depend on the stable functions, not the entire taskDialog object
    // This prevents the effect from re-running on every state change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskDialog.openDialogById, taskDialog.closeDialog])

  // Update URL when dialog opens/closes via other means (e.g., clicking a task)
  useEffect(() => {
    if (taskDialog.isOpen && taskDialog.selectedTask) {
      const currentUrlId = parseTaskIdFromUrl(window.location)
      // Only update URL if it doesn't already match
      if (currentUrlId !== taskDialog.selectedTask.id) {
        isProgrammaticChange.current = true
        window.history.pushState(
          { taskId: taskDialog.selectedTask.id },
          "",
          buildTaskIdPath(taskDialog.selectedTask.id),
        )
        taskIdFromUrlRef.current = taskDialog.selectedTask.id
        setTimeout(() => {
          isProgrammaticChange.current = false
        }, 0)
      }
    } else if (!taskDialog.isOpen && taskIdFromUrlRef.current) {
      // Dialog was closed but URL still has task ID - clear it
      isProgrammaticChange.current = true
      window.history.pushState(null, "", "/")
      taskIdFromUrlRef.current = null
      setTimeout(() => {
        isProgrammaticChange.current = false
      }, 0)
    }
  }, [taskDialog.isOpen, taskDialog.selectedTask])

  return {
    navigateToTask,
    closeTaskDialog,
    taskIdFromUrl: taskIdFromUrlRef.current,
  }
}
