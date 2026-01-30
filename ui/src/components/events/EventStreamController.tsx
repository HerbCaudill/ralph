import { useEventStream } from "@/hooks/useEventStream"
import { EventStream } from "./EventStream"

/**
 * Controller component for the event stream display.
 *
 * Uses the useEventStream hook to access store state and provides
 * all data to the presentational EventStream component.
 *
 * When `instanceId` is provided, displays events from that specific instance.
 * Otherwise, displays events from the currently active instance.
 */
export function EventStreamController(
  /** Props for EventStreamController */
  { className, maxEvents = 1000, instanceId }: EventStreamControllerProps,
) {
  const {
    sessionEvents,
    ralphStatus,
    isViewingLatest,
    isViewingHistorical,
    isRunning,
    isConnected,
    sessionTask,
    sessions,
    isLoadingSessions,
    isLoadingHistoricalEvents,
    issuePrefix,
    currentSessionId,
    navigation,
    containerRef,
  } = useEventStream({ instanceId, maxEvents })

  return (
    <EventStream
      ref={containerRef}
      className={className}
      maxEvents={maxEvents}
      sessionEvents={sessionEvents}
      ralphStatus={ralphStatus}
      isViewingLatest={isViewingLatest}
      isViewingHistorical={isViewingHistorical}
      isRunning={isRunning}
      isConnected={isConnected}
      sessionTask={sessionTask}
      sessions={sessions}
      isLoadingSessions={isLoadingSessions}
      isLoadingHistoricalEvents={isLoadingHistoricalEvents}
      issuePrefix={issuePrefix}
      currentSessionId={currentSessionId}
      navigation={navigation}
    />
  )
}

/** Props for the EventStreamController component */
export type EventStreamControllerProps = {
  /** Optional CSS class to apply to the container */
  className?: string
  /** Maximum number of events to display. Older events are removed when exceeded. */
  maxEvents?: number
  /** Optional instance ID to display events from. When provided, shows events from the specified instance. When omitted, shows events from the active instance. */
  instanceId?: string
}
