import { useAppStore, selectTokenUsage } from "@/store"
import { formatTokenCount } from "@/lib/formatTokenCount"

export function TokenUsageDisplay({}: Props) {
  const tokenUsage = useAppStore(selectTokenUsage)

  // Hide when no tokens have been used yet
  if (tokenUsage.input === 0 && tokenUsage.output === 0) return null

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

type Props = {}
