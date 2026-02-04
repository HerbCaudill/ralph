import { cn } from "@/lib/utils"
import type { RalphStatus } from "@/types"

/**
 * InstanceBadge displays a Ralph instance status with a colored indicator.
 * Used for showing the state of multiple concurrent Ralph instances.
 */
export function InstanceBadge({ status, name, showLabel = true, className }: Props) {
  const statusConfig: Record<RalphStatus, { color: string; label: string }> = {
    stopped: {
      color: "bg-status-error",
      label: "Stopped",
    },
    starting: {
      color: "bg-status-success/50 animate-pulse",
      label: "Starting",
    },
    running: {
      color: "bg-status-success",
      label: "Running",
    },
    pausing: {
      color: "bg-status-warning/50 animate-pulse",
      label: "Pausing",
    },
    paused: {
      color: "bg-status-warning",
      label: "Paused",
    },
    stopping: {
      color: "bg-status-error/70 animate-pulse",
      label: "Stopping",
    },
    stopping_after_current: {
      color: "bg-status-error/70 animate-pulse",
      label: "Stopping after task",
    },
  }

  const config = statusConfig[status]
  const displayText = name ? `${name} - ${config.label}` : config.label

  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      title={displayText}
      data-testid="instance-badge"
    >
      <span
        className={cn("size-2 shrink-0 rounded-full", config.color)}
        data-testid="instance-badge-indicator"
      />
      {showLabel && (
        <span className="text-muted-foreground truncate text-xs" data-testid="instance-badge-label">
          {displayText}
        </span>
      )}
    </div>
  )
}

export interface Props {
  /** The status of the Ralph instance */
  status: RalphStatus
  /** Optional display name for the instance */
  name?: string
  /** Whether to show the text label (defaults to true) */
  showLabel?: boolean
  /** Additional CSS classes */
  className?: string
}
