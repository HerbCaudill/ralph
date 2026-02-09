import { useCallback, useState } from "react"
import { IconCheck } from "@tabler/icons-react"
import { cn } from "../../lib/cn"

/**
 * Displays a task ID that copies the full task ID to the clipboard when clicked.
 * Shows a brief checkmark icon after a successful copy.
 */
export function CopyableTaskId({ taskId, displayId, className }: CopyableTaskIdProps) {
  const [copied, setCopied] = useState(false)

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      navigator.clipboard.writeText(taskId).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      })
    },
    [taskId],
  )

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "text-muted-foreground hover:text-foreground shrink-0 cursor-pointer font-mono text-xs transition-colors",
        className,
      )}
      aria-label={`Copy task ID ${displayId}`}
      title={`Click to copy ${taskId}`}
    >
      {copied ?
        <span className="inline-flex items-center gap-0.5">
          <IconCheck className="size-3" aria-label="Copied" />
          {displayId}
        </span>
      : displayId}
    </button>
  )
}

/** Props for the CopyableTaskId component. */
export type CopyableTaskIdProps = {
  /** The full task ID to copy to clipboard (e.g., "rui-4rt.5"). */
  taskId: string
  /** The display version of the task ID (may have prefix stripped, e.g., "4rt.5"). */
  displayId: string
  /** Additional CSS classes. */
  className?: string
}
