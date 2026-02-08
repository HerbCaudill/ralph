import { cx } from "../cx"
import { formatTokenCount } from "../lib/formatTokenCount"
import type { ContextWindow } from "../types"

/** Visual progress bar showing context window usage with color-coded thresholds. */
export function ContextWindowProgress({ contextWindow }: ContextWindowProgressProps) {
  if (contextWindow.used === 0) return null

  const progress = (contextWindow.used / contextWindow.max) * 100
  const usedFormatted = formatTokenCount(contextWindow.used)
  const maxFormatted = formatTokenCount(contextWindow.max)

  const getProgressColor = () => {
    if (progress >= 80) return "bg-status-error"
    if (progress >= 50) return "bg-status-warning"
    return "bg-status-success"
  }

  return (
    <div
      className="flex items-center gap-2"
      title={`Context window: ${usedFormatted} / ${maxFormatted} tokens (${progress.toFixed(1)}%)`}
      data-testid="context-window-progress"
    >
      <div className="bg-muted h-1.5 w-20 overflow-hidden rounded-full">
        <div
          className={cx("h-full transition-all duration-300", getProgressColor())}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      <span className="text-muted-foreground text-xs">{Math.round(progress)}%</span>
    </div>
  )
}

export type ContextWindowProgressProps = {
  /** Context window usage data */
  contextWindow: ContextWindow
}
