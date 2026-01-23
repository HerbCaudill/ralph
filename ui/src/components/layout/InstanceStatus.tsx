import { cn } from "@/lib/utils"
import { useAppStore, selectActiveInstanceCurrentTaskTitle, selectRalphStatus } from "@/store"

export type InstanceStatusProps = {
  /** Text color for display */
  textColor?: string
  /** Additional CSS classes */
  className?: string
}

/**
 * Displays the current task status in the header.
 * Shows status when running, e.g., "running 'Fix login bug'"
 * The agent name is not shown here as it's already displayed in the Logo.
 */
export function InstanceStatus({ textColor, className }: InstanceStatusProps) {
  const taskTitle = useAppStore(selectActiveInstanceCurrentTaskTitle)
  const status = useAppStore(selectRalphStatus)

  // Only show when running or paused with a task
  const isActive = status === "running" || status === "paused" || status === "pausing"
  if (!isActive) {
    return null
  }

  const statusText = taskTitle ? `'${taskTitle}'` : ""
  const verb = status === "paused" || status === "pausing" ? "paused on" : "running"
  const displayText = statusText ? `${verb} ${statusText}` : verb

  return (
    <span
      className={cn("flex items-center gap-1.5 text-sm font-medium opacity-90", className)}
      style={{ color: textColor }}
      title={displayText}
      data-testid="instance-status"
    >
      <span className="max-w-[200px] truncate">{displayText}</span>
    </span>
  )
}
