import { useCallback, useState, useMemo } from "react"
import {
  IconHistory,
  IconChevronRight,
  IconClock,
  IconFile,
  IconSearch,
  IconX,
} from "@tabler/icons-react"
import { cn, stripTaskPrefix } from "@/lib/utils"
import { useSessions, buildSessionPath, type SessionSummary } from "@/hooks"
import { formatEventLogDate, formatEventLogTime } from "@/lib/formatEventLogDate"
import { useAppStore, selectIssuePrefix, selectWorkspace } from "@/store"

/** Groups sessions by date (Today, Yesterday, or specific date). */
function groupSessionsByDate(
  sessions: SessionSummary[],
): Array<{ dateLabel: string; logs: SessionSummary[] }> {
  const groups = new Map<string, SessionSummary[]>()

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)

  for (const log of sessions) {
    const logDate = new Date(log.createdAt)
    const logDay = new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate())

    let dateLabel: string
    if (logDay.getTime() === today.getTime()) {
      dateLabel = "Today"
    } else if (logDay.getTime() === yesterday.getTime()) {
      dateLabel = "Yesterday"
    } else {
      dateLabel = logDay.toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    }

    const existing = groups.get(dateLabel)
    if (existing) {
      existing.push(log)
    } else {
      groups.set(dateLabel, [log])
    }
  }

  // Convert to array (order preserved from original sessions which are sorted newest first)
  return Array.from(groups.entries()).map(([dateLabel, logs]) => ({ dateLabel, logs }))
}

/** Filters sessions by search query (matches task ID or title). */
function filterSessions(sessions: SessionSummary[], query: string): SessionSummary[] {
  const trimmedQuery = query.trim().toLowerCase()
  if (!trimmedQuery) return sessions

  return sessions.filter(log => {
    const taskId = log.metadata?.taskId?.toLowerCase() ?? ""
    const title = log.metadata?.title?.toLowerCase() ?? ""
    return taskId.includes(trimmedQuery) || title.includes(trimmedQuery)
  })
}

/**
 * Panel for browsing session history.
 * Shows a list of all past sessions grouped by date with search/filter.
 * This is a thin wrapper that fetches data and delegates to SessionHistoryPanelView.
 */
export function SessionHistoryPanel({ className }: SessionHistoryPanelProps) {
  const workspaceId = useAppStore(selectWorkspace)
  const { sessions, isLoading, error, refresh, loadSessionEvents } = useSessions({
    workspaceId: workspaceId ?? undefined,
  })
  const issuePrefix = useAppStore(selectIssuePrefix)

  const handleSessionClick = useCallback(
    (id: string) => {
      // Update URL and load session data
      window.history.pushState({ sessionId: id }, "", buildSessionPath(id))
      loadSessionEvents(id)
    },
    [loadSessionEvents],
  )

  return (
    <SessionHistoryPanelView
      className={className}
      sessions={sessions}
      isLoading={isLoading}
      error={error}
      issuePrefix={issuePrefix}
      onItemClick={handleSessionClick}
      onRetry={refresh}
    />
  )
}

/**
 * Presentational component for the session history panel.
 * Receives all data as props, making it easy to test in Storybook.
 */
export function SessionHistoryPanelView({
  className,
  sessions,
  isLoading,
  error,
  issuePrefix,
  onItemClick,
  onRetry,
}: SessionHistoryPanelViewProps) {
  const [searchQuery, setSearchQuery] = useState("")

  const filteredLogs = useMemo(() => filterSessions(sessions, searchQuery), [sessions, searchQuery])

  const groupedLogs = useMemo(() => groupSessionsByDate(filteredLogs), [filteredLogs])

  const handleItemClick = useCallback(
    (id: string) => {
      onItemClick?.(id)
    },
    [onItemClick],
  )

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }, [])

  const handleClearSearch = useCallback(() => {
    setSearchQuery("")
  }, [])

  if (isLoading) {
    return (
      <div className={cn("flex h-full flex-col", className)} data-testid="session-history-panel">
        <div className="border-border flex items-center gap-2 border-b px-4 py-3">
          <IconHistory className="text-muted-foreground size-4" />
          <span className="text-sm font-medium">Session History</span>
        </div>
        <div
          className="text-muted-foreground flex flex-1 items-center justify-center"
          data-testid="loading-state"
        >
          <div className="flex items-center gap-2">
            <div className="bg-muted-foreground/30 h-2 w-2 animate-pulse rounded-full" />
            <span className="text-sm">Loading sessions...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn("flex h-full flex-col", className)} data-testid="session-history-panel">
        <div className="border-border flex items-center gap-2 border-b px-4 py-3">
          <IconHistory className="text-muted-foreground size-4" />
          <span className="text-sm font-medium">Session History</span>
        </div>
        <div
          className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center"
          data-testid="error-state"
        >
          <span className="text-sm text-red-500">{error}</span>
          <button
            onClick={onRetry}
            className="text-primary text-sm underline hover:no-underline"
            data-testid="retry-button"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex h-full flex-col", className)} data-testid="session-history-panel">
      <div className="border-border flex items-center gap-2 border-b px-4 py-3">
        <IconHistory className="text-muted-foreground size-4" />
        <span className="text-sm font-medium">Session History</span>
        <span className="text-muted-foreground text-xs" data-testid="session-count">
          ({sessions.length})
        </span>
      </div>

      {/* Main content area with floating search input */}
      <div className="relative min-h-0 flex-1">
        {/* Floating search input */}
        {sessions.length > 0 && (
          <div className="bg-background/95 absolute inset-x-0 top-0 z-10 px-4 py-2 backdrop-blur-sm">
            <div className="relative">
              <div className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2">
                <IconSearch className="h-4 w-4" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search by task ID or title..."
                aria-label="Search sessions"
                data-testid="search-input"
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
                  data-testid="clear-search-button"
                >
                  <IconX className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Session list with top padding to account for floating search */}
        <div className={cn("h-full overflow-y-auto", sessions.length > 0 && "pt-[48px]")}>
          {sessions.length === 0 ?
            <div
              className="text-muted-foreground flex h-full items-center justify-center px-4 text-center text-sm"
              data-testid="empty-state"
            >
              No session history yet.
              <br />
              Completed sessions will appear here.
            </div>
          : filteredLogs.length === 0 ?
            <div
              className="text-muted-foreground flex h-full items-center justify-center px-4 text-center text-sm"
              data-testid="no-results"
            >
              No matching sessions found.
            </div>
          : <div role="list" aria-label="Session history" data-testid="session-list">
              {groupedLogs.map(({ dateLabel, logs }) => (
                <div
                  key={dateLabel}
                  role="group"
                  aria-label={`Sessions from ${dateLabel}`}
                  data-testid="date-group"
                >
                  <div className="bg-muted/30 border-border sticky top-0 border-b px-4 py-2">
                    <span
                      className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
                      data-testid="date-label"
                    >
                      {dateLabel}
                    </span>
                  </div>
                  <ul className="divide-border divide-y">
                    {logs.map(log => (
                      <SessionHistoryItem
                        key={log.id}
                        log={log}
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
    </div>
  )
}

/** Single item in the session history list. */
function SessionHistoryItem({
  log,
  issuePrefix,
  onClick,
}: {
  log: SessionSummary
  issuePrefix: string | null
  onClick: (id: string) => void
}) {
  const taskId = log.metadata?.taskId
  const taskTitle = log.metadata?.title

  return (
    <li data-testid="session-item">
      <button
        className={cn(
          "hover:bg-muted/50 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
          "focus:bg-muted/50 focus:outline-none",
        )}
        onClick={() => onClick(log.id)}
        aria-label={`View session from ${formatEventLogDate(log.createdAt)}`}
        data-testid="session-item-button"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {taskId && (
              <span className="text-muted-foreground shrink-0 font-mono text-xs">
                {stripTaskPrefix(taskId, issuePrefix)}
              </span>
            )}
            <span className="truncate text-sm font-medium">
              {taskTitle || (taskId ? "" : "No task")}
            </span>
          </div>
          <div className="text-muted-foreground mt-1 flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1">
              <IconClock className="size-3" />
              {formatEventLogTime(log.createdAt)}
            </span>
            <span className="flex items-center gap-1" data-testid="event-count">
              <IconFile className="size-3" />
              {log.eventCount} events
            </span>
          </div>
        </div>
        <IconChevronRight className="text-muted-foreground size-4 shrink-0" />
      </button>
    </li>
  )
}

/** Props for the SessionHistoryPanel component */
export interface SessionHistoryPanelProps {
  /** Optional CSS class to apply to the container */
  className?: string
}

/** Props for the SessionHistoryPanelView presentational component */
export interface SessionHistoryPanelViewProps {
  /** Optional CSS class to apply to the container */
  className?: string
  /** Sessions to display */
  sessions: SessionSummary[]
  /** Whether data is loading */
  isLoading: boolean
  /** Error message if loading failed */
  error: string | null
  /** Issue prefix for stripping from task IDs */
  issuePrefix: string | null
  /** Callback when an session item is clicked */
  onItemClick?: (id: string) => void
  /** Callback when retry button is clicked */
  onRetry?: () => void
}
