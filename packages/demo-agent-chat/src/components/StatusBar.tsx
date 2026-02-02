import {
  IconPlugConnected,
  IconPlugConnectedX,
  IconLoader2,
} from "@tabler/icons-react"
import { useTokenUsage } from "@herbcaudill/agent-view"
import type { ChatEvent } from "@herbcaudill/agent-view"
import type { ConnectionStatus, AgentType } from "../hooks/useAgentChat"

export type StatusBarProps = {
  connectionStatus: ConnectionStatus
  isStreaming: boolean
  agentType: AgentType
  events: ChatEvent[]
  error: string | null
}

/**
 * Status bar showing connection state, streaming indicator, agent type, and token usage.
 */
export function StatusBar({
  connectionStatus,
  isStreaming,
  agentType,
  events,
  error,
}: StatusBarProps) {
  const { input: inputTokens, output: outputTokens } = useTokenUsage(events)

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {/* Connection indicator */}
        <span className="flex items-center gap-1">
          {connectionStatus === "connected" ? (
            <IconPlugConnected
              size={14}
              stroke={1.5}
              className="text-green-600"
            />
          ) : connectionStatus === "connecting" ? (
            <IconLoader2
              size={14}
              stroke={1.5}
              className="animate-spin text-amber-500"
            />
          ) : (
            <IconPlugConnectedX
              size={14}
              stroke={1.5}
              className="text-red-500"
            />
          )}
          <span className="capitalize">{connectionStatus}</span>
        </span>

        {/* Agent type */}
        <span className="text-muted-foreground/60">|</span>
        <span className="capitalize">
          {agentType === "claude" ? "Claude Code" : "Codex"}
        </span>

        {/* Streaming indicator */}
        {isStreaming && (
          <>
            <span className="text-muted-foreground/60">|</span>
            <span className="flex items-center gap-1 text-amber-600">
              <IconLoader2 size={12} stroke={1.5} className="animate-spin" />
              Processing
            </span>
          </>
        )}

        {/* Error */}
        {error && (
          <>
            <span className="text-muted-foreground/60">|</span>
            <span className="text-red-500">{error}</span>
          </>
        )}
      </div>

      {/* Token usage */}
      {(inputTokens > 0 || outputTokens > 0) && (
        <div className="flex items-center gap-2 text-muted-foreground/80">
          <span>
            {formatTokens(inputTokens)} in / {formatTokens(outputTokens)} out
          </span>
        </div>
      )}
    </div>
  )
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}
