import { cn } from "@/lib/utils"
import {
  useAppStore,
  selectEvents,
  selectRalphStatus,
  selectViewingIterationIndex,
  getEventsForIteration,
  countIterations,
  type RalphEvent,
} from "@/store"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { IconChevronDown, IconChevronLeft, IconChevronRight } from "@tabler/icons-react"
import { TopologySpinner } from "@/components/ui/TopologySpinner"
import { UserMessage, type UserMessageEvent } from "./UserMessage"
import { AssistantText, type AssistantTextEvent } from "./AssistantText"
import { ToolUseCard, type ToolUseEvent } from "./ToolUseCard"
import {
  useStreamingState,
  type StreamingMessage,
  type StreamingContentBlock,
} from "@/hooks/useStreamingState"

// Types

export interface EventStreamProps {
  className?: string
  /**
   * Maximum number of events to display. Older events are removed when exceeded.
   * @default 1000
   */
  maxEvents?: number
}

// Event type guards

function isUserMessageEvent(event: RalphEvent): event is UserMessageEvent & RalphEvent {
  return event.type === "user_message" && typeof (event as any).message === "string"
}

function isAssistantMessage(event: RalphEvent): boolean {
  return event.type === "assistant" && typeof (event as any).message === "object"
}

function isToolResultEvent(event: RalphEvent): boolean {
  return event.type === "user" && typeof (event as any).tool_use_result !== "undefined"
}

// Content block types from Ralph's assistant messages
interface TextContentBlock {
  type: "text"
  text: string
}

interface ToolUseContentBlock {
  type: "tool_use"
  id: string
  name: string
  input: Record<string, unknown>
}

type ContentBlock = TextContentBlock | ToolUseContentBlock

// Render helper for assistant message content blocks

function renderContentBlock(
  block: ContentBlock,
  index: number,
  timestamp: number,
  toolResults: Map<string, { output?: string; error?: string }>,
) {
  if (block.type === "text") {
    const textEvent: AssistantTextEvent = {
      type: "text",
      timestamp,
      content: block.text,
    }
    return <AssistantText key={`text-${index}`} event={textEvent} />
  }

  if (block.type === "tool_use") {
    const result = toolResults.get(block.id)
    const toolEvent: ToolUseEvent = {
      type: "tool_use",
      timestamp,
      tool: block.name as ToolUseEvent["tool"],
      input: block.input,
      status:
        result ?
          result.error ?
            "error"
          : "success"
        : "success",
      output: result?.output,
      error: result?.error,
    }
    return <ToolUseCard key={`tool-${block.id}`} event={toolEvent} />
  }

  return null
}

// Helper to unescape JSON string escapes like \" and \\
function unescapeJsonString(s: string): string {
  return s.replace(/\\(.)/g, (_, char) => {
    switch (char) {
      case "n":
        return "\n"
      case "t":
        return "\t"
      case "r":
        return "\r"
      default:
        return char // handles \" and \\ and others
    }
  })
}

// Streaming content renderer

function StreamingContentRenderer({ message }: { message: StreamingMessage }) {
  return (
    <>
      {message.contentBlocks.map((block, index) => (
        <StreamingBlockRenderer key={index} block={block} timestamp={message.timestamp} />
      ))}
    </>
  )
}

function StreamingBlockRenderer({
  block,
  timestamp,
}: {
  block: StreamingContentBlock
  timestamp: number
}) {
  if (block.type === "text") {
    if (!block.text) return null
    const textEvent: AssistantTextEvent = {
      type: "text",
      timestamp,
      content: block.text,
    }
    return <AssistantText event={textEvent} />
  }

  if (block.type === "tool_use") {
    // Parse partial JSON for display
    let input: Record<string, unknown> = {}
    try {
      input = JSON.parse(block.input)
    } catch {
      // Partial JSON - try to extract what we can for display
      // Look for common patterns like "command": "..."
      // The regex uses (?:[^"\\]|\\.)* to match either:
      // - any char except " or \
      // - OR a backslash followed by any char (escaped char)
      const commandMatch = block.input.match(/"command"\s*:\s*"((?:[^"\\]|\\.)*)/)
      const filePathMatch = block.input.match(/"file_path"\s*:\s*"((?:[^"\\]|\\.)*)/)
      const patternMatch = block.input.match(/"pattern"\s*:\s*"((?:[^"\\]|\\.)*)/)
      if (commandMatch) input = { command: unescapeJsonString(commandMatch[1]) }
      else if (filePathMatch) input = { file_path: unescapeJsonString(filePathMatch[1]) }
      else if (patternMatch) input = { pattern: unescapeJsonString(patternMatch[1]) }
    }

    const toolEvent: ToolUseEvent = {
      type: "tool_use",
      timestamp,
      tool: block.name as ToolUseEvent["tool"],
      input,
      status: "running",
    }
    return <ToolUseCard event={toolEvent} />
  }

  return null
}

// EventItem Component - renders appropriate component based on event type

interface EventItemProps {
  event: RalphEvent
  toolResults: Map<string, { output?: string; error?: string }>
}

function EventItem({ event, toolResults }: EventItemProps) {
  // User message from chat input
  if (isUserMessageEvent(event)) {
    return <UserMessage event={event as unknown as UserMessageEvent} />
  }

  // Assistant message with content blocks (text and/or tool_use)
  if (isAssistantMessage(event)) {
    const message = (event as any).message
    const content = message?.content as ContentBlock[] | undefined

    if (!content || content.length === 0) return null

    return (
      <>
        {content.map((block, index) =>
          renderContentBlock(block, index, event.timestamp, toolResults),
        )}
      </>
    )
  }

  // Skip tool result events (they're used to populate toolResults map)
  if (isToolResultEvent(event)) {
    return null
  }

  // Skip stream events (intermediate streaming data)
  if (event.type === "stream_event") {
    return null
  }

  // Skip system events
  if (event.type === "system") {
    return null
  }

  // Fallback for unknown event types - show minimal debug info
  return null
}

// EventStream Component

/**
 * Scrollable container displaying real-time events from ralph.
 * Auto-scrolls to bottom, pauses on user interaction.
 */
export function EventStream({ className, maxEvents = 1000 }: EventStreamProps) {
  const allEvents = useAppStore(selectEvents)
  const viewingIterationIndex = useAppStore(selectViewingIterationIndex)
  const goToPreviousIteration = useAppStore(state => state.goToPreviousIteration)
  const goToNextIteration = useAppStore(state => state.goToNextIteration)
  const goToLatestIteration = useAppStore(state => state.goToLatestIteration)
  const ralphStatus = useAppStore(selectRalphStatus)
  const isRunning = ralphStatus === "running" || ralphStatus === "starting"
  const containerRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [isAtBottom, setIsAtBottom] = useState(true)

  // Compute iteration-related values with useMemo to avoid infinite loops
  const iterationCount = useMemo(() => countIterations(allEvents), [allEvents])
  const iterationEvents = useMemo(
    () => getEventsForIteration(allEvents, viewingIterationIndex),
    [allEvents, viewingIterationIndex],
  )
  const isViewingLatest = viewingIterationIndex === null

  // Use iteration-filtered events
  const events = iterationEvents

  // Process streaming events
  const { completedEvents, streamingMessage } = useStreamingState(events)

  // Limit displayed events
  const displayedEvents = completedEvents.slice(-maxEvents)

  // Build a map of tool_use_id -> result for matching tool uses with their results
  const toolResults = new Map<string, { output?: string; error?: string }>()
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
  }

  // Check if user is at the bottom of the scroll container
  const checkIsAtBottom = useCallback(() => {
    const container = containerRef.current
    if (!container) return true

    const threshold = 50 // pixels from bottom to consider "at bottom"
    const scrollBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    return scrollBottom <= threshold
  }, [])

  // Handle scroll events
  const handleScroll = useCallback(() => {
    const atBottom = checkIsAtBottom()
    setIsAtBottom(atBottom)

    // Re-enable auto-scroll when user scrolls to bottom
    if (atBottom && !autoScroll) {
      setAutoScroll(true)
    }
  }, [checkIsAtBottom, autoScroll])

  // Handle user interaction (wheel/touch) to detect intentional scrolling
  const handleUserScroll = useCallback(() => {
    const atBottom = checkIsAtBottom()
    // If user scrolls away from bottom, disable auto-scroll
    if (!atBottom) {
      setAutoScroll(false)
    }
  }, [checkIsAtBottom])

  // Auto-scroll to bottom when new events arrive (only when viewing latest)
  useEffect(() => {
    if (autoScroll && isViewingLatest && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [events, autoScroll, isViewingLatest])

  // Scroll to top when navigating to a different iteration
  useEffect(() => {
    if (!isViewingLatest && containerRef.current) {
      containerRef.current.scrollTop = 0
    }
  }, [viewingIterationIndex, isViewingLatest])

  // Scroll to bottom button handler
  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
      setAutoScroll(true)
      setIsAtBottom(true)
    }
  }, [])

  // Calculate displayed iteration number (1-based for UI)
  const displayedIteration =
    viewingIterationIndex !== null ? viewingIterationIndex + 1 : iterationCount
  const showIterationNav = iterationCount > 1

  return (
    <div className={cn("relative flex h-full flex-col", className)}>
      {/* Iteration navigation header */}
      {showIterationNav && (
        <div className="bg-muted/50 border-border flex items-center justify-between border-b px-3 py-1.5">
          <button
            onClick={goToPreviousIteration}
            disabled={viewingIterationIndex === 0}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Previous iteration"
          >
            <IconChevronLeft className="size-4" />
            <span className="hidden sm:inline">Previous</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">
              Iteration {displayedIteration} of {iterationCount}
            </span>
            {!isViewingLatest && (
              <button
                onClick={goToLatestIteration}
                className="bg-primary text-primary-foreground rounded px-2 py-0.5 text-xs font-medium hover:opacity-90"
              >
                Latest
              </button>
            )}
          </div>

          <button
            onClick={goToNextIteration}
            disabled={isViewingLatest}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Next iteration"
          >
            <span className="hidden sm:inline">Next</span>
            <IconChevronRight className="size-4" />
          </button>
        </div>
      )}

      {/* Events container */}
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
              <EventItem
                key={`${event.timestamp}-${index}`}
                event={event}
                toolResults={toolResults}
              />
            ))}
            {streamingMessage && <StreamingContentRenderer message={streamingMessage} />}
            {/* Spinner shown when Ralph is running */}
            {isRunning && (
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

      {/* Scroll to bottom button (shown when not at bottom) */}
      {!isAtBottom && (
        <button
          onClick={scrollToBottom}
          className={cn(
            "bg-primary text-primary-foreground absolute right-4 bottom-4 rounded-full p-2 shadow-lg transition-opacity hover:opacity-90",
            "flex items-center gap-1.5",
          )}
          aria-label="Scroll to latest events"
        >
          <IconChevronDown className="size-4" />
          <span className="pr-1 text-xs font-medium">Latest</span>
        </button>
      )}
    </div>
  )
}
