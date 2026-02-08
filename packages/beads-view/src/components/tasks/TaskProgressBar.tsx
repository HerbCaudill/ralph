import { cn } from "../../lib/cn"
import { getTimeFilterCutoff } from "../../lib/getTimeFilterCutoff"
import { DEFAULT_ACCENT_COLOR } from "../../constants"
import type { Task, ClosedTasksTimeFilter } from "../../types"

/**
 * Shows task completion progress at the bottom of the sidebar.
 * Displays a progress bar with closed tasks / total visible tasks.
 * The denominator uses the number of non-epic tasks visible in the sidebar
 * after applying the closed tasks time filter.
 * Only visible when Ralph is running.
 */
export function TaskProgressBar({
  className,
  isRunning = false,
  tasks = [],
  initialTaskCount = null,
  accentColor = null,
  closedTimeFilter = "past_day",
}: TaskProgressBarProps) {
  const progressColor = accentColor ?? DEFAULT_ACCENT_COLOR

  if (!isRunning || initialTaskCount === null) return null

  const closedCutoff = getTimeFilterCutoff(closedTimeFilter)

  const visibleTasks = tasks.filter(task => {
    if (task.issue_type === "epic") return false

    if (task.status === "closed" && closedCutoff) {
      const closedAt = task.closed_at ? new Date(task.closed_at) : null
      if (!closedAt || closedAt < closedCutoff) {
        return false
      }
    }

    return true
  })

  const totalTasks = visibleTasks.length
  const closedTasks = visibleTasks.filter(t => t.status === "closed").length

  if (totalTasks === 0) return null

  const progress = (closedTasks / totalTasks) * 100

  return (
    <div
      className={className}
      role="progressbar"
      aria-valuenow={closedTasks}
      aria-valuemin={0}
      aria-valuemax={totalTasks}
      aria-label="Task completion progress"
      data-testid="task-progress-bar"
    >
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/30">
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${Math.min(progress, 100)}%`, backgroundColor: progressColor }}
          />
        </div>
        <span className="text-muted-foreground shrink-0 text-xs">
          {closedTasks}/{totalTasks}
        </span>
      </div>
    </div>
  )
}

export type TaskProgressBarProps = {
  className?: string
  /** Whether to show progress (host decides if Ralph is running). */
  isRunning?: boolean
  /** All tasks to calculate progress from. */
  tasks?: Task[]
  /** Initial task count (progress is hidden when null). */
  initialTaskCount?: number | null
  /** Accent color for the progress bar. */
  accentColor?: string | null
  /** Time filter for closed tasks. */
  closedTimeFilter?: ClosedTasksTimeFilter
}
