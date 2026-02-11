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
 * Task info (taskId/taskTitle) comes from session data for all sessions,
 * including the current one. This ensures the dropdown always shows correct
 * task info regardless of which session is being viewed.
 */
export function SessionPicker({
  sessions,
  currentSessionId,
  onSelectSession,
  disabled = false,
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

  // Derive trigger button task info from the current session's data
  const currentSession = sessions.find(s => s.sessionId === currentSessionId)
  const triggerTaskId = currentSession?.taskId
  const triggerTaskTitle = currentSession?.taskTitle
  const hasTaskInfo = Boolean(triggerTaskId)

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
            <span className="shrink-0 text-xs font-medium text-muted-foreground group-hover:text-white/75">
              {triggerTaskId}
            </span>
            {triggerTaskTitle && (
              <span className="min-w-0 truncate text-sm font-medium">{triggerTaskTitle}</span>
            )}
            <IconChevronDown
              size={14}
              stroke={1.5}
              className="shrink-0 text-muted-foreground group-hover:text-white/75"
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
                : <span data-testid="spacer" className="w-3.5 shrink-0" />}
                {/* Task ID (muted) + Task title, like the trigger button format */}
                {session.taskId ?
                  <>
                    <span className="shrink-0 text-xs font-medium text-muted-foreground">
                      {session.taskId}
                    </span>
                    {session.taskTitle && (
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {session.taskTitle}
                      </span>
                    )}
                  </>
                : <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {session.firstUserMessage || "No task"}
                  </span>
                }
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
}
