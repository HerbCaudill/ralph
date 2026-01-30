import { cn } from "@/lib/utils"
import {
  useAppStore,
  selectTasks,
  selectInitialTaskCount,
  selectRalphStatus,
  selectAccentColor,
  selectClosedTimeFilter,
  getTimeFilterCutoff,
} from "@/store"
import { DEFAULT_ACCENT_COLOR } from "@/constants"

/**
 * Shows task completion progress at the bottom of the sidebar.
 * Displays a progress bar with closed tasks / total visible tasks.
 * The denominator uses the number of non-epic tasks visible in the sidebar
 * after applying the closed tasks time filter.
 * Only visible when Ralph is running.
 */
export function TaskProgressBar({ className }: TaskProgressBarProps) {
  const tasks = useAppStore(selectTasks)
  const initialTaskCount = useAppStore(selectInitialTaskCount)
  const ralphStatus = useAppStore(selectRalphStatus)
  const accentColor = useAppStore(selectAccentColor)
  const closedTimeFilter = useAppStore(selectClosedTimeFilter)
  const progressColor = accentColor ?? DEFAULT_ACCENT_COLOR

  const isRunning =
    ralphStatus === "running" ||
    ralphStatus === "paused" ||
    ralphStatus === "stopping_after_current"
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
      className={cn("border-border border-t px-4 py-3", className)}
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
}
