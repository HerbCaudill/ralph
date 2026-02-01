import { useEffect, useCallback, useRef } from "react"
import { buildTaskIdPath } from "../lib/buildTaskIdPath"
import { parseTaskIdFromUrl } from "../lib/parseTaskIdFromUrl"
import type { UseTaskDialogResult } from "./useTaskDialog"

/**
 * Hook for URL routing for task dialog.
 */
export function useTaskDialogRouter(
  /** Router configuration options. */
  options: UseTaskDialogRouterOptions,
): UseTaskDialogRouterReturn {
  const { taskDialog } = options

  const taskIdFromUrlRef = useRef<string | null>(null)
  const isProgrammaticChange = useRef(false)

  const navigateToTask = useCallback((id: string) => {
    isProgrammaticChange.current = true
    window.history.pushState({ taskId: id }, "", buildTaskIdPath(id))
    taskIdFromUrlRef.current = id
    setTimeout(() => {
      isProgrammaticChange.current = false
    }, 0)
  }, [])

  const closeTaskDialog = useCallback(() => {
    isProgrammaticChange.current = true
    window.history.pushState(null, "", "/")
    taskIdFromUrlRef.current = null
    taskDialog.closeDialog()
    setTimeout(() => {
      isProgrammaticChange.current = false
    }, 0)
  }, [taskDialog])

  useEffect(() => {
    async function handleUrlChange() {
      if (isProgrammaticChange.current) {
        return
      }

      const id = parseTaskIdFromUrl(window.location)
      const previousId = taskIdFromUrlRef.current
      taskIdFromUrlRef.current = id

      if (id) {
        await taskDialog.openDialogById(id)
      } else if (previousId) {
        taskDialog.closeDialog()
      }
    }

    handleUrlChange()

    window.addEventListener("popstate", handleUrlChange)
    window.addEventListener("hashchange", handleUrlChange)

    return () => {
      window.removeEventListener("popstate", handleUrlChange)
      window.removeEventListener("hashchange", handleUrlChange)
    }
  }, [taskDialog.openDialogById, taskDialog.closeDialog])

  useEffect(() => {
    if (taskDialog.isOpen && taskDialog.selectedTask) {
      const currentUrlId = parseTaskIdFromUrl(window.location)
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

export interface UseTaskDialogRouterOptions {
  /** The task dialog controller from useTaskDialog. */
  taskDialog: UseTaskDialogResult
}

export interface UseTaskDialogRouterReturn {
  /** Navigate to view a task by ID. */
  navigateToTask: (id: string) => void
  /** Close the task dialog and clear the URL. */
  closeTaskDialog: () => void
  /** Current task ID from URL (if any). */
  taskIdFromUrl: string | null
}
