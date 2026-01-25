import { useEffect, useMemo, useRef, useCallback } from "react"
import { cn } from "@/lib/utils"
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
  countIterations,
} from "@/store"
import { useEventLogs, useEventLogRouter } from "@/hooks"
import { ContentStreamContainer } from "@/components/shared/ContentStreamContainer"
import { TopologySpinner } from "@/components/ui/TopologySpinner"
import { EventList, useEventListState } from "./EventList"
import { EventStreamIterationBar } from "./EventStreamIterationBar"

/**
 * Scrollable container displaying real-time events from ralph.
 * Auto-scrolls to bottom, pauses on user interaction.
 *
 * When `instanceId` is provided, displays events from that specific instance.
 * Otherwise, displays events from the currently active instance.
 *
 * Uses EventList for core event rendering, adding iteration navigation on top.
 */
export function EventStream({ className, maxEvents = 1000, instanceId }: EventStreamProps) {
  // When instanceId is provided, use instance-specific selectors
  // Otherwise, use the default selectors that read from the active instance
  const allEvents = useAppStore(state =>
    instanceId ? selectInstanceEvents(state, instanceId) : selectEvents(state),
  )
  const ralphStatus = useAppStore(state =>
    instanceId ? selectInstanceStatus(state, instanceId) : selectRalphStatus(state),
  )

  const viewingIterationIndex = useAppStore(selectViewingIterationIndex)
  const setViewingIterationIndex = useAppStore(state => state.setViewingIterationIndex)
  const goToPreviousIteration = useAppStore(state => state.goToPreviousIteration)
  const goToNextIteration = useAppStore(state => state.goToNextIteration)
  const goToLatestIteration = useAppStore(state => state.goToLatestIteration)
  const tasks = useAppStore(selectTasks)
  const issuePrefix = useAppStore(selectIssuePrefix)
  // Get instance for currentTaskId/currentTaskTitle fallback
  const instance = useAppStore(state =>
    instanceId ? selectInstance(state, instanceId) : selectActiveInstance(state),
  )
  const isRunning =
    ralphStatus === "running" ||
    ralphStatus === "starting" ||
    ralphStatus === "stopping_after_current"
  const isViewingLatest = viewingIterationIndex === null

  // Fetch event logs for the history dropdown
  const { eventLogs, isLoading: isLoadingEventLogs } = useEventLogs()
  const { navigateToEventLog } = useEventLogRouter()

  // Callbacks for iteration navigation
  const handleIterationSelect = useCallback(
    (index: number) => {
      setViewingIterationIndex(index)
    },
    [setViewingIterationIndex],
  )

  const handleEventLogSelect = useCallback(
    (id: string) => {
      navigateToEventLog(id)
    },
    [navigateToEventLog],
  )

  const iterationCount = useMemo(() => countIterations(allEvents), [allEvents])
  const iterationEvents = useMemo(
    () => getEventsForIteration(allEvents, viewingIterationIndex),
    [allEvents, viewingIterationIndex],
  )

  const iterationTask = useMemo(() => {
    // First, try to find task from ralph_task_started event in iteration events
    for (const event of iterationEvents) {
      if (event.type === "ralph_task_started") {
        const taskId = (event as any).taskId as string | undefined
        const taskTitle = (event as any).taskTitle as string | undefined
        // Accept tasks with taskTitle, or look up title from store if we have taskId
        if (taskTitle) {
          return { id: taskId || null, title: taskTitle }
        }
        if (taskId) {
          // Look up the task title from the store
          const task = tasks.find(t => t.id === taskId)
          const title = task?.title ?? taskId // Fall back to showing the ID if title not found
          return { id: taskId, title }
        }
      }
    }

    // Fallback: if no ralph_task_started event, show the first in-progress task from the store
    // This handles the case where Claude updates task status but doesn't emit lifecycle events
    const inProgressTask = tasks.find(t => t.status === "in_progress")
    if (inProgressTask) {
      return { id: inProgressTask.id, title: inProgressTask.title }
    }

    // Final fallback: use the instance's currentTaskId/currentTaskTitle if available
    // This handles page reload scenarios where the server restores the task info
    // but the ralph_task_started event may not be in the restored events
    if (instance?.currentTaskId || instance?.currentTaskTitle) {
      return {
        id: instance.currentTaskId ?? null,
        title: instance.currentTaskTitle ?? instance.currentTaskId ?? "Unknown task",
      }
    }

    return null
  }, [iterationEvents, tasks, instance])

  // Track ref for scrolling to bottom on iteration change
  const containerRef = useRef<HTMLDivElement>(null)

  // When viewing a historical iteration, scroll to bottom on iteration change
  useEffect(() => {
    if (!isViewingLatest && containerRef.current) {
      // Find the scrollable container inside ContentStreamContainer
      const scrollContainer = containerRef.current.querySelector('[role="log"]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [viewingIterationIndex, isViewingLatest])

  const displayedIteration =
    viewingIterationIndex !== null ? viewingIterationIndex + 1 : iterationCount

  // Use the shared hook to get content state for empty state handling
  const { hasContent } = useEventListState(iterationEvents, maxEvents)

  // Show active spinner when running, stopped spinner when idle with content
  const bottomIndicator = useMemo(() => {
    if (isRunning && isViewingLatest) {
      return (
        <div
          className="flex items-center justify-start px-4 py-4"
          aria-label="Ralph is running"
          data-testid="ralph-running-spinner"
        >
          <TopologySpinner />
        </div>
      )
    }
    if (hasContent && isViewingLatest) {
      return (
        <div
          className="flex items-center justify-start px-4 py-4"
          aria-label="Ralph is idle"
          data-testid="ralph-idle-spinner"
        >
          <TopologySpinner stopped />
        </div>
      )
    }
    return null
  }, [isRunning, isViewingLatest, hasContent])

  const emptyState = (
    <div className="flex h-full items-center justify-start px-4 py-4">
      <TopologySpinner />
    </div>
  )

  return (
    <div ref={containerRef} className={cn("relative flex h-full flex-col", className)}>
      <EventStreamIterationBar
        iterationCount={iterationCount}
        displayedIteration={displayedIteration}
        isViewingLatest={isViewingLatest}
        viewingIterationIndex={viewingIterationIndex}
        currentTask={iterationTask}
        eventLogs={eventLogs}
        isLoadingEventLogs={isLoadingEventLogs}
        issuePrefix={issuePrefix}
        onPrevious={goToPreviousIteration}
        onNext={goToNextIteration}
        onLatest={goToLatestIteration}
        onIterationSelect={handleIterationSelect}
        onEventLogSelect={handleEventLogSelect}
      />

      <ContentStreamContainer
        className="flex-1"
        ariaLabel="Event stream"
        dependencies={[iterationEvents]}
        emptyState={emptyState}
        autoScrollEnabled={isViewingLatest}
      >
        {hasContent ?
          <EventList
            events={iterationEvents}
            maxEvents={maxEvents}
            loadingIndicator={bottomIndicator}
          />
        : null}
      </ContentStreamContainer>
    </div>
  )
}

/**  Props for the EventStream component */
export type EventStreamProps = {
  /** Optional CSS class to apply to the container */
  className?: string
  /** Maximum number of events to display. Older events are removed when exceeded. */
  maxEvents?: number
  /** Optional instance ID to display events from. When provided, shows events from the specified instance. When omitted, shows events from the active instance. */
  instanceId?: string
}
