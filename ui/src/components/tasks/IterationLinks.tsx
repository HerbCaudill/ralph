import { useMemo } from "react"
import { IconHistory, IconClock, IconLoader2 } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { formatEventLogDate } from "@/lib/formatEventLogDate"
import { useEventLogs, type EventLogSummary } from "@/hooks/useEventLogs"

interface IterationLinksProps {
  /** The task ID to show iteration links for */
  taskId: string
  /** Optional CSS class */
  className?: string
}

/**
 * Displays clickable links to iteration logs associated with a task.
 * Fetches event logs from IndexedDB filtered by task ID.
 */
export function IterationLinks({ taskId, className }: IterationLinksProps) {
  const { eventLogs, isLoading, error } = useEventLogs({ taskId })

  // Sort by date, most recent first
  const iterationLogs = useMemo(() => {
    return [...eventLogs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  }, [eventLogs])

  // Don't render if loading and no logs found yet
  if (isLoading) {
    return (
      <div className={cn("grid gap-2", className)}>
        <Label className="flex items-center gap-1.5">
          <IconHistory className="size-3.5" />
          Iterations
        </Label>
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <IconLoader2 className="size-3 animate-spin" />
          Loading...
        </div>
      </div>
    )
  }

  // Don't render section if there's an error
  if (error) {
    return null
  }

  // Don't render section if no iteration logs
  if (iterationLogs.length === 0) {
    return null
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <Label className="flex items-center gap-1.5">
        <IconHistory className="size-3.5" />
        Iterations
      </Label>
      <div className="space-y-1.5">
        {iterationLogs.map(log => (
          <IterationLogItem key={log.id} log={log} />
        ))}
      </div>
    </div>
  )
}

/**  Single iteration log item with clickable link. */
function IterationLogItem({ log }: { log: EventLogSummary }) {
  const handleClick = () => {
    // Navigate using hash - the useEventLogRouter hook will handle the rest
    window.location.hash = `eventlog=${log.id}`
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        "hover:bg-muted/50 flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors",
        "focus:bg-muted/50 focus:outline-none",
      )}
      aria-label={`View iteration from ${formatEventLogDate(log.createdAt)}`}
      type="button"
    >
      <div className="min-w-0 flex-1">
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1">
            <IconClock className="size-3" />
            {formatEventLogDate(log.createdAt)}
          </span>
          <span className="text-muted-foreground/70">·</span>
          <span>{log.eventCount} events</span>
        </div>
      </div>
    </button>
  )
}
