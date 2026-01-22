import { cx } from "@/lib/utils"
import { parseDiff } from "@/lib/parseDiff"
import { TOOL_OUTPUT_PREVIEW_LINES } from "@/constants"
import { HighlightedLine } from "./HighlightedLine"

/**
 * Display a visual diff between two strings with syntax highlighting.
 * Shows added lines in green and removed lines in red. Can be expanded to show all lines.
 */
export function DiffView({ oldString, newString, language = "text", isExpanded, onExpand }: Props) {
  const lines = parseDiff(oldString, newString)
  const shouldTruncate = !isExpanded && lines.length > TOOL_OUTPUT_PREVIEW_LINES
  const displayLines = shouldTruncate ? lines.slice(0, TOOL_OUTPUT_PREVIEW_LINES) : lines
  const remainingLines = lines.length - TOOL_OUTPUT_PREVIEW_LINES

  return (
    <div
      className={cx(
        "bg-muted/30 overflow-x-auto rounded border font-mono text-xs",
        shouldTruncate && "cursor-pointer",
      )}
      onClick={shouldTruncate ? onExpand : undefined}
    >
      {displayLines.map((line, i) => (
        <div
          key={i}
          className={cx(
            "flex",
            line.type === "added" && "bg-status-success/20",
            line.type === "removed" && "bg-status-error/20",
          )}
        >
          <span className="text-muted-foreground w-8 shrink-0 border-r px-1 text-right select-none">
            {line.lineOld ?? ""}
          </span>
          <span className="text-muted-foreground w-8 shrink-0 border-r px-1 text-right select-none">
            {line.lineNew ?? ""}
          </span>
          <span className="w-4 shrink-0 text-center select-none">
            {line.type === "added" ?
              <span className="text-status-success">+</span>
            : line.type === "removed" ?
              <span className="text-status-error">-</span>
            : ""}
          </span>
          <span className="flex-1 px-2">
            <HighlightedLine content={line.content} language={language} />
          </span>
        </div>
      ))}
      {shouldTruncate && (
        <div className="text-muted-foreground border-t px-2 py-1">... +{remainingLines} lines</div>
      )}
    </div>
  )
}

type Props = {
  oldString: string
  newString: string
  language?: string
  isExpanded: boolean
  onExpand?: () => void
}
