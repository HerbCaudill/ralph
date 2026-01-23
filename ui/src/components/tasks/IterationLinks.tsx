import { useState, useEffect } from "react"
import { IconHistory, IconClock, IconLoader2 } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { formatEventLogDate } from "@/lib/formatEventLogDate"
import type { EventLogMetadata } from "@/types"

/**
 * Summary of an event log for display in iteration links.
 */
interface EventLogSummary {
  id: string
  createdAt: string
  eventCount: number
  metadata?: EventLogMetadata
}

interface IterationLinksProps {
  /** The task ID to show iteration links for */
  taskId: string
  /** Optional CSS class */
  className?: string
}

/**
 * Displays clickable links to iteration logs associated with a task.
 * Fetches all event logs and filters by task ID.
 */
export function IterationLinks({ taskId, className }: IterationLinksProps) {
  const [iterationLogs, setIterationLogs] = useState<EventLogSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchIterationLogs() {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch("/api/eventlogs")
        const data = (await response.json()) as {
          ok: boolean
          eventlogs?: EventLogSummary[]
          error?: string
        }

        if (data.ok && data.eventlogs) {
          // Filter to only show logs for this task
          const logsForTask = data.eventlogs.filter(log => log.metadata?.taskId === taskId)
          // Sort by date, most recent first
          logsForTask.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )
          setIterationLogs(logsForTask)
        } else {
          setError(data.error ?? "Failed to fetch iteration logs")
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch iteration logs")
      } finally {
        setIsLoading(false)
      }
    }

    fetchIterationLogs()
  }, [taskId])

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

/**
 * Single iteration log item with clickable link.
 */
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
