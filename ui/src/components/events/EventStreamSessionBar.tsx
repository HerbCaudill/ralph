import { IconArrowLeft, IconHistory } from "@tabler/icons-react"
import { buildTaskIdPath } from "@/hooks/useTaskDialogRouter"
import { SessionHistoryDropdown } from "./SessionHistoryDropdown"
import type { SessionSummary } from "@/hooks"

/**
 * Navigation bar showing current task and providing access to session history.
 * Features a dropdown to browse past sessions from event logs.
 * When viewing a historical session, shows a "Return to Live" button.
 */
export function EventStreamSessionBar({
  currentTask,
  sessions,
  isLoadingSessions,
  issuePrefix,
  isRunning,
  isViewingHistorical,
  currentSessionId,
  onSessionHistorySelect,
  onReturnToLive,
}: Props) {
  const hasSessions = sessions.length > 0

  // Show dropdown when:
  // - There are sessions to browse, OR
  // - Sessions are loading, OR
  // - There's an active session (isRunning) so user can access the dropdown
  const showDropdown = hasSessions || isLoadingSessions || isRunning

  // Determine placeholder text when no task is selected
  const noTaskText = isRunning ? "Choosing a task..." : "No active task"

  return (
    <div
      className="bg-muted/50 border-border flex items-center justify-center border-b px-3 py-1.5"
      data-testid="session-bar"
    >
      <div className="flex w-full max-w-[36rem] min-w-0 items-center justify-center gap-2">
        {isViewingHistorical ?
          // When viewing historical session, show return button and session dropdown
          <div className="flex w-full min-w-0 items-center gap-2">
            <button
              onClick={onReturnToLive}
              className="text-muted-foreground hover:bg-muted hover:text-foreground flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors"
              title="Return to live session"
              aria-label="Return to live session"
              data-testid="return-to-live-button"
            >
              <IconArrowLeft className="size-3" />
              <span>Live</span>
            </button>
            <span className="text-muted-foreground/50">|</span>
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <IconHistory className="text-muted-foreground size-3 shrink-0" />
              <SessionHistoryDropdown
                currentTask={currentTask}
                sessions={sessions}
                isLoadingSessions={isLoadingSessions}
                issuePrefix={issuePrefix}
                isRunning={false}
                currentSessionId={currentSessionId}
                onSessionHistorySelect={onSessionHistorySelect}
              />
            </div>
          </div>
        : showDropdown ?
          <SessionHistoryDropdown
            currentTask={currentTask}
            sessions={sessions}
            isLoadingSessions={isLoadingSessions}
            issuePrefix={issuePrefix}
            isRunning={isRunning}
            currentSessionId={currentSessionId}
            onSessionHistorySelect={onSessionHistorySelect}
          />
        : currentTask ?
          <div
            className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs"
            title="Current task"
          >
            {currentTask.id ?
              <a
                href={buildTaskIdPath(currentTask.id)}
                className="hover:text-foreground shrink-0 font-mono opacity-70 transition-opacity hover:underline hover:opacity-100"
                aria-label={`View task ${currentTask.id}`}
              >
                {currentTask.id}
              </a>
            : null}
            <span className="truncate">{currentTask.title}</span>
          </div>
        : <span className="text-muted-foreground text-xs">{noTaskText}</span>}
      </div>
    </div>
  )
}

type Props = {
  currentTask: { id: string | null; title: string } | null
  sessions: SessionSummary[]
  isLoadingSessions: boolean
  issuePrefix: string | null
  isRunning: boolean
  isViewingHistorical: boolean
  currentSessionId?: string | null
  onSessionHistorySelect: (id: string) => void
  onReturnToLive: () => void
}
