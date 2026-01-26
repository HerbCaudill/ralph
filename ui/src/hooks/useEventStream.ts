import { useEffect, useMemo, useRef, useCallback } from "react"
import {
  useAppStore,
  selectEvents,
  selectRalphStatus,
  selectViewingIterationIndex,
  selectTasks,
  selectInstanceEvents,
  selectInstanceStatus,
  selectActiveInstance,
  selectInstance,
  selectIssuePrefix,
  getEventsForIteration,
} from "@/store"
import { useIterations, useEventLogRouter } from "@/hooks"
import type { IterationSummary } from "@/hooks"
import type { ChatEvent, Task, RalphStatus } from "@/types"

export interface IterationTask {
  id: string | null
  title: string
}

export interface IterationNavigationActions {
  selectIterationHistory: (id: string) => void
}

export interface UseEventStreamOptions {
  /** Optional instance ID to display events from. When omitted, shows events from the active instance. */
  instanceId?: string
  /** Maximum number of events to display. */
  maxEvents?: number
}

export interface UseEventStreamResult {
  /** Events for the current iteration */
  iterationEvents: ChatEvent[]
  /** Ralph status (running, stopped, etc.) */
  ralphStatus: RalphStatus
  /** Whether viewing the latest iteration */
  isViewingLatest: boolean
  /** Whether Ralph is currently running */
  isRunning: boolean
  /** Current task for the iteration */
  iterationTask: IterationTask | null
  /** Past iterations for history dropdown */
  iterations: IterationSummary[]
  /** Whether iterations are loading */
  isLoadingIterations: boolean
  /** Issue prefix for the workspace */
  issuePrefix: string | null
  /** Navigation actions */
  navigation: IterationNavigationActions
  /** Ref for the container element */
  containerRef: React.RefObject<HTMLDivElement | null>
}

/**
 * Hook that encapsulates all EventStream state and logic.
 * Provides data and actions for the EventStream component.
 */
export function useEventStream(options: UseEventStreamOptions = {}): UseEventStreamResult {
  const { instanceId } = options

  // Store selectors - when instanceId is provided, use instance-specific selectors
  const allEvents = useAppStore(state =>
    instanceId ? selectInstanceEvents(state, instanceId) : selectEvents(state),
  )
  const ralphStatus = useAppStore(state =>
    instanceId ? selectInstanceStatus(state, instanceId) : selectRalphStatus(state),
  )
  const viewingIterationIndex = useAppStore(selectViewingIterationIndex)
  const tasks = useAppStore(selectTasks)
  const issuePrefix = useAppStore(selectIssuePrefix)

  // Get instance for currentTaskId/currentTaskTitle fallback
  const instance = useAppStore(state =>
    instanceId ? selectInstance(state, instanceId) : selectActiveInstance(state),
  )

  // Computed values
  const isRunning =
    ralphStatus === "running" ||
    ralphStatus === "starting" ||
    ralphStatus === "stopping_after_current"
  const isViewingLatest = viewingIterationIndex === null

  // Fetch iterations for the history dropdown
  const { iterations, isLoading: isLoadingIterations } = useIterations()
  const { navigateToEventLog } = useEventLogRouter()

  // Iteration data - all events when viewing latest
  const iterationEvents = useMemo(
    () => getEventsForIteration(allEvents, viewingIterationIndex),
    [allEvents, viewingIterationIndex],
  )

  // Determine the current task for the iteration
  const iterationTask = useMemo((): IterationTask | null => {
    // First, try to find task from ralph_task_started event in iteration events
    for (const event of iterationEvents) {
      if ((event as { type: string }).type === "ralph_task_started") {
        const taskId = (event as { taskId?: string }).taskId
        const taskTitle = (event as { taskTitle?: string }).taskTitle
        // Accept tasks with taskTitle, or look up title from store if we have taskId
        if (taskTitle) {
          return { id: taskId || null, title: taskTitle }
        }
        if (taskId) {
          // Look up the task title from the store
          const task = tasks.find((t: Task) => t.id === taskId)
          const title = task?.title ?? taskId // Fall back to showing the ID if title not found
          return { id: taskId, title }
        }
      }
    }

    // Fallback: if no ralph_task_started event, show the first in-progress task from the store
    const inProgressTask = tasks.find((t: Task) => t.status === "in_progress")
    if (inProgressTask) {
      return { id: inProgressTask.id, title: inProgressTask.title }
    }

    // Final fallback: use the instance's currentTaskId/currentTaskTitle if available
    if (instance?.currentTaskId || instance?.currentTaskTitle) {
      return {
        id: instance.currentTaskId ?? null,
        title: instance.currentTaskTitle ?? instance.currentTaskId ?? "Unknown task",
      }
    }

    return null
  }, [iterationEvents, tasks, instance])

  // Container ref for scrolling
  const containerRef = useRef<HTMLDivElement>(null)

  // When viewing a historical iteration, scroll to bottom on iteration change
  useEffect(() => {
    if (!isViewingLatest && containerRef.current) {
      const scrollContainer = containerRef.current.querySelector('[role="log"]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [viewingIterationIndex, isViewingLatest])

  const handleIterationHistorySelect = useCallback(
    (id: string) => {
      navigateToEventLog(id)
    },
    [navigateToEventLog],
  )

  const navigation: IterationNavigationActions = useMemo(
    () => ({
      selectIterationHistory: handleIterationHistorySelect,
    }),
    [handleIterationHistorySelect],
  )

  return {
    iterationEvents,
    ralphStatus,
    isViewingLatest,
    isRunning,
    iterationTask,
    iterations,
    isLoadingIterations,
    issuePrefix,
    navigation,
    containerRef,
  }
}
