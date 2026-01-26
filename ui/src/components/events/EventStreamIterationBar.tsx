import { buildTaskIdPath } from "@/hooks/useTaskDialogRouter"
import { IterationHistoryDropdown } from "./IterationHistoryDropdown"
import type { IterationSummary } from "@/hooks"

/**
 * Navigation bar showing current task and providing access to iteration history.
 * Features a dropdown to browse past iterations from event logs.
 */
export function EventStreamIterationBar({
  currentTask,
  iterations,
  isLoadingIterations,
  issuePrefix,
  onIterationHistorySelect,
}: Props) {
  const hasIterations = iterations.length > 0

  // Show dropdown when there are iterations to browse or loading
  const showDropdown = hasIterations || isLoadingIterations

  return (
    <div
      className="bg-muted/50 border-border flex items-center justify-center border-b px-3 py-1.5"
      data-testid="iteration-bar"
    >
      <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
        {showDropdown ?
          <IterationHistoryDropdown
            currentTask={currentTask}
            iterations={iterations}
            isLoadingIterations={isLoadingIterations}
            issuePrefix={issuePrefix}
            onIterationHistorySelect={onIterationHistorySelect}
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
        : <span className="text-muted-foreground text-xs">No active task</span>}
      </div>
    </div>
  )
}

type Props = {
  currentTask: { id: string | null; title: string } | null
  iterations: IterationSummary[]
  isLoadingIterations: boolean
  issuePrefix: string | null
  onIterationHistorySelect: (id: string) => void
}
