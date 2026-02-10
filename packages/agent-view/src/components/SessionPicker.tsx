import { useState, useCallback } from "react"
import { IconHistory, IconCheck, IconChevronDown } from "@tabler/icons-react"
import { Button, Popover, PopoverTrigger, PopoverContent } from "@herbcaudill/components"
import type { SessionIndexEntry } from "../lib/sessionIndex"
import { formatRelativeTime } from "../lib/formatRelativeTime"

/**
 * A popover/dropdown that displays past sessions from the session index.
 * Each row shows the first user message text and a relative timestamp.
 * Clicking a row restores that session.
 *
 * When taskId is provided, the trigger button displays the task ID and title
 * instead of just the history icon, allowing users to see the current task at a glance.
 */
export function SessionPicker({
  sessions,
  currentSessionId,
  onSelectSession,
  disabled = false,
  taskId,
  taskTitle,
}: SessionPickerProps) {
  const [open, setOpen] = useState(false)

  const handleSelect = useCallback(
    (sessionId: string) => {
      onSelectSession(sessionId)
      setOpen(false)
    },
    [onSelectSession],
  )

  const hasSessions = sessions.length > 0
  const hasTaskInfo = Boolean(taskId)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {hasTaskInfo ?
          <Button
            variant="outline"
            size="sm"
            disabled={disabled || !hasSessions}
            title={hasSessions ? "Session history" : "No previous sessions"}
            className="min-w-0 gap-2"
          >
            <span className="shrink-0 text-xs font-medium text-muted-foreground">{taskId}</span>
            {taskTitle && <span className="min-w-0 truncate text-sm font-medium">{taskTitle}</span>}
            <IconChevronDown size={14} stroke={1.5} className="shrink-0 text-muted-foreground" />
          </Button>
        : <Button
            variant="outline"
            size="icon-sm"
            disabled={disabled || !hasSessions}
            title={hasSessions ? "Session history" : "No previous sessions"}
          >
            <IconHistory size={16} stroke={1.5} />
          </Button>
        }
      </PopoverTrigger>

      <PopoverContent align="end" className="w-72 p-0">
        <div className="px-3 py-2 text-xs font-medium text-muted-foreground">Recent Sessions</div>
        <div className="max-h-64 overflow-y-auto">
          {sessions.map(session => {
            const isCurrentSession = session.sessionId === currentSessionId
            const isWorkerActive = session.isActive === true
            return (
              <button
                key={session.sessionId}
                onClick={() => handleSelect(session.sessionId)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
              >
                {/* Active indicator - pulsing green dot for active worker sessions */}
                {isWorkerActive && (
                  <span
                    data-testid="active-indicator"
                    className="mt-1.5 flex h-2 w-2 shrink-0"
                    title="Worker running"
                  >
                    <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {session.firstUserMessage || "Empty session"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatRelativeTime(session.lastMessageAt)}
                  </div>
                </div>
                {isCurrentSession && (
                  <IconCheck size={14} stroke={2} className="mt-0.5 shrink-0 text-primary" />
                )}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** Props for the SessionPicker component. */
export interface SessionPickerProps {
  /** List of sessions to display, sorted by recency (most recent first). */
  sessions: SessionIndexEntry[]
  /** The ID of the currently active session, if any. */
  currentSessionId?: string | null
  /** Callback when a session row is clicked. */
  onSelectSession: (sessionId: string) => void
  /** Disable interaction (e.g. while streaming). */
  disabled?: boolean
  /** Current task ID to display in the button (e.g., "r-abc99"). */
  taskId?: string | null
  /** Title of the current task being worked on. */
  taskTitle?: string | null
}
