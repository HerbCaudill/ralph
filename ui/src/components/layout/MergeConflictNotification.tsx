import { cn } from "@/lib/utils"
import { IconGitMerge, IconAlertTriangle } from "@tabler/icons-react"
import { useAppStore, selectActiveInstanceMergeConflict, selectActiveInstanceName } from "@/store"

export type MergeConflictNotificationProps = {
  /** Text color for display (for header variant) */
  textColor?: string
  /** Additional CSS classes */
  className?: string
}

/**
 * Displays a notification when the active instance has a merge conflict.
 * Shows in the header area with a warning style to alert the user.
 */
export function MergeConflictNotification({
  textColor,
  className,
}: MergeConflictNotificationProps) {
  const mergeConflict = useAppStore(selectActiveInstanceMergeConflict)
  const instanceName = useAppStore(selectActiveInstanceName)

  // Only show when there's a merge conflict
  if (!mergeConflict) {
    return null
  }

  const fileCount = mergeConflict.files.length
  const fileText = fileCount === 1 ? "1 file" : `${fileCount} files`

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-1.5",
        "border border-amber-500/30 bg-amber-500/20",
        className,
      )}
      data-testid="merge-conflict-notification"
    >
      <div className="flex items-center gap-1.5">
        <IconGitMerge className="size-4 text-amber-500" aria-hidden="true" />
        <IconAlertTriangle className="size-3 text-amber-500" aria-hidden="true" />
      </div>
      <span className="text-sm font-medium" style={{ color: textColor }}>
        <span className="font-semibold">{instanceName}</span>
        {" paused: merge conflict in "}
        <span className="font-semibold">{fileText}</span>
      </span>
    </div>
  )
}
