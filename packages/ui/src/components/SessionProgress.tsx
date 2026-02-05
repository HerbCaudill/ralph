import { cn } from "@/lib/utils"
import { DEFAULT_ACCENT_COLOR } from "@herbcaudill/beads-view"
import type { TaskCardTask } from "@herbcaudill/beads-view"

/**
 * Shows task completion progress in the footer.
 * Displays a compact progress bar with closed/total count.
 */
export function SessionProgress({ tasks = [], accentColor, className }: SessionProgressProps) {
  const progressColor = accentColor ?? DEFAULT_ACCENT_COLOR

  // Filter out epics for progress calculation
  const visibleTasks = tasks.filter(task => task.issue_type !== "epic")

  if (visibleTasks.length === 0) return null

  const totalTasks = visibleTasks.length
  const closedTasks = visibleTasks.filter(t => t.status === "closed").length
  const progress = (closedTasks / totalTasks) * 100

  return (
    <div
      className={cn("flex items-center gap-2", className)}
      title={`Session ${closedTasks} of ${totalTasks}`}
      data-testid="session-progress"
    >
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-black/30">
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${Math.min(progress, 100)}%`, backgroundColor: progressColor }}
        />
      </div>
      <span className="text-muted-foreground text-xs">
        {closedTasks}/{totalTasks}
      </span>
    </div>
  )
}

export type SessionProgressProps = {
  /** Tasks to calculate progress from. */
  tasks?: TaskCardTask[]
  /** Accent color for the progress bar fill. */
  accentColor?: string | null
  /** Additional CSS classes. */
  className?: string
}
