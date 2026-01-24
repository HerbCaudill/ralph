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
import { useEventLogs, useEventLogRouter, type EventLogSummary } from "@/hooks"
import { formatEventLogDate, formatEventLogTime } from "@/lib/formatEventLogDate"
import { useAppStore, selectIssuePrefix } from "@/store"

/**  Groups event logs by date (Today, Yesterday, or specific date). */
function groupEventLogsByDate(
  eventLogs: EventLogSummary[],
): Array<{ dateLabel: string; logs: EventLogSummary[] }> {
  const groups = new Map<string, EventLogSummary[]>()

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)

  for (const log of eventLogs) {
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

  // Convert to array (order preserved from original eventLogs which are sorted newest first)
  return Array.from(groups.entries()).map(([dateLabel, logs]) => ({ dateLabel, logs }))
}

/**  Filters event logs by search query (matches task ID or title). */
function filterEventLogs(eventLogs: EventLogSummary[], query: string): EventLogSummary[] {
  const trimmedQuery = query.trim().toLowerCase()
  if (!trimmedQuery) return eventLogs

  return eventLogs.filter(log => {
    const taskId = log.metadata?.taskId?.toLowerCase() ?? ""
    const title = log.metadata?.title?.toLowerCase() ?? ""
    return taskId.includes(trimmedQuery) || title.includes(trimmedQuery)
  })
}

/**
 * Panel for browsing iteration history.
 * Shows a list of all past iterations grouped by date with search/filter.
 */
export function IterationHistoryPanel({ className }: IterationHistoryPanelProps) {
  const { eventLogs, isLoading, error, refresh } = useEventLogs()
  const { navigateToEventLog } = useEventLogRouter()
  const issuePrefix = useAppStore(selectIssuePrefix)
  const [searchQuery, setSearchQuery] = useState("")

  const filteredLogs = useMemo(
    () => filterEventLogs(eventLogs, searchQuery),
    [eventLogs, searchQuery],
  )

  const groupedLogs = useMemo(() => groupEventLogsByDate(filteredLogs), [filteredLogs])

  const handleItemClick = useCallback(
    (id: string) => {
      navigateToEventLog(id)
    },
    [navigateToEventLog],
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
          <span className="text-sm font-medium">Iteration History</span>
        </div>
        <div className="text-muted-foreground flex flex-1 items-center justify-center">
          <div className="flex items-center gap-2">
            <div className="bg-muted-foreground/30 h-2 w-2 animate-pulse rounded-full" />
            <span className="text-sm">Loading iterations...</span>
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
          <span className="text-sm font-medium">Iteration History</span>
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
        <span className="text-sm font-medium">Iteration History</span>
        <span className="text-muted-foreground text-xs">({eventLogs.length})</span>
      </div>

      {/* Search input */}
      {eventLogs.length > 0 && (
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
              aria-label="Search iterations"
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
        {eventLogs.length === 0 ?
          <div className="text-muted-foreground flex h-full items-center justify-center px-4 text-center text-sm">
            No iteration history yet.
            <br />
            Completed iterations will appear here.
          </div>
        : filteredLogs.length === 0 ?
          <div className="text-muted-foreground flex h-full items-center justify-center px-4 text-center text-sm">
            No matching iterations found.
          </div>
        : <div role="list" aria-label="Iteration history">
            {groupedLogs.map(({ dateLabel, logs }) => (
              <div key={dateLabel} role="group" aria-label={`Iterations from ${dateLabel}`}>
                <div className="bg-muted/30 border-border sticky top-0 border-b px-4 py-2">
                  <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    {dateLabel}
                  </span>
                </div>
                <ul className="divide-border divide-y">
                  {logs.map(log => (
                    <IterationHistoryItem
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
  )
}

/**  Single item in the iteration history list. */
function IterationHistoryItem({
  log,
  issuePrefix,
  onClick,
}: {
  log: EventLogSummary
  issuePrefix: string | null
  onClick: (id: string) => void
}) {
  const taskId = log.metadata?.taskId
  const taskTitle = log.metadata?.title

  return (
    <li>
      <button
        className={cn(
          "hover:bg-muted/50 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
          "focus:bg-muted/50 focus:outline-none",
        )}
        onClick={() => onClick(log.id)}
        aria-label={`View iteration from ${formatEventLogDate(log.createdAt)}`}
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
            <span className="flex items-center gap-1">
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

/**  Props for the IterationHistoryPanel component */
export interface IterationHistoryPanelProps {
  /** Optional CSS class to apply to the container */
  className?: string
}
