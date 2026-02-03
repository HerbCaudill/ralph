import { useState, useRef, useEffect, useCallback } from "react"
import { IconHistory, IconCheck } from "@tabler/icons-react"
import type { SessionIndexEntry } from "../lib/sessionIndex"
import { formatRelativeTime } from "../lib/formatRelativeTime"

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
}

/**
 * A popover/dropdown that displays past sessions from the session index.
 * Each row shows the first user message text and a relative timestamp.
 * Clicking a row restores that session.
 */
export function SessionPicker({
  sessions,
  currentSessionId,
  onSelectSession,
  disabled = false,
}: SessionPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  /** Close on outside click. */
  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [isOpen])

  /** Close on Escape. */
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false)
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [isOpen])

  const handleSelect = useCallback(
    (sessionId: string) => {
      onSelectSession(sessionId)
      setIsOpen(false)
    },
    [onSelectSession],
  )

  const hasSessions = sessions.length > 0

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || !hasSessions}
        title={hasSessions ? "Session history" : "No previous sessions"}
        className="flex items-center justify-center rounded-md border border-border p-1.5 transition-colors hover:bg-muted disabled:opacity-30"
      >
        <IconHistory size={16} stroke={1.5} />
      </button>

      {isOpen && hasSessions && (
        <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-md border border-border bg-background shadow-md">
          <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
            Recent Sessions
          </div>
          <div className="max-h-64 overflow-y-auto">
            {sessions.map(session => {
              const isActive = session.sessionId === currentSessionId
              return (
                <button
                  key={session.sessionId}
                  onClick={() => handleSelect(session.sessionId)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">
                      {session.firstUserMessage || "Empty session"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatRelativeTime(session.lastMessageAt)}
                    </div>
                  </div>
                  {isActive && (
                    <IconCheck
                      size={14}
                      stroke={2}
                      className="mt-0.5 shrink-0 text-primary"
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
