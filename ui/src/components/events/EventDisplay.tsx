import { useMemo } from "react"
import { ContentStreamContainer } from "@/components/shared/ContentStreamContainer"
import { useStreamingState } from "@/hooks/useStreamingState"
import { isRalphTaskCompletedEvent } from "@/lib/isRalphTaskCompletedEvent"
import { isRalphTaskStartedEvent } from "@/lib/isRalphTaskStartedEvent"
import { isToolResultEvent } from "@/lib/isToolResultEvent"
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
 * Parent components can wrap this with iteration bars, chat inputs, or other UI.
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

  // Build tool results map from user/tool_result events
  const { toolResults, hasStructuredLifecycleEvents } = useMemo(() => {
    const results = new Map<string, { output?: string; error?: string }>()
    let hasLifecycleEvents = false

    for (const event of displayedEvents) {
      if (isToolResultEvent(event)) {
        const content = (event as any).message?.content
        if (Array.isArray(content)) {
          for (const item of content) {
            if (item.type === "tool_result" && item.tool_use_id) {
              results.set(item.tool_use_id, {
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
        hasLifecycleEvents = true
      }
    }

    return { toolResults: results, hasStructuredLifecycleEvents: hasLifecycleEvents }
  }, [displayedEvents])

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

  // Build tool results map from user/tool_result events
  const { toolResults, hasStructuredLifecycleEvents } = useMemo(() => {
    const results = new Map<string, { output?: string; error?: string }>()
    let hasLifecycleEvents = false

    for (const event of completedEvents) {
      if (isToolResultEvent(event)) {
        const content = (event as any).message?.content
        if (Array.isArray(content)) {
          for (const item of content) {
            if (item.type === "tool_result" && item.tool_use_id) {
              results.set(item.tool_use_id, {
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
        hasLifecycleEvents = true
      }
    }

    return { toolResults: results, hasStructuredLifecycleEvents: hasLifecycleEvents }
  }, [completedEvents])

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
  toolResults: Map<string, { output?: string; error?: string }>
  hasStructuredLifecycleEvents: boolean
}
