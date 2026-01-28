import { useMemo } from "react"
import { ContentStreamContainer } from "@/components/shared/ContentStreamContainer"
import { useStreamingState } from "@/hooks/useStreamingState"
import { buildToolResultsMap, type ToolResult } from "@/lib/buildToolResultsMap"
import type { ChatEvent, StreamingMessage } from "@/types"
import { EventStreamEventItem } from "./EventStreamEventItem"
import { StreamingContentRenderer } from "./StreamingContentRenderer"

/**
 * Shared event display component that handles event processing and rendering.
 *
 * This is the core display logic extracted from EventStream and TaskChatPanel.
 * It handles:
 * - Processing events through useStreamingState
 * - Building tool results map
 * - Rendering completed events via EventStreamEventItem
 * - Rendering streaming content via StreamingContentRenderer
 *
 * Parent components can wrap this with session bars, chat inputs, or other UI.
 */
export function EventDisplay({
  events,
  maxEvents = 1000,
  emptyState,
  loadingIndicator,
  className,
  ariaLabel = "Event stream",
  autoScrollEnabled = true,
}: EventDisplayProps) {
  const { completedEvents, streamingMessage } = useStreamingState(events)

  const displayedEvents = completedEvents.slice(-maxEvents)

  const { toolResults, hasStructuredLifecycleEvents } = useMemo(
    () => buildToolResultsMap(displayedEvents),
    [displayedEvents],
  )

  const hasContent = displayedEvents.length > 0 || streamingMessage !== null

  return (
    <ContentStreamContainer
      className={className}
      ariaLabel={ariaLabel}
      dependencies={[events]}
      emptyState={emptyState}
      autoScrollEnabled={autoScrollEnabled}
    >
      {hasContent ?
        <>
          {displayedEvents.map((event, index) => (
            <EventStreamEventItem
              key={`${event.timestamp}-${index}`}
              event={event}
              eventIndex={index}
              toolResults={toolResults}
              hasStructuredLifecycleEvents={hasStructuredLifecycleEvents}
            />
          ))}
          {streamingMessage && <StreamingContentRenderer message={streamingMessage} />}
          {loadingIndicator}
        </>
      : null}
    </ContentStreamContainer>
  )
}

/**
 * Hook to get streaming state from events.
 * Useful when parent components need access to the streaming state
 * for custom rendering or additional logic.
 */
export function useEventDisplayState(events: ChatEvent[]) {
  const { completedEvents, streamingMessage } = useStreamingState(events)

  const { toolResults, hasStructuredLifecycleEvents } = useMemo(
    () => buildToolResultsMap(completedEvents),
    [completedEvents],
  )

  return {
    completedEvents,
    streamingMessage,
    toolResults,
    hasStructuredLifecycleEvents,
  }
}

export type EventDisplayProps = {
  /** Events to process and display */
  events: ChatEvent[]
  /** Maximum number of events to display (older events are truncated) */
  maxEvents?: number
  /** Content to show when there are no events */
  emptyState?: React.ReactNode
  /** Optional loading indicator to show at the bottom */
  loadingIndicator?: React.ReactNode
  /** Additional CSS class for the container */
  className?: string
  /** Aria label for accessibility */
  ariaLabel?: string
  /** Whether auto-scroll is enabled */
  autoScrollEnabled?: boolean
}

export type EventDisplayState = {
  completedEvents: ChatEvent[]
  streamingMessage: StreamingMessage | null
  toolResults: Map<string, ToolResult>
  hasStructuredLifecycleEvents: boolean
}
