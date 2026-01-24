import { cn } from "@/lib/utils"
import { IconCheck } from "@tabler/icons-react"
import type { RalphInstance } from "@/types"

/**
 * Individual option item in the instance selector dropdown.
 * Displays instance name, status indicator, and active checkmark.
 */
export function InstanceOption({
  instance,
  isActive,
  statusConfig,
  onSelect,
}: InstanceOptionProps) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2 rounded px-3 py-2 text-left",
        "hover:bg-repo-accent transition-colors",
        isActive && "bg-repo-accent/50",
      )}
      role="option"
      aria-selected={isActive}
      data-testid={`instance-option-${instance.id}`}
    >
      {/* Status indicator */}
      <span className={cn("size-2 shrink-0 rounded-full", statusConfig.color)} />
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-sm font-medium">{instance.name}</span>
        <span className="text-muted-foreground text-xs">{statusConfig.label}</span>
        {isActive && <IconCheck className="text-primary size-3.5 shrink-0" />}
      </div>
    </button>
  )
}

export type InstanceOptionProps = {
  /** The instance to display */
  instance: RalphInstance
  /** Whether this instance is currently active */
  isActive: boolean
  /** Status configuration with color and label */
  statusConfig: { color: string; label: string }
  /** Callback when this option is selected */
  onSelect: () => void
}
