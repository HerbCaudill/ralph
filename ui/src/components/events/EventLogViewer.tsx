import { useCallback, useEffect, useRef, useState } from "react"
import { IconChevronDown, IconX, IconHistory, IconCopy, IconCheck } from "@tabler/icons-react"
import { cn, stripTaskPrefix } from "@/lib/utils"
import {
  useAppStore,
  selectViewingEventLog,
  selectEventLogLoading,
  selectEventLogError,
  selectIssuePrefix,
} from "@/store"
import { useEventLogRouter } from "@/hooks"
import { formatEventLogDate } from "@/lib/formatEventLogDate"
import { isToolResultEvent } from "@/lib/isToolResultEvent"
import { EventLogViewerEventItem } from "./EventLogViewerEventItem"

/**
 * Displays a stored event log for viewing past Ralph sessions.
 * Shows metadata (created date, task ID) and reuses event rendering from EventStream.
 */
export function EventLogViewer({ className }: EventLogViewerProps) {
  const eventLog = useAppStore(selectViewingEventLog)
  const isLoading = useAppStore(selectEventLogLoading)
  const error = useAppStore(selectEventLogError)
  const viewingEventLogId = useAppStore(state => state.viewingEventLogId)
  const issuePrefix = useAppStore(selectIssuePrefix)
  const { closeEventLogViewer } = useEventLogRouter()

  const containerRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(false)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [copied, setCopied] = useState(false)

  const events = eventLog?.events ?? []

  /**
   * Build a map of tool results from the event log for rendering.
   * Extracts tool_result items from message content and indexes by tool_use_id.
   */
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

  /**
   * Check if the scroll container is at the bottom within a threshold.
   */
  const checkIsAtBottom = useCallback(() => {
    const container = containerRef.current
    if (!container) return true

    const threshold = 50
    const scrollBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    return scrollBottom <= threshold
  }, [])

  /**
   * Handle scroll events to update auto-scroll state when container scrolls.
   */
  const handleScroll = useCallback(() => {
    const atBottom = checkIsAtBottom()
    setIsAtBottom(atBottom)

    if (atBottom && !autoScroll) {
      setAutoScroll(true)
    }
  }, [checkIsAtBottom, autoScroll])

  /**
   * Handle user scroll events (wheel/touch) to disable auto-scroll if user scrolls away from bottom.
   */
  const handleUserScroll = useCallback(() => {
    const atBottom = checkIsAtBottom()
    if (!atBottom) {
      setAutoScroll(false)
    }
  }, [checkIsAtBottom])

  useEffect(() => {
    if (eventLog && containerRef.current) {
      containerRef.current.scrollTop = 0
      setAutoScroll(false)
    }
  }, [eventLog?.id])

  /**
   * Scroll the container to the bottom and enable auto-scroll.
   */
  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
      setAutoScroll(true)
      setIsAtBottom(true)
    }
  }, [])

  /**
   * Copy the shareable event log URL to clipboard.
   */
  const handleCopyLink = useCallback(async () => {
    if (!viewingEventLogId) return
    const url = `${window.location.origin}${window.location.pathname}#eventlog=${viewingEventLogId}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      console.error("Failed to copy to clipboard")
    }
  }, [viewingEventLogId])

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

  if (!eventLog) {
    return null
  }

  return (
    <div className={cn("flex h-full flex-col", className)}>
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

      <div className="border-border border-b px-4 py-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span className="text-muted-foreground">
            Created:{" "}
            <span className="text-foreground">{formatEventLogDate(eventLog.createdAt)}</span>
          </span>
          {eventLog.metadata?.taskId && (
            <span className="text-muted-foreground">
              Task:{" "}
              <span className="text-foreground font-mono">
                {stripTaskPrefix(eventLog.metadata.taskId, issuePrefix)}
              </span>
            </span>
          )}
          {eventLog.metadata?.title && (
            <span className="text-muted-foreground truncate">
              Title: <span className="text-foreground">{eventLog.metadata.title}</span>
            </span>
          )}
        </div>
      </div>

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
          <div className="mx-auto max-w-4xl">
            {events.length === 0 ?
              <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                No events in this log
              </div>
            : events.map((event, index) => (
                <EventLogViewerEventItem
                  key={`${event.timestamp}-${index}`}
                  event={event}
                  toolResults={toolResults}
                />
              ))
            }
          </div>
        </div>

        {!isAtBottom && (
          <button
            onClick={scrollToBottom}
            className={cn(
              "bg-repo-accent text-repo-accent-foreground absolute right-4 bottom-4 rounded-full p-2 shadow-lg transition-opacity hover:opacity-90",
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

/**  Props for the EventLogViewer component */
export type EventLogViewerProps = {
  /** Optional CSS class to apply to the container */
  className?: string
}
