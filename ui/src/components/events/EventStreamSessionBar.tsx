import { buildTaskIdPath } from "@/hooks/useTaskDialogRouter"
import { SessionHistoryDropdown } from "./SessionHistoryDropdown"
import type { SessionSummary } from "@/hooks"

/**
 * Navigation bar showing current task and providing access to session history.
 * Features a dropdown to browse past sessions from event logs.
 */
export function EventStreamSessionBar({
  currentTask,
  sessions,
  isLoadingSessions,
  issuePrefix,
  isRunning,
  onSessionHistorySelect,
}: Props) {
  const hasSessions = sessions.length > 0

  // Show dropdown when there are sessions to browse or loading
  const showDropdown = hasSessions || isLoadingSessions

  // Determine placeholder text when no task is selected
  const noTaskText = isRunning ? "Choosing a task..." : "No active task"

  return (
    <div
      className="bg-muted/50 border-border flex items-center justify-center border-b px-3 py-1.5"
      data-testid="session-bar"
    >
      <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
        {showDropdown ?
          <SessionHistoryDropdown
            currentTask={currentTask}
            sessions={sessions}
            isLoadingSessions={isLoadingSessions}
            issuePrefix={issuePrefix}
            isRunning={isRunning}
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
  onSessionHistorySelect: (id: string) => void
}
