import { useState, useMemo, useCallback } from "react"
import { IconChevronDown, IconHistory, IconClock, IconFile } from "@tabler/icons-react"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn, stripTaskPrefix } from "@/lib/utils"
import { formatEventLogTime } from "@/lib/formatEventLogDate"
import type { SessionSummary } from "@/hooks"

/**
 * Dropdown for selecting sessions from persisted history.
 * Shows current task info as the trigger, with a searchable list of past sessions.
 */
export function SessionHistoryDropdown({
  currentTask,
  sessions,
  isLoadingSessions,
  issuePrefix,
  isRunning,
  onSessionHistorySelect,
}: SessionHistoryDropdownProps) {
  const [open, setOpen] = useState(false)

  // Group sessions by date (Today, Yesterday, or specific date)
  const groupedSessions = useMemo(() => {
    if (!sessions.length) return []

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
          weekday: "short",
          month: "short",
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

    return Array.from(groups.entries()).map(([dateLabel, logs]) => ({ dateLabel, logs }))
  }, [sessions])

  const handleSessionHistorySelect = useCallback(
    (id: string) => {
      onSessionHistorySelect(id)
      setOpen(false)
    },
    [onSessionHistorySelect],
  )

  // Build the trigger label
  const triggerLabel = useMemo(() => {
    if (currentTask) {
      return {
        id: currentTask.id,
        title: currentTask.title,
      }
    }
    return {
      id: null,
      title: isRunning ? "Choosing a task..." : "No active task",
    }
  }, [currentTask, isRunning])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "text-muted-foreground hover:text-foreground flex min-w-0 items-center gap-1.5 text-xs transition-colors",
            "focus:ring-ring rounded focus:ring-1 focus:outline-none",
          )}
          title="View session history"
          aria-label="View session history"
          data-testid="session-history-dropdown-trigger"
        >
          {triggerLabel.id && (
            <span className="shrink-0 font-mono opacity-70">
              {stripTaskPrefix(triggerLabel.id, issuePrefix)}
            </span>
          )}
          <span className="truncate">{triggerLabel.title}</span>
          <IconChevronDown className="size-3 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="center">
        <Command>
          <CommandInput placeholder="Search sessions..." />
          <CommandList>
            <CommandEmpty>No sessions found.</CommandEmpty>

            {/* Sessions grouped by date */}
            {isLoadingSessions ?
              <div className="text-muted-foreground flex items-center justify-center py-4 text-sm">
                Loading history...
              </div>
            : groupedSessions.length > 0 ?
              groupedSessions.map(({ dateLabel, logs }) => (
                <CommandGroup key={dateLabel} heading={dateLabel}>
                  {logs.map(log => (
                    <CommandItem
                      key={log.id}
                      value={`${log.metadata?.taskId || ""} ${log.metadata?.title || ""} ${log.id}`}
                      onSelect={() => handleSessionHistorySelect(log.id)}
                      className="flex items-center gap-2"
                    >
                      <IconHistory className="text-muted-foreground size-4 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {log.metadata?.taskId && (
                            <span className="text-muted-foreground shrink-0 font-mono text-xs">
                              {stripTaskPrefix(log.metadata.taskId, issuePrefix)}
                            </span>
                          )}
                          <span className="truncate text-sm">
                            {log.metadata?.title || (log.metadata?.taskId ? "" : "No task")}
                          </span>
                        </div>
                        <div className="text-muted-foreground flex items-center gap-2 text-xs">
                          <span className="flex items-center gap-0.5">
                            <IconClock className="size-3" />
                            {formatEventLogTime(log.createdAt)}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <IconFile className="size-3" />
                            {log.eventCount}
                          </span>
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))
            : <div className="text-muted-foreground py-4 text-center text-sm">
                No session history yet.
              </div>
            }
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export interface SessionHistoryDropdownProps {
  /** Current task info (from session events) */
  currentTask: { id: string | null; title: string } | null
  /** List of past session summaries */
  sessions: SessionSummary[]
  /** Whether sessions are loading */
  isLoadingSessions: boolean
  /** Issue prefix for stripping from task IDs */
  issuePrefix: string | null
  /** Whether Ralph is currently running */
  isRunning: boolean
  /** Callback when selecting a past session from history */
  onSessionHistorySelect: (id: string) => void
}
