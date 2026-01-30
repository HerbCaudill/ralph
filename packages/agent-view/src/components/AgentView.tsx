import { AgentViewProvider } from "../context/AgentViewProvider"
import { ContentStreamContainer } from "./ContentStreamContainer"
import { EventList } from "./EventList"
import { TopologySpinner } from "./TopologySpinner"
import { cx } from "../cx"
import type { ChatEvent, AgentViewContextValue } from "../types"

/**
 * High-level composition component that wraps agent-view primitives with
 * sensible defaults and slot-based customization.
 *
 * Provides a complete event display with scrollable container, auto-scroll,
 * loading spinner, and scroll-to-bottom button out of the box. Each piece
 * can be overridden or hidden via slot props.
 *
 * @example
 * ```tsx
 * <AgentView events={events} isStreaming={true} />
 * ```
 *
 * @example Custom slots
 * ```tsx
 * <AgentView
 *   events={events}
 *   isStreaming={false}
 *   header={<h2>Session log</h2>}
 *   emptyState={<p>No events yet.</p>}
 *   scrollButton={false}
 * />
 * ```
 */
export function AgentView({
  events,
  isStreaming = false,
  context,
  header,
  footer,
  emptyState,
  loadingIndicator,
  scrollButton,
  className,
}: AgentViewProps) {
  /** Resolve the loading indicator: use custom if provided, otherwise default spinner when streaming. */
  const spinner =
    loadingIndicator !== undefined ? loadingIndicator : (
      isStreaming && (
        <div className="flex justify-center py-4">
          <TopologySpinner />
        </div>
      )
    )

  /** Hide the built-in scroll button when the consumer passes false. */
  const hideScrollButton = scrollButton === false

  return (
    <AgentViewProvider value={context}>
      <div className={cx("flex h-full flex-col", className)}>
        {header}
        <ContentStreamContainer
          ariaLabel="Agent events"
          dependencies={[events]}
          emptyState={emptyState}
          autoScrollEnabled={isStreaming}
          scrollButtonClassName={hideScrollButton ? "hidden" : undefined}
        >
          <EventList events={events} loadingIndicator={spinner} />
        </ContentStreamContainer>
        {footer}
      </div>
    </AgentViewProvider>
  )
}

export type AgentViewProps = {
  /** Events to display */
  events: ChatEvent[]
  /** Whether the agent is currently streaming/active */
  isStreaming?: boolean
  /** Context configuration passed to AgentViewProvider */
  context?: Partial<AgentViewContextValue>
  /** Slot: header content above the event list */
  header?: React.ReactNode
  /** Slot: footer content below the event list */
  footer?: React.ReactNode
  /** Slot: empty state when no events */
  emptyState?: React.ReactNode
  /** Slot: loading indicator (defaults to TopologySpinner when streaming) */
  loadingIndicator?: React.ReactNode
  /** Slot: set to false to hide the scroll-to-bottom button */
  scrollButton?: React.ReactNode | false
  /** Additional className for the outer container */
  className?: string
}
