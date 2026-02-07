import { AgentViewProvider } from "../context/AgentViewProvider"
import { AutoScroll } from "./AutoScroll"
import { EventList } from "./EventList"
import { cx } from "../cx"
import type { ChatEvent, AgentViewContextValue } from "../types"

/** Simple CSS-only spinning circle used as the default spinner. */
const DEFAULT_SPINNER = (
  <div className="text-repo-accent size-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
)

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
 * @example Custom spinner
 * ```tsx
 * <AgentView
 *   events={events}
 *   isStreaming={true}
 *   spinner={<TopologySpinner />}
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
  spinner = DEFAULT_SPINNER,
  scrollButton,
  className,
}: AgentViewProps) {
  /** Resolve the loading indicator: use custom if provided, otherwise wrap the spinner when streaming. */
  const resolvedLoadingIndicator =
    loadingIndicator !== undefined ? loadingIndicator : (
      isStreaming && <div className="flex justify-start py-4 pl-4">{spinner}</div>
    )

  /** Hide the built-in scroll button when the consumer passes false. */
  const hideScrollButton = scrollButton === false

  /**
   * When streaming with no events yet (e.g. Ralph loop just started), show the
   * spinner as the empty state so the user sees activity immediately.
   */
  const effectiveEmptyState =
    isStreaming && events.length === 0 ?
      <div className="flex h-full items-center justify-center p-8">{spinner}</div>
    : emptyState

  return (
    <AgentViewProvider value={context}>
      <div className={cx("flex h-full flex-col", className)}>
        {header}
        <AutoScroll
          ariaLabel="Agent Events"
          dependencies={[events]}
          emptyState={effectiveEmptyState}
          autoScrollEnabled={isStreaming}
          scrollButtonClassName={hideScrollButton ? "hidden" : undefined}
        >
          <EventList events={events} loadingIndicator={resolvedLoadingIndicator} />
        </AutoScroll>
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
  /** Slot: spinner element shown when streaming (defaults to a simple spinning circle) */
  spinner?: React.ReactNode
  /** Slot: full loading indicator override (bypasses the default spinner wrapper) */
  loadingIndicator?: React.ReactNode
  /** Slot: set to false to hide the scroll-to-bottom button */
  scrollButton?: React.ReactNode | false
  /** Additional className for the outer container */
  className?: string
}
