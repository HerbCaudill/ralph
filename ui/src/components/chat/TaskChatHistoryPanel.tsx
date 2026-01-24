import { useCallback, useState, useMemo } from "react"
import {
  IconHistory,
  IconChevronRight,
  IconClock,
  IconMessage,
  IconSearch,
  IconX,
} from "@tabler/icons-react"
import { cn, stripTaskPrefix } from "@/lib/utils"
import { useTaskChatSessions, type UseTaskChatSessionsResult } from "@/hooks/useTaskChatSessions"
import { useAppStore, selectActiveInstanceId, selectIssuePrefix } from "@/store"
import type { TaskChatSessionMetadata } from "@/lib/persistence"

/**  Groups task chat sessions by date (Today, Yesterday, or specific date). */
function groupSessionsByDate(
  sessions: TaskChatSessionMetadata[],
): Array<{ dateLabel: string; sessions: TaskChatSessionMetadata[] }> {
  const groups = new Map<string, TaskChatSessionMetadata[]>()

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)

  for (const session of sessions) {
    const sessionDate = new Date(session.updatedAt)
    const sessionDay = new Date(
      sessionDate.getFullYear(),
      sessionDate.getMonth(),
      sessionDate.getDate(),
    )

    let dateLabel: string
    if (sessionDay.getTime() === today.getTime()) {
      dateLabel = "Today"
    } else if (sessionDay.getTime() === yesterday.getTime()) {
      dateLabel = "Yesterday"
    } else {
      dateLabel = sessionDay.toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    }

    const existing = groups.get(dateLabel)
    if (existing) {
      existing.push(session)
    } else {
      groups.set(dateLabel, [session])
    }
  }

  // Convert to array (order preserved from original sessions which are sorted newest first)
  return Array.from(groups.entries()).map(([dateLabel, sessions]) => ({ dateLabel, sessions }))
}

/**  Filters task chat sessions by search query (matches task ID or title). */
function filterSessions(
  sessions: TaskChatSessionMetadata[],
  query: string,
): TaskChatSessionMetadata[] {
  const trimmedQuery = query.trim().toLowerCase()
  if (!trimmedQuery) return sessions

  return sessions.filter(session => {
    const taskId = session.taskId?.toLowerCase() ?? ""
    const title = session.taskTitle?.toLowerCase() ?? ""
    return taskId.includes(trimmedQuery) || title.includes(trimmedQuery)
  })
}

/**  Formats a timestamp to show only the time. */
function formatSessionTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Panel for browsing task chat history.
 * Shows a list of past task chat sessions grouped by date with search/filter.
 */
export function TaskChatHistoryPanel({ className, onSelectSession }: TaskChatHistoryPanelProps) {
  const instanceId = useAppStore(selectActiveInstanceId)
  const issuePrefix = useAppStore(selectIssuePrefix)
  const { sessions, isLoading, error, refresh } = useTaskChatSessions({ instanceId })
  const [searchQuery, setSearchQuery] = useState("")

  const filteredSessions = useMemo(
    () => filterSessions(sessions, searchQuery),
    [sessions, searchQuery],
  )

  const groupedSessions = useMemo(() => groupSessionsByDate(filteredSessions), [filteredSessions])

  const handleItemClick = useCallback(
    (id: string) => {
      onSelectSession?.(id)
    },
    [onSelectSession],
  )

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }, [])

  const handleClearSearch = useCallback(() => {
    setSearchQuery("")
  }, [])

  if (isLoading) {
    return (
      <div className={cn("flex h-full flex-col", className)}>
        <div className="border-border flex items-center gap-2 border-b px-4 py-3">
          <IconHistory className="text-muted-foreground size-4" />
          <span className="text-sm font-medium">Chat History</span>
        </div>
        <div className="text-muted-foreground flex flex-1 items-center justify-center">
          <div className="flex items-center gap-2">
            <div className="bg-muted-foreground/30 h-2 w-2 animate-pulse rounded-full" />
            <span className="text-sm">Loading chat sessions...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn("flex h-full flex-col", className)}>
        <div className="border-border flex items-center gap-2 border-b px-4 py-3">
          <IconHistory className="text-muted-foreground size-4" />
          <span className="text-sm font-medium">Chat History</span>
        </div>
        <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
          <span className="text-sm text-red-500">{error}</span>
          <button onClick={refresh} className="text-primary text-sm underline hover:no-underline">
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="border-border flex items-center gap-2 border-b px-4 py-3">
        <IconHistory className="text-muted-foreground size-4" />
        <span className="text-sm font-medium">Chat History</span>
        <span className="text-muted-foreground text-xs">({sessions.length})</span>
      </div>

      {/* Search input */}
      {sessions.length > 0 && (
        <div className="border-border border-b px-4 py-2">
          <div className="relative">
            <div className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2">
              <IconSearch className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search by task ID or title..."
              aria-label="Search chat sessions"
              className={cn(
                "border-border bg-background text-foreground h-8 w-full rounded-md border pr-8 pl-9 text-sm",
                "placeholder:text-muted-foreground",
                "focus:ring-ring focus:ring-2 focus:outline-none",
              )}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
                aria-label="Clear search"
              >
                <IconX className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ?
          <div className="text-muted-foreground flex h-full items-center justify-center px-4 text-center text-sm">
            No chat history yet.
            <br />
            Chat sessions will appear here.
          </div>
        : filteredSessions.length === 0 ?
          <div className="text-muted-foreground flex h-full items-center justify-center px-4 text-center text-sm">
            No matching chat sessions found.
          </div>
        : <div role="list" aria-label="Chat session history">
            {groupedSessions.map(({ dateLabel, sessions }) => (
              <div key={dateLabel} role="group" aria-label={`Sessions from ${dateLabel}`}>
                <div className="bg-muted/30 border-border sticky top-0 border-b px-4 py-2">
                  <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    {dateLabel}
                  </span>
                </div>
                <ul className="divide-border divide-y">
                  {sessions.map(session => (
                    <TaskChatHistoryItem
                      key={session.id}
                      session={session}
                      issuePrefix={issuePrefix}
                      onClick={handleItemClick}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        }
      </div>
    </div>
  )
}

/**  Single item in the task chat history list. */
function TaskChatHistoryItem({
  session,
  issuePrefix,
  onClick,
}: {
  session: TaskChatSessionMetadata
  issuePrefix: string | null
  onClick: (id: string) => void
}) {
  const taskId = session.taskId
  const taskTitle = session.taskTitle

  return (
    <li>
      <button
        className={cn(
          "hover:bg-muted/50 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
          "focus:bg-muted/50 focus:outline-none",
        )}
        onClick={() => onClick(session.id)}
        aria-label={`View chat session from ${new Date(session.updatedAt).toLocaleString()}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {taskId && taskId !== "untitled" && (
              <span className="text-muted-foreground shrink-0 font-mono text-xs">
                {stripTaskPrefix(taskId, issuePrefix)}
              </span>
            )}
            <span className="truncate text-sm font-medium">
              {taskTitle || (taskId && taskId !== "untitled" ? "" : "General chat")}
            </span>
          </div>
          <div className="text-muted-foreground mt-1 flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1">
              <IconClock className="size-3" />
              {formatSessionTime(session.updatedAt)}
            </span>
            <span className="flex items-center gap-1">
              <IconMessage className="size-3" />
              {session.messageCount} messages
            </span>
          </div>
        </div>
        <IconChevronRight className="text-muted-foreground size-4 shrink-0" />
      </button>
    </li>
  )
}

/**  Props for the TaskChatHistoryPanel component */
export interface TaskChatHistoryPanelProps {
  /** Optional CSS class to apply to the container */
  className?: string
  /** Callback when a session is selected */
  onSelectSession?: (sessionId: string) => void
}

// Export the hook result type for testing
export type { UseTaskChatSessionsResult }
