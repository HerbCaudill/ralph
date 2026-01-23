import { useCallback } from "react"
import { IconHistory, IconChevronRight, IconClock, IconFile } from "@tabler/icons-react"
import { cn, stripTaskPrefix } from "@/lib/utils"
import { useEventLogs, useEventLogRouter, type EventLogSummary } from "@/hooks"
import { formatEventLogDate } from "@/lib/formatEventLogDate"
import { useAppStore, selectIssuePrefix } from "@/store"

/**
 * Panel for browsing iteration history.
 * Shows a list of all past iterations with their metadata.
 */
export function IterationHistoryPanel({ className }: IterationHistoryPanelProps) {
  const { eventLogs, isLoading, error, refresh } = useEventLogs()
  const { navigateToEventLog } = useEventLogRouter()
  const issuePrefix = useAppStore(selectIssuePrefix)

  const handleItemClick = useCallback(
    (id: string) => {
      navigateToEventLog(id)
    },
    [navigateToEventLog],
  )

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

      <div className="flex-1 overflow-y-auto">
        {eventLogs.length === 0 ?
          <div className="text-muted-foreground flex h-full items-center justify-center px-4 text-center text-sm">
            No iteration history yet.
            <br />
            Completed iterations will appear here.
          </div>
        : <ul className="divide-border divide-y" role="list" aria-label="Iteration history">
            {eventLogs.map(log => (
              <IterationHistoryItem
                key={log.id}
                log={log}
                issuePrefix={issuePrefix}
                onClick={handleItemClick}
              />
            ))}
          </ul>
        }
      </div>
    </div>
  )
}

/**
 * Single item in the iteration history list.
 */
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
              {formatEventLogDate(log.createdAt)}
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

/**
 * Props for the IterationHistoryPanel component
 */
export interface IterationHistoryPanelProps {
  /** Optional CSS class to apply to the container */
  className?: string
}
