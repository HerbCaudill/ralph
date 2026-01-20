import { useState, useCallback } from "react"
import type { TaskCardTask } from "@/components/tasks/TaskCard"
import type { TaskUpdateData } from "@/components/tasks/TaskDetailsDialog"
import { useAppStore } from "@/store"

// Types

export interface UseTaskDialogOptions {
  /** Callback after a task is successfully updated */
  onTaskUpdated?: () => void | Promise<void>
  /** Callback after a task is successfully deleted */
  onTaskDeleted?: () => void | Promise<void>
}

export interface UseTaskDialogResult {
  /** The currently selected task for the dialog */
  selectedTask: TaskCardTask | null
  /** Whether the dialog is open */
  isOpen: boolean
  /** Whether an update is in progress */
  isUpdating: boolean
  /** Whether fetching a task */
  isLoading: boolean
  /** Error message if operation failed */
  error: string | null
  /** Open the dialog with a task */
  openDialog: (task: TaskCardTask) => void
  /** Open the dialog by task ID (fetches task data) */
  openDialogById: (id: string) => Promise<void>
  /** Close the dialog */
  closeDialog: () => void
  /** Save task updates */
  saveTask: (id: string, updates: TaskUpdateData) => Promise<void>
  /** Delete a task */
  deleteTask: (id: string) => Promise<void>
}

// API Functions

interface TaskResponse {
  ok: boolean
  issue?: TaskCardTask
  error?: string
}

async function fetchTask(id: string): Promise<TaskResponse> {
  try {
    const response = await fetch(`/api/tasks/${id}`)
    return (await response.json()) as TaskResponse
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to fetch task" }
  }
}

async function updateTask(id: string, updates: TaskUpdateData): Promise<TaskResponse> {
  try {
    const response = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
    return (await response.json()) as TaskResponse
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to update task" }
  }
}

interface DeleteResponse {
  ok: boolean
  error?: string
}

async function deleteTaskApi(id: string): Promise<DeleteResponse> {
  try {
    const response = await fetch(`/api/tasks/${id}`, {
      method: "DELETE",
    })
    return (await response.json()) as DeleteResponse
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to delete task" }
  }
}

// Hook

/**
 * Hook to manage task details dialog state and API updates.
 */
export function useTaskDialog(options: UseTaskDialogOptions = {}): UseTaskDialogResult {
  const { onTaskUpdated, onTaskDeleted } = options

  const [selectedTask, setSelectedTask] = useState<TaskCardTask | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get store actions for task management
  const refreshTasks = useAppStore(state => state.refreshTasks)
  const removeTask = useAppStore(state => state.removeTask)

  const openDialog = useCallback((task: TaskCardTask) => {
    setSelectedTask(task)
    setIsOpen(true)
    setError(null)
  }, [])

  const openDialogById = useCallback(async (id: string) => {
    setIsLoading(true)
    setIsOpen(true)
    setError(null)

    try {
      const result = await fetchTask(id)

      if (result.ok && result.issue) {
        setSelectedTask(result.issue)
      } else {
        throw new Error(result.error ?? "Task not found")
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch task"
      setError(message)
      setIsOpen(false)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const closeDialog = useCallback(() => {
    setIsOpen(false)
    // Delay clearing the task so the dialog can animate out
    setTimeout(() => {
      setSelectedTask(null)
      setError(null)
    }, 200)
  }, [])

  const saveTask = useCallback(
    async (id: string, updates: TaskUpdateData) => {
      setIsUpdating(true)
      setError(null)

      try {
        const result = await updateTask(id, updates)

        if (result.ok && result.issue) {
          // Update the selected task with the response
          setSelectedTask(result.issue)
          // Notify parent that task was updated
          await onTaskUpdated?.()
        } else {
          throw new Error(result.error ?? "Failed to update task")
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update task"
        setError(message)
        throw err
      } finally {
        setIsUpdating(false)
      }
    },
    [onTaskUpdated],
  )

  const deleteTask = useCallback(
    async (id: string) => {
      setIsUpdating(true)
      setError(null)

      try {
        const result = await deleteTaskApi(id)

        if (result.ok) {
          // Optimistically remove from store immediately
          removeTask(id)
          // Also refresh from server to ensure consistency
          await refreshTasks()
          // Notify parent that task was deleted
          await onTaskDeleted?.()
        } else {
          throw new Error(result.error ?? "Failed to delete task")
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete task"
        setError(message)
        throw err
      } finally {
        setIsUpdating(false)
      }
    },
    [onTaskDeleted, removeTask, refreshTasks],
  )

  return {
    selectedTask,
    isOpen,
    isUpdating,
    isLoading,
    error,
    openDialog,
    openDialogById,
    closeDialog,
    saveTask,
    deleteTask,
  }
}
