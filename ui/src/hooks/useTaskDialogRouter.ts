import { useEffect, useCallback, useRef } from "react"
import type { UseTaskDialogResult } from "./useTaskDialog"

/**
 * Parse the URL hash to extract task ID.
 * Supports format: #id={taskId}
 * Task IDs are typically like: r-xxxx or r-xxxx.n
 */
export function parseTaskIdHash(hash: string): string | null {
  if (!hash || hash === "#") return null

  // Remove leading #
  const hashContent = hash.startsWith("#") ? hash.slice(1) : hash

  // Check for id= prefix
  if (hashContent.startsWith("id=")) {
    const id = hashContent.slice("id=".length)
    // Validate: Task IDs start with 'r-' followed by alphanumeric characters
    // and optionally a dot and number for subtasks (e.g., r-abc1 or r-abc1.2)
    if (id && /^r-[a-z0-9]+(\.\d+)?$/i.test(id)) {
      return id
    }
  }

  return null
}

/**
 * Build a URL hash for a task ID.
 */
export function buildTaskIdHash(id: string): string {
  return `#id=${id}`
}

export interface UseTaskDialogRouterOptions {
  /** The task dialog controller from useTaskDialog */
  taskDialog: UseTaskDialogResult
}

export interface UseTaskDialogRouterReturn {
  /** Navigate to view a task by ID */
  navigateToTask: (id: string) => void
  /** Close the task dialog and clear the URL hash */
  closeTaskDialog: () => void
  /** Current task ID from URL (if any) */
  taskIdFromUrl: string | null
}

/**
 * Hook for URL hash routing for task dialog.
 *
 * Handles:
 * - Parsing #id={taskId} from URL on mount
 * - Listening to hashchange events
 * - Opening task dialog when ID is found in URL
 * - Updating URL hash when navigating
 * - Clearing hash when dialog is closed
 */
export function useTaskDialogRouter({
  taskDialog,
}: UseTaskDialogRouterOptions): UseTaskDialogRouterReturn {
  // Track current task ID from URL
  const taskIdFromUrlRef = useRef<string | null>(null)
  // Track if we're programmatically changing the hash (to avoid loops)
  const isProgrammaticChange = useRef(false)

  // Navigate to view a task
  const navigateToTask = useCallback((id: string) => {
    isProgrammaticChange.current = true
    // Update URL hash
    window.location.hash = buildTaskIdHash(id)
    taskIdFromUrlRef.current = id
    // Reset flag after the change propagates
    setTimeout(() => {
      isProgrammaticChange.current = false
    }, 0)
  }, [])

  // Close the task dialog and clear URL
  const closeTaskDialog = useCallback(() => {
    isProgrammaticChange.current = true
    // Clear URL hash using pushState to avoid page jump
    window.history.pushState(null, "", window.location.pathname + window.location.search)
    taskIdFromUrlRef.current = null
    // Close the dialog
    taskDialog.closeDialog()
    // Reset flag after the change propagates
    setTimeout(() => {
      isProgrammaticChange.current = false
    }, 0)
  }, [taskDialog])

  // Handle hash changes and open dialog when task ID is found
  // This effect only runs once on mount and sets up the hashchange listener
  useEffect(() => {
    async function handleHashChange() {
      // Skip if this is a programmatic change we initiated
      if (isProgrammaticChange.current) {
        return
      }

      const id = parseTaskIdHash(window.location.hash)
      const previousId = taskIdFromUrlRef.current
      taskIdFromUrlRef.current = id

      if (id) {
        // Open the dialog by ID
        await taskDialog.openDialogById(id)
      } else if (previousId) {
        // Hash was cleared (had an ID before, now doesn't) - close dialog
        taskDialog.closeDialog()
      }
    }

    // Check hash on mount only
    handleHashChange()

    // Listen for hash changes
    window.addEventListener("hashchange", handleHashChange)

    return () => {
      window.removeEventListener("hashchange", handleHashChange)
    }
    // Note: We intentionally only depend on the stable functions, not the entire taskDialog object
    // This prevents the effect from re-running on every state change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskDialog.openDialogById, taskDialog.closeDialog])

  // Update URL when dialog opens/closes via other means (e.g., clicking a task)
  useEffect(() => {
    if (taskDialog.isOpen && taskDialog.selectedTask) {
      const currentHashId = parseTaskIdHash(window.location.hash)
      // Only update hash if it doesn't already match
      if (currentHashId !== taskDialog.selectedTask.id) {
        isProgrammaticChange.current = true
        window.location.hash = buildTaskIdHash(taskDialog.selectedTask.id)
        taskIdFromUrlRef.current = taskDialog.selectedTask.id
        setTimeout(() => {
          isProgrammaticChange.current = false
        }, 0)
      }
    } else if (!taskDialog.isOpen && taskIdFromUrlRef.current) {
      // Dialog was closed but URL still has task ID - clear it
      isProgrammaticChange.current = true
      window.history.pushState(null, "", window.location.pathname + window.location.search)
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
