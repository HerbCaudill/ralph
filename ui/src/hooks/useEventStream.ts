import { useEffect, useMemo, useRef, useCallback } from "react"
import {
  useAppStore,
  selectEvents,
  selectRalphStatus,
  selectViewingSessionIndex,
  selectTasks,
  selectInstanceEvents,
  selectInstanceStatus,
  selectActiveInstance,
  selectInstance,
  selectIssuePrefix,
  getEventsForSession,
} from "@/store"
import { useSessions, buildSessionPath, parseSessionIdFromUrl } from "@/hooks"
import type { SessionSummary } from "@/hooks"
import type { ChatEvent, Task, RalphStatus } from "@/types"

export interface SessionTask {
  id: string | null
  title: string
}

export interface SessionNavigationActions {
  selectSessionHistory: (id: string) => void
  returnToLive: () => void
}

export interface UseEventStreamOptions {
  /** Optional instance ID to display events from. When omitted, shows events from the active instance. */
  instanceId?: string
  /** Maximum number of events to display. */
  maxEvents?: number
}

export interface UseEventStreamResult {
  /** Events for the current session */
  sessionEvents: ChatEvent[]
  /** Ralph status (running, stopped, etc.) */
  ralphStatus: RalphStatus
  /** Whether viewing the latest session */
  isViewingLatest: boolean
  /** Whether viewing a historical session from IndexedDB */
  isViewingHistorical: boolean
  /** Whether Ralph is currently running */
  isRunning: boolean
  /** Current task for the session */
  sessionTask: SessionTask | null
  /** Past sessions for history dropdown */
  sessions: SessionSummary[]
  /** Whether sessions are loading */
  isLoadingSessions: boolean
  /** Whether historical session events are loading */
  isLoadingHistoricalEvents: boolean
  /** Issue prefix for the workspace */
  issuePrefix: string | null
  /** ID of the currently viewed session (for highlighting in dropdown) */
  currentSessionId: string | null
  /** Navigation actions */
  navigation: SessionNavigationActions
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
  const viewingSessionIndex = useAppStore(selectViewingSessionIndex)
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
  const isViewingLatest = viewingSessionIndex === null

  // Fetch sessions for the history dropdown and manage selected session
  const {
    sessions,
    isLoading: isLoadingSessions,
    loadSessionEvents,
    selectedSession,
    isLoadingEvents: isLoadingHistoricalEvents,
    clearSelectedSession,
  } = useSessions()

  // Whether viewing a historical session from IndexedDB
  const isViewingHistorical = selectedSession !== null

  // Session data - use historical session events or live events
  const sessionEvents = useMemo(() => {
    if (selectedSession) {
      return selectedSession.events
    }
    return getEventsForSession(allEvents, viewingSessionIndex)
  }, [allEvents, viewingSessionIndex, selectedSession])

  // Determine the current task for the session
  const sessionTask = useMemo((): SessionTask | null => {
    // If viewing a historical session, use its metadata
    if (selectedSession?.metadata) {
      const { taskId, title } = selectedSession.metadata
      if (taskId || title) {
        return {
          id: taskId ?? null,
          title: title ?? taskId ?? "Unknown task",
        }
      }
    }

    // First, try to find task from ralph_task_started event in session events
    for (const event of sessionEvents) {
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
  }, [sessionEvents, tasks, instance, selectedSession])

  // Container ref for scrolling
  const containerRef = useRef<HTMLDivElement>(null)

  // When viewing a historical session, scroll to bottom on session change
  useEffect(() => {
    if (!isViewingLatest && containerRef.current) {
      const scrollContainer = containerRef.current.querySelector('[role="log"]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [viewingSessionIndex, isViewingLatest])

  // Handle URL-based session loading on mount and browser back/forward
  useEffect(() => {
    const handleUrlChange = () => {
      const sessionId = parseSessionIdFromUrl(window.location)
      if (sessionId) {
        // URL has a session ID, load it
        loadSessionEvents(sessionId)
      } else if (selectedSession) {
        // URL was cleared but we have a selected session, clear it
        clearSelectedSession()
      }
    }

    // Check URL on mount
    handleUrlChange()

    // Listen for popstate (browser back/forward)
    window.addEventListener("popstate", handleUrlChange)
    // Also listen for hashchange for legacy URL support
    window.addEventListener("hashchange", handleUrlChange)

    return () => {
      window.removeEventListener("popstate", handleUrlChange)
      window.removeEventListener("hashchange", handleUrlChange)
    }
  }, [loadSessionEvents, clearSelectedSession, selectedSession])

  const handleSessionHistorySelect = useCallback(
    (id: string) => {
      // Update URL to reflect the selected session
      window.history.pushState({ sessionId: id }, "", buildSessionPath(id))
      // Load the session data
      loadSessionEvents(id)
    },
    [loadSessionEvents],
  )

  const handleReturnToLive = useCallback(() => {
    // Clear the URL (go back to root)
    window.history.pushState(null, "", "/")
    // Clear the selected session
    clearSelectedSession()
  }, [clearSelectedSession])

  const navigation: SessionNavigationActions = useMemo(
    () => ({
      selectSessionHistory: handleSessionHistorySelect,
      returnToLive: handleReturnToLive,
    }),
    [handleSessionHistorySelect, handleReturnToLive],
  )

  return {
    sessionEvents,
    ralphStatus,
    isViewingLatest: isViewingLatest && !isViewingHistorical,
    isViewingHistorical,
    isRunning,
    sessionTask,
    sessions,
    isLoadingSessions,
    isLoadingHistoricalEvents,
    issuePrefix,
    currentSessionId: selectedSession?.id ?? null,
    navigation,
    containerRef,
  }
}
