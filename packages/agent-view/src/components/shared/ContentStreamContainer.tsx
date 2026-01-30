import { cn } from "../../lib/utils"
import { useAutoScroll } from "../../hooks/useAutoScroll"
import { ScrollToBottomButton } from "./ScrollToBottomButton"

/**
 * A shared container component that encapsulates a scrollable content area
 * with auto-scroll behavior.
 *
 * Used by EventStream and TaskChatController for consistent scrolling UX.
 *
 * @example
 * ```tsx
 * <ContentStreamContainer
 *   ariaLabel="Event stream"
 *   dependencies={[events]}
 *   emptyState={<Spinner />}
 * >
 *   {events.map(e => <EventItem key={e.id} event={e} />)}
 * </ContentStreamContainer>
 * ```
 */
export function ContentStreamContainer({
  children,
  className,
  ariaLabel,
  dependencies = [],
  emptyState,
  autoScrollEnabled = true,
  scrollButtonClassName,
}: ContentStreamContainerProps) {
  const { containerRef, isAtBottom, handleScroll, handleUserScroll, scrollToBottom } =
    useAutoScroll({
      dependencies,
      enabled: autoScrollEnabled,
    })

  const isEmpty = !children || (Array.isArray(children) && children.length === 0)
  const showEmptyState = isEmpty && emptyState

  return (
    <div className={cn("relative flex h-full flex-col", className)}>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        onWheel={handleUserScroll}
        onTouchMove={handleUserScroll}
        className="bg-background flex-1 overflow-y-auto pt-2 pb-[20em]"
        role="log"
        aria-label={ariaLabel}
        aria-live="polite"
      >
        {showEmptyState ? emptyState : children}
      </div>

      <ScrollToBottomButton
        isVisible={!isAtBottom}
        onClick={scrollToBottom}
        ariaLabel={`Scroll to latest ${ariaLabel.toLowerCase()}`}
        className={scrollButtonClassName}
      />
    </div>
  )
}

export type ContentStreamContainerProps = {
  /** The content to render inside the scrollable container */
  children: React.ReactNode
  /** Additional class names for the outer container */
  className?: string
  /** Aria label for the scrollable container (used for accessibility) */
  ariaLabel: string
  /** Dependencies that trigger auto-scroll when changed */
  dependencies?: unknown[]
  /** Content to show when there are no children */
  emptyState?: React.ReactNode
  /**
   * Whether auto-scroll is enabled. Useful for pausing auto-scroll
   * when viewing historical content.
   * @default true
   */
  autoScrollEnabled?: boolean
  /** Additional class names for the scroll-to-bottom button */
  scrollButtonClassName?: string
}
