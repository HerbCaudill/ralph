import { useState, useMemo, useCallback } from "react"
import { IconChevronDown, IconLoader2, IconCheck } from "@tabler/icons-react"
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
  currentSessionId,
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
            "text-muted-foreground flex w-full max-w-[36rem] min-w-0 items-center gap-1.5 text-xs transition-colors",
            "hover:bg-muted rounded px-1.5 py-0.5",
            "focus:ring-ring focus:ring-1 focus:outline-none",
          )}
          title="View session history"
          aria-label="View session history"
          data-testid="session-history-dropdown-trigger"
        >
          {isRunning && (
            <IconLoader2
              className="size-3 shrink-0 animate-spin"
              data-testid="session-running-spinner"
            />
          )}
          {triggerLabel.id && (
            <span className="shrink-0 font-mono opacity-70">
              {stripTaskPrefix(triggerLabel.id, issuePrefix)}
            </span>
          )}
          <span className="truncate">{triggerLabel.title}</span>
          <IconChevronDown className="size-3 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[36rem] max-w-[90vw] p-0" align="center">
        <Command>
          {sessions.length >= 5 && <CommandInput placeholder="Search sessions..." />}
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
                  {logs.map((log, index) => {
                    const isCurrentSession = currentSessionId === log.id
                    // First session in "Today" group is the running session when isRunning
                    const isRunningSession = isRunning && dateLabel === "Today" && index === 0
                    return (
                      <CommandItem
                        key={log.id}
                        value={`${log.metadata?.taskId || ""} ${log.metadata?.title || ""} ${log.id}`}
                        onSelect={() => handleSessionHistorySelect(log.id)}
                        className={cn(
                          "flex items-center gap-2 text-xs",
                          // Override cmdk's default selection color to use muted for hover/keyboard navigation
                          "data-[selected=true]:bg-muted data-[selected=true]:text-foreground",
                          // Only use repo-accent for the currently viewed session
                          isCurrentSession && "bg-repo-accent/50",
                        )}
                      >
                        {isRunningSession && (
                          <IconLoader2
                            className="text-muted-foreground size-3 shrink-0 animate-spin"
                            data-testid="session-item-running-spinner"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {log.metadata?.taskId && (
                              <span className="text-muted-foreground shrink-0 font-mono">
                                {stripTaskPrefix(log.metadata.taskId, issuePrefix)}
                              </span>
                            )}
                            <span className="truncate">
                              {log.metadata?.title || (log.metadata?.taskId ? "" : "No task")}
                            </span>
                          </div>
                        </div>
                        {isCurrentSession && (
                          <IconCheck
                            className="text-primary size-3 shrink-0"
                            data-testid="session-selected-check"
                          />
                        )}
                      </CommandItem>
                    )
                  })}
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
  /** ID of the currently viewed/displayed session (for highlighting) */
  currentSessionId?: string | null
  /** Callback when selecting a past session from history */
  onSessionHistorySelect: (id: string) => void
}
