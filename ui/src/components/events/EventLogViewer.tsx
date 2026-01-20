import { cn } from "@/lib/utils"
import {
  useAppStore,
  selectViewingEventLog,
  selectEventLogLoading,
  selectEventLogError,
  type RalphEvent,
} from "@/store"
import { useCallback, useEffect, useRef, useState } from "react"
import { IconChevronDown, IconX, IconHistory, IconCopy, IconCheck } from "@tabler/icons-react"
import { UserMessage, type UserMessageEvent } from "./UserMessage"
import { AssistantText, type AssistantTextEvent } from "./AssistantText"
import { ToolUseCard, type ToolUseEvent } from "./ToolUseCard"
import { useEventLogRouter } from "@/hooks"

// Types

export interface EventLogViewerProps {
  className?: string
}

// Event type guards (same as EventStream)

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

// Format date for display
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// EventLogViewer Component

/**
 * Displays a stored event log for viewing past Ralph sessions.
 * Shows metadata (created date, task ID) and reuses event rendering from EventStream.
 */
export function EventLogViewer({ className }: EventLogViewerProps) {
  const eventLog = useAppStore(selectViewingEventLog)
  const isLoading = useAppStore(selectEventLogLoading)
  const error = useAppStore(selectEventLogError)
  const viewingEventLogId = useAppStore(state => state.viewingEventLogId)
  const { closeEventLogViewer } = useEventLogRouter()

  const containerRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(false) // Start at top for viewing logs
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [copied, setCopied] = useState(false)

  // Get events from event log
  const events = eventLog?.events ?? []

  // Build a map of tool_use_id -> result for matching tool uses with their results
  const toolResults = new Map<string, { output?: string; error?: string }>()
  for (const event of events) {
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

  // Scroll to top when a new event log is loaded
  useEffect(() => {
    if (eventLog && containerRef.current) {
      containerRef.current.scrollTop = 0
      setAutoScroll(false)
    }
  }, [eventLog?.id])

  // Scroll to bottom button handler
  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
      setAutoScroll(true)
      setIsAtBottom(true)
    }
  }, [])

  // Copy link to clipboard
  const handleCopyLink = useCallback(async () => {
    if (!viewingEventLogId) return
    const url = `${window.location.origin}${window.location.pathname}#eventlog=${viewingEventLogId}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for browsers without clipboard API
      console.error("Failed to copy to clipboard")
    }
  }, [viewingEventLogId])

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("flex h-full flex-col", className)}>
        <div className="border-border flex items-center justify-between border-b px-4 py-2">
          <div className="flex items-center gap-2">
            <IconHistory className="text-muted-foreground size-4" />
            <span className="text-sm font-medium">Event Log</span>
          </div>
          <button
            onClick={closeEventLogViewer}
            className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors"
            aria-label="Close event log viewer"
          >
            <IconX className="size-4" />
          </button>
        </div>
        <div className="text-muted-foreground flex flex-1 items-center justify-center">
          <div className="flex items-center gap-2">
            <div className="bg-muted-foreground/30 h-2 w-2 animate-pulse rounded-full" />
            <span className="text-sm">Loading event log...</span>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className={cn("flex h-full flex-col", className)}>
        <div className="border-border flex items-center justify-between border-b px-4 py-2">
          <div className="flex items-center gap-2">
            <IconHistory className="text-muted-foreground size-4" />
            <span className="text-sm font-medium">Event Log</span>
          </div>
          <button
            onClick={closeEventLogViewer}
            className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors"
            aria-label="Close event log viewer"
          >
            <IconX className="size-4" />
          </button>
        </div>
        <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
          <span className="text-sm text-red-500">{error}</span>
          <button
            onClick={closeEventLogViewer}
            className="text-primary text-sm underline hover:no-underline"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  // No event log loaded
  if (!eventLog) {
    return null
  }

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Header */}
      <div className="border-border flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <IconHistory className="text-muted-foreground size-4" />
          <span className="text-sm font-medium">Event Log</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopyLink}
            className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors"
            aria-label={copied ? "Link copied!" : "Copy link to event log"}
            title={copied ? "Link copied!" : "Copy link"}
          >
            {copied ?
              <IconCheck className="size-4 text-green-500" />
            : <IconCopy className="size-4" />}
          </button>
          <button
            onClick={closeEventLogViewer}
            className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors"
            aria-label="Close event log viewer"
            title="Close"
          >
            <IconX className="size-4" />
          </button>
        </div>
      </div>

      {/* Metadata */}
      <div className="border-border border-b px-4 py-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span className="text-muted-foreground">
            Created: <span className="text-foreground">{formatDate(eventLog.createdAt)}</span>
          </span>
          {eventLog.metadata?.taskId && (
            <span className="text-muted-foreground">
              Task: <span className="text-foreground font-mono">{eventLog.metadata.taskId}</span>
            </span>
          )}
          {eventLog.metadata?.title && (
            <span className="text-muted-foreground truncate">
              Title: <span className="text-foreground">{eventLog.metadata.title}</span>
            </span>
          )}
        </div>
      </div>

      {/* Events container */}
      <div className="relative flex-1 overflow-hidden">
        <div
          ref={containerRef}
          onScroll={handleScroll}
          onWheel={handleUserScroll}
          onTouchMove={handleUserScroll}
          className="bg-background h-full overflow-y-auto py-2"
          role="log"
          aria-label="Event log"
        >
          {events.length === 0 ?
            <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
              No events in this log
            </div>
          : events.map((event, index) => (
              <EventItem
                key={`${event.timestamp}-${index}`}
                event={event}
                toolResults={toolResults}
              />
            ))
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
            aria-label="Scroll to end of log"
          >
            <IconChevronDown className="size-4" />
            <span className="pr-1 text-xs font-medium">End</span>
          </button>
        )}
      </div>
    </div>
  )
}
