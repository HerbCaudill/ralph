import { cn } from "@/lib/utils"

export type InstanceCountBadgeProps = {
  /** Number of active instances to display */
  count: number
  /** Additional CSS classes */
  className?: string
}

/**
 * Badge showing the number of running Ralph instances.
 * Displays in the header when more than one instance is active.
 */
export function InstanceCountBadge({ count, className }: InstanceCountBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium",
        className,
      )}
      title={`${count} instances running`}
      data-testid="instance-count-badge"
    >
      <span className="inline-block size-1.5 animate-pulse rounded-full bg-current opacity-80" />
      {count}
    </span>
  )
}
