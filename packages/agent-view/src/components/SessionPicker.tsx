import { useState, useCallback } from "react"
import { IconHistory, IconCheck, IconChevronDown, IconLoader2 } from "@tabler/icons-react"
import { Button, Popover, PopoverTrigger, PopoverContent } from "@herbcaudill/components"
import type { SessionIndexEntry } from "../lib/sessionIndex"

/** Extended session entry with optional task information for Ralph sessions. */
export interface SessionPickerEntry extends SessionIndexEntry {
  /** The task ID this session worked on. */
  taskId?: string
  /** The resolved title of the task. */
  taskTitle?: string
}

/**
 * A popover/dropdown that displays past sessions from the session index.
 * Each row shows the task ID and title (like the trigger button format).
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
            className="group min-w-0 gap-2"
          >
            <span className="shrink-0 text-xs font-medium text-muted-foreground group-hover:text-repo-accent-foreground/75">
              {taskId}
            </span>
            {taskTitle && <span className="min-w-0 truncate text-sm font-medium">{taskTitle}</span>}
            <IconChevronDown
              size={14}
              stroke={1.5}
              className="shrink-0 text-muted-foreground group-hover:text-repo-accent-foreground/75"
            />
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

      <PopoverContent align="start" className="w-80 p-0">
        <div className="max-h-64 overflow-y-auto py-1">
          {sessions.map(session => {
            const isCurrentSession = session.sessionId === currentSessionId
            const isWorkerActive = session.isActive === true
            const sessionTaskId = session.taskId
            const sessionTaskTitle = session.taskTitle
            return (
              <button
                key={session.sessionId}
                onClick={() => handleSelect(session.sessionId)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
              >
                {/* Active indicator - spinner for active worker sessions, spacer for inactive */}
                {isWorkerActive ?
                  <IconLoader2
                    data-testid="active-indicator"
                    size={14}
                    stroke={1.5}
                    className="shrink-0 animate-spin text-muted-foreground"
                    aria-label="Worker running"
                  />
                : <span data-testid="spacer" className="w-[14px] shrink-0" />}
                {/* Task ID (muted) + Task title, like the trigger button format */}
                {sessionTaskId ?
                  <>
                    <span className="shrink-0 text-xs font-medium text-muted-foreground">
                      {sessionTaskId}
                    </span>
                    {sessionTaskTitle && (
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {sessionTaskTitle}
                      </span>
                    )}
                  </>
                : <span className="text-muted-foreground">No task</span>}
                {isCurrentSession && (
                  <IconCheck size={14} stroke={2} className="shrink-0 text-primary" />
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
  sessions: SessionPickerEntry[]
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
