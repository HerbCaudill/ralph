import { useEffect, useMemo } from "react"
import { cn } from "@/lib/utils"
import {
  useAppStore,
  selectEvents,
  selectRalphStatus,
  selectViewingIterationIndex,
  selectTasks,
  selectInstanceEvents,
  selectInstanceStatus,
  getEventsForIteration,
  countIterations,
} from "@/store"
import { TopologySpinner } from "@/components/ui/TopologySpinner"
import { useAutoScroll } from "@/hooks/useAutoScroll"
import { useStreamingState } from "@/hooks/useStreamingState"
import { isRalphTaskCompletedEvent } from "@/lib/isRalphTaskCompletedEvent"
import { isRalphTaskStartedEvent } from "@/lib/isRalphTaskStartedEvent"
import { isToolResultEvent } from "@/lib/isToolResultEvent"
import { EventStreamEventItem } from "./EventStreamEventItem"
import { EventStreamIterationBar } from "./EventStreamIterationBar"
import { StreamingContentRenderer } from "./StreamingContentRenderer"
import { ScrollToBottomButton } from "@/components/shared/ScrollToBottomButton"

/**
 * Scrollable container displaying real-time events from ralph.
 * Auto-scrolls to bottom, pauses on user interaction.
 *
 * When `instanceId` is provided, displays events from that specific instance.
 * Otherwise, displays events from the currently active instance.
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
  const goToPreviousIteration = useAppStore(state => state.goToPreviousIteration)
  const goToNextIteration = useAppStore(state => state.goToNextIteration)
  const goToLatestIteration = useAppStore(state => state.goToLatestIteration)
  const tasks = useAppStore(selectTasks)
  const isRunning = ralphStatus === "running" || ralphStatus === "starting"
  const isViewingLatest = viewingIterationIndex === null

  const iterationCount = useMemo(() => countIterations(allEvents), [allEvents])
  const iterationEvents = useMemo(
    () => getEventsForIteration(allEvents, viewingIterationIndex),
    [allEvents, viewingIterationIndex],
  )

  const iterationTask = useMemo(() => {
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
    return null
  }, [iterationEvents, tasks])

  const events = iterationEvents

  const { completedEvents, streamingMessage } = useStreamingState(events)

  const displayedEvents = completedEvents.slice(-maxEvents)

  const toolResults = new Map<string, { output?: string; error?: string }>()
  let hasStructuredLifecycleEvents = false
  for (const event of displayedEvents) {
    if (isToolResultEvent(event)) {
      const content = (event as any).message?.content
      if (Array.isArray(content)) {
        for (const item of content) {
          if (item.type === "tool_result" && item.tool_use_id) {
            toolResults.set(item.tool_use_id, {
              output: typeof item.content === "string" ? item.content : undefined,
              error:
                item.is_error ?
                  typeof item.content === "string" ?
                    item.content
                  : "Error"
                : undefined,
            })
          }
        }
      }
    }
    if (isRalphTaskStartedEvent(event) || isRalphTaskCompletedEvent(event)) {
      hasStructuredLifecycleEvents = true
    }
  }

  // Use the shared auto-scroll hook
  const { containerRef, isAtBottom, handleScroll, handleUserScroll, scrollToBottom } =
    useAutoScroll({
      dependencies: [events],
      enabled: isViewingLatest,
    })

  // When viewing a historical iteration, scroll to bottom on iteration change
  useEffect(() => {
    if (!isViewingLatest && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [viewingIterationIndex, isViewingLatest, containerRef])

  const displayedIteration =
    viewingIterationIndex !== null ? viewingIterationIndex + 1 : iterationCount

  return (
    <div className={cn("relative flex h-full flex-col", className)}>
      <EventStreamIterationBar
        iterationCount={iterationCount}
        displayedIteration={displayedIteration}
        isViewingLatest={isViewingLatest}
        viewingIterationIndex={viewingIterationIndex}
        currentTask={iterationTask}
        onPrevious={goToPreviousIteration}
        onNext={goToNextIteration}
        onLatest={goToLatestIteration}
      />

      <div
        ref={containerRef}
        onScroll={handleScroll}
        onWheel={handleUserScroll}
        onTouchMove={handleUserScroll}
        className="bg-background flex-1 overflow-y-auto py-2"
        role="log"
        aria-label="Event stream"
        aria-live="polite"
      >
        {allEvents.length === 0 ?
          <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
            No events yet
          </div>
        : <>
            {displayedEvents.map((event, index) => (
              <EventStreamEventItem
                key={`${event.timestamp}-${index}`}
                event={event}
                toolResults={toolResults}
                hasStructuredLifecycleEvents={hasStructuredLifecycleEvents}
              />
            ))}
            {streamingMessage && <StreamingContentRenderer message={streamingMessage} />}
            {isRunning && isViewingLatest && (
              <div
                className="flex items-center justify-start px-4 py-4"
                aria-label="Ralph is running"
                data-testid="ralph-running-spinner"
              >
                <TopologySpinner />
              </div>
            )}
          </>
        }
      </div>

      <ScrollToBottomButton
        isVisible={!isAtBottom}
        onClick={scrollToBottom}
        ariaLabel="Scroll to latest events"
      />
    </div>
  )
}

export type EventStreamProps = {
  className?: string
  /**
   * Maximum number of events to display. Older events are removed when exceeded.
   * @default 1000
   */
  maxEvents?: number
  /**
   * Optional instance ID to display events from. When provided, shows events
   * from the specified instance. When omitted, shows events from the active instance.
   */
  instanceId?: string
}
