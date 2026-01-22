import { useMemo } from "react"
import { cn, stripAnsi } from "@/lib/utils"
import { getPreviewInfo } from "@/lib/getPreviewInfo"

/**
 * Renders ANSI-formatted code output with optional line preview and expand functionality.
 * Strips ANSI codes for display and shows a preview of the first few lines.
 * When truncated, users can click to expand the full output.
 */
export function AnsiOutput({ code, isExpanded, onExpand, className }: Props) {
  const strippedCode = useMemo(() => stripAnsi(code), [code])
  const { preview, remainingLines } = useMemo(() => getPreviewInfo(strippedCode), [strippedCode])
  const displayCode = isExpanded ? strippedCode : preview

  const shouldTruncate = !isExpanded && remainingLines > 0

  return (
    <div
      onClick={shouldTruncate ? onExpand : undefined}
      className={cn(
        "bg-muted/30 mt-1 overflow-hidden rounded border",
        shouldTruncate && "cursor-pointer",
        className,
      )}
    >
      <pre className="overflow-auto p-2 font-mono text-xs whitespace-pre-wrap">{displayCode}</pre>
      {shouldTruncate && (
        <div className="text-muted-foreground border-t px-2 py-1 text-xs">
          ... +{remainingLines} lines
        </div>
      )}
    </div>
  )
}

/**
 * Props for the AnsiOutput component
 */
type Props = {
  /** ANSI-formatted code string to display */
  code: string
  /** Whether the output is expanded to show all lines */
  isExpanded: boolean
  /** Callback invoked when user clicks to expand truncated output */
  onExpand?: () => void
  /** Additional CSS classes to apply to the root container */
  className?: string
}
