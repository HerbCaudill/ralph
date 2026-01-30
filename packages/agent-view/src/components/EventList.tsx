import { useMemo } from "react"
import { useStreamingState } from "../hooks/useStreamingState"
import { buildToolResultsMap, type ToolResult } from "../lib/buildToolResultsMap"
import type { ChatEvent, StreamingMessage } from "../types"
import { EventStreamEventItem } from "./EventStreamEventItem"
import { StreamingContentRenderer } from "./StreamingContentRenderer"

/**
 * Renders a list of chat events including user messages, assistant text, tool uses, and streaming content.
 *
 * This is a headless component that handles event processing and rendering without container/scroll behavior.
 * Parent components can wrap this with scrollable containers, headers, or other UI elements.
 *
 * Features:
 * - Processes events through useStreamingState for proper handling of streaming content
 * - Builds tool results map for displaying tool use outcomes
 * - Renders completed events via EventStreamEventItem
 * - Renders streaming content via StreamingContentRenderer
 * - Supports optional loading indicator
 *
 * @example
 * ```tsx
 * <AutoScroll ariaLabel="Events">
 *   <EventList events={events} />
 * </AutoScroll>
 * ```
 */
export function EventList({ events, maxEvents = 1000, loadingIndicator }: EventListProps) {
  const { completedEvents, streamingMessage } = useStreamingState(events)

  const displayedEvents = completedEvents.slice(-maxEvents)

  const { toolResults, hasStructuredLifecycleEvents } = useMemo(
    () => buildToolResultsMap(displayedEvents),
    [displayedEvents],
  )

  const hasContent = displayedEvents.length > 0 || streamingMessage !== null

  if (!hasContent) {
    return null
  }

  return (
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
  )
}

/**
 * Hook to get the processed state from events.
 * Useful when parent components need access to the processed state for custom rendering.
 *
 * Returns:
 * - completedEvents: Events that have finished streaming
 * - streamingMessage: Currently streaming message (if any)
 * - toolResults: Map of tool use IDs to their results
 * - hasStructuredLifecycleEvents: Whether lifecycle events are present
 * - hasContent: Whether there is any content to display
 */
export function useEventListState(events: ChatEvent[], maxEvents: number = 1000) {
  const { completedEvents, streamingMessage } = useStreamingState(events)

  const displayedEvents = completedEvents.slice(-maxEvents)

  const { toolResults, hasStructuredLifecycleEvents } = useMemo(
    () => buildToolResultsMap(displayedEvents),
    [displayedEvents],
  )

  const hasContent = displayedEvents.length > 0 || streamingMessage !== null

  return {
    displayedEvents,
    completedEvents,
    streamingMessage,
    toolResults,
    hasStructuredLifecycleEvents,
    hasContent,
  }
}

export type EventListProps = {
  /** Events to process and display */
  events: ChatEvent[]
  /** Maximum number of events to display (older events are truncated) */
  maxEvents?: number
  /** Optional loading indicator to show at the bottom */
  loadingIndicator?: React.ReactNode
}

export type EventListState = {
  displayedEvents: ChatEvent[]
  completedEvents: ChatEvent[]
  streamingMessage: StreamingMessage | null
  toolResults: Map<string, ToolResult>
  hasStructuredLifecycleEvents: boolean
  hasContent: boolean
}
