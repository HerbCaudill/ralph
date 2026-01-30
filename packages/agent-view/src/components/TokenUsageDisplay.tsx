import { formatTokenCount } from "../lib/formatTokenCount"
import type { TokenUsage } from "../types"

/** Display input/output token usage with arrow indicators. */
export function TokenUsageDisplay({ tokenUsage }: TokenUsageDisplayProps) {
  return (
    <div
      className="text-muted-foreground flex items-center gap-2 text-xs"
      title="Token usage (input / output)"
    >
      <span className="flex items-center gap-0.5">
        <span className="opacity-70">↓</span>
        <span>{formatTokenCount(tokenUsage.input)}</span>
      </span>
      <span className="flex items-center gap-0.5">
        <span className="opacity-70">↑</span>
        <span>{formatTokenCount(tokenUsage.output)}</span>
      </span>
    </div>
  )
}

export type TokenUsageDisplayProps = {
  /** Token usage to display */
  tokenUsage: TokenUsage
}
