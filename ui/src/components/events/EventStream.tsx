import { useEventStream } from "@/hooks/useEventStream"
import { EventStreamView } from "./EventStreamView"

/**
 * Controller component for the event stream display.
 *
 * Uses the useEventStream hook to access store state and provides
 * all data to the presentational EventStreamView component.
 *
 * When `instanceId` is provided, displays events from that specific instance.
 * Otherwise, displays events from the currently active instance.
 */
export function EventStream({ className, maxEvents = 1000, instanceId }: EventStreamProps) {
  const {
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
  } = useEventStream({ instanceId, maxEvents })

  return (
    <EventStreamView
      ref={containerRef}
      className={className}
      maxEvents={maxEvents}
      iterationEvents={iterationEvents}
      ralphStatus={ralphStatus}
      isViewingLatest={isViewingLatest}
      isRunning={isRunning}
      iterationTask={iterationTask}
      iterations={iterations}
      isLoadingIterations={isLoadingIterations}
      issuePrefix={issuePrefix}
      navigation={navigation}
    />
  )
}

/** Props for the EventStream component */
export type EventStreamProps = {
  /** Optional CSS class to apply to the container */
  className?: string
  /** Maximum number of events to display. Older events are removed when exceeded. */
  maxEvents?: number
  /** Optional instance ID to display events from. When provided, shows events from the specified instance. When omitted, shows events from the active instance. */
  instanceId?: string
}

// Re-export the view for direct usage in stories
export { EventStreamView } from "./EventStreamView"
export type { EventStreamViewProps } from "./EventStreamView"
