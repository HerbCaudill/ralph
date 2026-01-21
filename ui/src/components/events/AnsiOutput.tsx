import { useMemo } from "react"
import { cn, stripAnsi } from "@/lib/utils"
import { getPreviewInfo } from "@/lib/getPreviewInfo"

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

type Props = {
  code: string
  isExpanded: boolean
  onExpand?: () => void
  className?: string
}
