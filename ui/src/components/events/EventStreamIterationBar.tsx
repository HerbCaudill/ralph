import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react"
import { useTaskDialogContext } from "@/contexts"

export function EventStreamIterationBar({
  iterationCount,
  displayedIteration,
  isViewingLatest,
  viewingIterationIndex,
  currentTask,
  onPrevious,
  onNext,
  onLatest,
}: Props) {
  const hasMultipleIterations = iterationCount > 1
  const taskDialogContext = useTaskDialogContext()

  const handleTaskClick = (taskId: string | null) => {
    if (!taskId) return
    if (taskDialogContext) {
      taskDialogContext.openTaskById(taskId)
    }
  }

  return (
    <div
      className="bg-muted/50 border-border flex items-center justify-between border-b px-3 py-1.5"
      data-testid="iteration-bar"
    >
      <div className="flex w-20 items-center">
        {hasMultipleIterations && (
          <button
            onClick={onPrevious}
            disabled={viewingIterationIndex === 0}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Previous iteration"
          >
            <IconChevronLeft className="size-4" />
            <span className="hidden sm:inline">Previous</span>
          </button>
        )}
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
        {currentTask ?
          <div
            className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs"
            title="Current task"
          >
            {currentTask.id ?
              <button
                onClick={() => handleTaskClick(currentTask.id)}
                className="hover:text-foreground shrink-0 font-mono opacity-70 transition-opacity hover:underline hover:opacity-100"
                aria-label={`View task ${currentTask.id}`}
              >
                {currentTask.id}
              </button>
            : null}
            <span className="truncate">{currentTask.title}</span>
          </div>
        : hasMultipleIterations ?
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">
              Iteration {displayedIteration} of {iterationCount}
            </span>
            {!isViewingLatest && (
              <button
                onClick={onLatest}
                className="bg-primary text-primary-foreground rounded px-2 py-0.5 text-xs font-medium hover:opacity-90"
              >
                Latest
              </button>
            )}
          </div>
        : <span className="text-muted-foreground text-xs">No active task</span>}
      </div>

      <div className="flex w-20 items-center justify-end">
        {hasMultipleIterations && (
          <button
            onClick={onNext}
            disabled={isViewingLatest}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Next iteration"
          >
            <span className="hidden sm:inline">Next</span>
            <IconChevronRight className="size-4" />
          </button>
        )}
      </div>
    </div>
  )
}

type Props = {
  iterationCount: number
  displayedIteration: number
  isViewingLatest: boolean
  viewingIterationIndex: number | null
  currentTask: { id: string | null; title: string } | null
  onPrevious: () => void
  onNext: () => void
  onLatest: () => void
}
