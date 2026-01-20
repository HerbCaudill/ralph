import { useState, useEffect, useCallback } from "react"
import type { TaskCardTask, TaskStatus } from "@/components/tasks/TaskCard"
import { useAppStore } from "@/store"

// Types

export interface UseTasksOptions {
  /** Filter by status */
  status?: TaskStatus
  /** Show only ready tasks (open and unblocked) */
  ready?: boolean
  /** Include closed tasks */
  all?: boolean
  /** Polling interval in ms (default: 5000, 0 to disable) */
  pollInterval?: number
}

export interface UseTasksResult {
  /** List of tasks */
  tasks: TaskCardTask[]
  /** Whether tasks are currently loading */
  isLoading: boolean
  /** Error message if fetch failed */
  error: string | null
  /** Manually refresh tasks */
  refresh: () => Promise<void>
}

// API Functions

interface TasksResponse {
  ok: boolean
  issues?: TaskCardTask[]
  error?: string
}

async function fetchTasks(options: UseTasksOptions = {}): Promise<TasksResponse> {
  const params = new URLSearchParams()

  if (options.status) {
    params.set("status", options.status)
  }
  if (options.ready) {
    params.set("ready", "true")
  }
  if (options.all) {
    params.set("all", "true")
  }

  const url = `/api/tasks${params.toString() ? `?${params.toString()}` : ""}`

  try {
    const response = await fetch(url)
    return (await response.json()) as TasksResponse
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to fetch tasks" }
  }
}

// Hook

/**
 * Hook to fetch and manage tasks from the beads API.
 */
export function useTasks(options: UseTasksOptions = {}): UseTasksResult {
  const { status, ready, all, pollInterval = 5000 } = options

  const [tasks, setTasks] = useState<TaskCardTask[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Get the store's setTasks to sync tasks to global state
  const setStoreTasks = useAppStore(state => state.setTasks)

  const refresh = useCallback(async () => {
    const result = await fetchTasks({ status, ready, all })

    if (result.ok && result.issues) {
      setTasks(result.issues)
      // Sync tasks to global store so StatusBar can access current task
      setStoreTasks(result.issues)
      setError(null)
    } else {
      setError(result.error ?? "Failed to fetch tasks")
    }

    setIsLoading(false)
  }, [status, ready, all, setStoreTasks])

  // Initial fetch
  useEffect(() => {
    refresh()
  }, [refresh])

  // Polling
  useEffect(() => {
    if (pollInterval <= 0) return

    const intervalId = setInterval(refresh, pollInterval)
    return () => clearInterval(intervalId)
  }, [refresh, pollInterval])

  return { tasks, isLoading, error, refresh }
}
