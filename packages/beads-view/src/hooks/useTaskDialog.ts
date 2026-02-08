import { useState, useCallback, useRef } from "react"
import { useBeadsViewStore } from "../store"
import { fetchTask } from "../lib/fetchTask"
import { updateTask } from "../lib/updateTask"
import { deleteTask } from "../lib/deleteTask"
import type { Task, TaskUpdateData } from "../types"

/**
 * Hook to manage task details dialog state and API updates.
 */
export function useTaskDialog(
  /** Optional callbacks for task mutations. */
  options: UseTaskDialogOptions = {},
): UseTaskDialogResult {
  const { onTaskUpdated, onTaskDeleted } = options

  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refreshTasks = useBeadsViewStore(state => state.refreshTasks)
  const removeTask = useBeadsViewStore(state => state.removeTask)
  const tasks = useBeadsViewStore(state => state.tasks)

  const openDialog = useCallback((task: Task) => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
    setSelectedTask(task)
    setIsOpen(true)
    setError(null)
  }, [])

  const openDialogById = useCallback(
    async (id: string) => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current)
        closeTimeoutRef.current = null
      }
      setError(null)

      const cachedTask = tasks.find(t => t.id === id)
      if (cachedTask) {
        setSelectedTask(cachedTask)
        setIsOpen(true)
        return
      }

      setIsLoading(true)
      setIsOpen(true)

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
    },
    [tasks],
  )

  const closeDialog = useCallback(() => {
    setIsOpen(false)
    closeTimeoutRef.current = setTimeout(() => {
      setSelectedTask(null)
      setError(null)
      closeTimeoutRef.current = null
    }, 200)
  }, [])

  const saveTask = useCallback(
    async (id: string, updates: TaskUpdateData) => {
      setIsUpdating(true)
      setError(null)

      try {
        const result = await updateTask(id, updates)

        if (result.ok && result.issue) {
          setSelectedTask(result.issue)
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

  const deleteTaskById = useCallback(
    async (id: string) => {
      setIsUpdating(true)
      setError(null)

      try {
        const result = await deleteTask(id)

        if (result.ok) {
          removeTask(id)
          refreshTasks()
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
    [onTaskDeleted, refreshTasks, removeTask],
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
    deleteTask: deleteTaskById,
  }
}

export interface UseTaskDialogOptions {
  /** Callback after a task is successfully updated. */
  onTaskUpdated?: () => void | Promise<void>
  /** Callback after a task is successfully deleted. */
  onTaskDeleted?: () => void | Promise<void>
}

export interface UseTaskDialogResult {
  /** The currently selected task for the dialog. */
  selectedTask: Task | null
  /** Whether the dialog is open. */
  isOpen: boolean
  /** Whether an update is in progress. */
  isUpdating: boolean
  /** Whether fetching a task. */
  isLoading: boolean
  /** Error message if operation failed. */
  error: string | null
  /** Open the dialog with a task. */
  openDialog: (task: Task) => void
  /** Open the dialog by task ID (fetches task data). */
  openDialogById: (id: string) => Promise<void>
  /** Close the dialog. */
  closeDialog: () => void
  /** Save task updates. */
  saveTask: (id: string, updates: TaskUpdateData) => Promise<void>
  /** Delete a task. */
  deleteTask: (id: string) => Promise<void>
}
