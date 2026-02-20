import { cn } from "@/lib/utils"
import type { ControlState } from "@herbcaudill/agent-view"
import { controlStateToRalphStatus, type RalphStatus } from "@/lib/getControlBarButtonStates"

/**
 * Displays the current Ralph status with a colored dot indicator.
 *
 * Shows status text and a colored dot that changes based on state:
 * - Stopped: neutral color
 * - Running: green (success)
 * - Paused: yellow (warning)
 * - Stopping after task: yellow (warning)
 */
export function StatusIndicator({
  controlState,
  isStoppingAfterCurrent = false,
  className,
}: StatusIndicatorProps) {
  const status = controlStateToRalphStatus(controlState, isStoppingAfterCurrent)

  const statusConfig: Record<RalphStatus, { color: string; label: string }> = {
    stopped: {
      color: "bg-status-neutral",
      label: "Stopped",
    },
    starting: {
      color: "bg-status-warning animate-pulse",
      label: "Starting",
    },
    running: {
      color: "bg-status-success",
      label: "Running",
    },
    pausing: {
      color: "bg-status-warning animate-pulse",
      label: "Pausing",
    },
    paused: {
      color: "bg-status-warning",
      label: "Paused",
    },
    stopping: {
      color: "bg-status-warning animate-pulse",
      label: "Stopping",
    },
    stopping_after_current: {
      color: "bg-status-warning",
      label: "Stopping after task",
    },
  }

  const config = statusConfig[status]

  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      title={config.label}
      data-testid="status-indicator"
    >
      <span
        className={cn("size-2 rounded-full", config.color)}
        data-testid="status-indicator-dot"
      />
      <span className="text-muted-foreground text-xs">{config.label}</span>
    </div>
  )
}

export type StatusIndicatorProps = {
  /** Current control state from the Ralph loop. */
  controlState: ControlState
  /** Whether Ralph is stopping after the current task. */
  isStoppingAfterCurrent?: boolean
  /** Additional CSS classes. */
  className?: string
}
