import { cn } from "@/lib/utils"
import {
  useAppStore,
  selectActiveInstanceAgentName,
  selectActiveInstanceCurrentTaskTitle,
  selectRalphStatus,
} from "@/store"

export type InstanceStatusProps = {
  /** Text color for display */
  textColor?: string
  /** Additional CSS classes */
  className?: string
}

/**
 * Displays the active instance's agent name and current task.
 * Shows agent name and status when running, e.g., "Ralph: running 'Fix login bug'"
 */
export function InstanceStatus({ textColor, className }: InstanceStatusProps) {
  const agentName = useAppStore(selectActiveInstanceAgentName)
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
      title={`${agentName}: ${displayText}`}
      data-testid="instance-status"
    >
      <span className="font-semibold">{agentName}:</span>
      <span className="max-w-[200px] truncate">{displayText}</span>
    </span>
  )
}
