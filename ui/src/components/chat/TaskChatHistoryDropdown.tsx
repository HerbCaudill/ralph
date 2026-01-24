import { useState, useMemo, useCallback } from "react"
import { IconHistory, IconClock, IconMessage } from "@tabler/icons-react"
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
import { useTaskChatSessions } from "@/hooks/useTaskChatSessions"
import { useAppStore, selectActiveInstanceId, selectIssuePrefix } from "@/store"
import type { TaskChatSessionMetadata } from "@/lib/persistence"

/** Groups task chat sessions by date (Today, Yesterday, or specific date). */
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
        weekday: "short",
        month: "short",
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

  return Array.from(groups.entries()).map(([dateLabel, sessions]) => ({ dateLabel, sessions }))
}

/** Formats a timestamp to show only the time. */
function formatSessionTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Dropdown button for viewing and selecting task chat history sessions.
 * Replaces the sheet-based TaskChatHistorySheet with a compact dropdown menu.
 */
export function TaskChatHistoryDropdown({
  className,
  onSelectSession,
}: TaskChatHistoryDropdownProps) {
  const [open, setOpen] = useState(false)
  const instanceId = useAppStore(selectActiveInstanceId)
  const issuePrefix = useAppStore(selectIssuePrefix)
  const { sessions, isLoading, error } = useTaskChatSessions({ instanceId })

  const groupedSessions = useMemo(() => groupSessionsByDate(sessions), [sessions])

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      onSelectSession?.(sessionId)
      setOpen(false)
    },
    [onSelectSession],
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "text-muted-foreground hover:text-foreground rounded p-1 transition-colors",
            className,
          )}
          aria-label="View chat history"
          title="Chat history"
          data-testid="task-chat-history-dropdown-trigger"
        >
          <IconHistory className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <Command>
          <CommandInput placeholder="Search chat sessions..." />
          <CommandList>
            <CommandEmpty>
              {isLoading ?
                "Loading..."
              : error ?
                error
              : "No chat sessions found."}
            </CommandEmpty>

            {!isLoading &&
              !error &&
              groupedSessions.map(({ dateLabel, sessions }) => (
                <CommandGroup key={dateLabel} heading={dateLabel}>
                  {sessions.map(session => (
                    <CommandItem
                      key={session.id}
                      value={`${session.taskId || ""} ${session.taskTitle || ""} ${session.id}`}
                      onSelect={() => handleSelectSession(session.id)}
                      className="flex items-center gap-2"
                    >
                      <IconHistory className="text-muted-foreground size-4 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {session.taskId && session.taskId !== "untitled" && (
                            <span className="text-muted-foreground shrink-0 font-mono text-xs">
                              {stripTaskPrefix(session.taskId, issuePrefix)}
                            </span>
                          )}
                          <span className="truncate text-sm">
                            {session.taskTitle ||
                              (session.taskId && session.taskId !== "untitled" ?
                                ""
                              : "General chat")}
                          </span>
                        </div>
                        <div className="text-muted-foreground flex items-center gap-2 text-xs">
                          <span className="flex items-center gap-0.5">
                            <IconClock className="size-3" />
                            {formatSessionTime(session.updatedAt)}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <IconMessage className="size-3" />
                            {session.messageCount}
                          </span>
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export interface TaskChatHistoryDropdownProps {
  /** Optional CSS class to apply to the trigger button */
  className?: string
  /** Callback when a session is selected */
  onSelectSession?: (sessionId: string) => void
}
