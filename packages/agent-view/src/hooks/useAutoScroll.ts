import { useCallback, useEffect, useRef, useState } from "react"

/**  Options for the useAutoScroll hook. */
export type UseAutoScrollOptions = {
  /**
   * Threshold in pixels from the bottom to consider "at bottom".
   * @default 50
   */
  threshold?: number

  /**
   * Dependencies that trigger auto-scroll when changed.
   * Typically the content that's being rendered in the container.
   */
  dependencies?: unknown[]

  /**
   * Whether auto-scroll is enabled. Useful for pausing auto-scroll
   * when viewing historical content.
   * @default true
   */
  enabled?: boolean
}

/**  Return type for the useAutoScroll hook. */
export type UseAutoScrollReturn = {
  /** Ref to attach to the scrollable container */
  containerRef: React.RefObject<HTMLDivElement | null>

  /** Whether auto-scroll is currently enabled */
  autoScroll: boolean

  /** Whether the scroll position is at the bottom */
  isAtBottom: boolean

  /** Handler for container's onScroll event */
  handleScroll: () => void

  /** Handler for user-initiated scroll (wheel/touch) */
  handleUserScroll: () => void

  /** Scrolls to the bottom and re-enables auto-scroll */
  scrollToBottom: () => void
}

/**
 * Hook for managing auto-scroll behavior in a scrollable container.
 *
 * Auto-scrolls to bottom when dependencies change (e.g., new messages arrive),
 * but pauses when the user scrolls away from the bottom. Provides a
 * scroll-to-bottom function to resume auto-scroll.
 *
 * @example
 * ```tsx
 * function MessageList({ messages }) {
 *   const { containerRef, isAtBottom, handleScroll, handleUserScroll, scrollToBottom } =
 *     useAutoScroll({ dependencies: [messages] })
 *
 *   return (
 *     <div
 *       ref={containerRef}
 *       onScroll={handleScroll}
 *       onWheel={handleUserScroll}
 *       onTouchMove={handleUserScroll}
 *     >
 *       {messages.map(m => <Message key={m.id} {...m} />)}
 *       {!isAtBottom && <ScrollToBottomButton onClick={scrollToBottom} />}
 *     </div>
 *   )
 * }
 * ```
 */
export function useAutoScroll(options: UseAutoScrollOptions = {}): UseAutoScrollReturn {
  const { threshold = 50, dependencies = [], enabled = true } = options

  const containerRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [isAtBottom, setIsAtBottom] = useState(true)

  const checkIsAtBottom = useCallback(() => {
    const container = containerRef.current
    if (!container) return true

    const scrollBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    return scrollBottom <= threshold
  }, [threshold])

  const handleScroll = useCallback(() => {
    const atBottom = checkIsAtBottom()
    setIsAtBottom(atBottom)

    // Don't re-enable autoScroll here - only track position.
    // Re-enabling autoScroll on every scroll event that happens to be near bottom
    // can cause jittering loops when content height changes (e.g., syntax highlighting).
    // autoScroll is only re-enabled via scrollToBottom() or when user scrolls to bottom
    // via wheel/touch (handleUserScroll).
  }, [checkIsAtBottom])

  const handleUserScroll = useCallback(() => {
    const atBottom = checkIsAtBottom()
    if (!atBottom) {
      setAutoScroll(false)
    } else if (!autoScroll) {
      // User explicitly scrolled back to bottom, re-enable auto-scroll
      setAutoScroll(true)
    }
  }, [checkIsAtBottom, autoScroll])

  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
      setAutoScroll(true)
      setIsAtBottom(true)
    }
  }, [])

  // Scroll to bottom on initial mount, regardless of `enabled` state.
  // The `enabled` flag controls ongoing auto-scroll (keeping up with new content),
  // not the initial scroll position — a chat/log container should always start at the bottom.
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, [])

  // Auto-scroll when dependencies change
  useEffect(() => {
    if (autoScroll && enabled && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dependencies is intentionally spread
  }, [...dependencies, autoScroll, enabled])

  return {
    containerRef,
    autoScroll,
    isAtBottom,
    handleScroll,
    handleUserScroll,
    scrollToBottom,
  }
}
