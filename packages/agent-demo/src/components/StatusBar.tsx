import { IconPlugConnected, IconPlugConnectedX, IconLoader2 } from "@tabler/icons-react"
import {
  useTokenUsage,
  useContextWindow,
  TokenUsageDisplay,
  ContextWindowProgress,
} from "@herbcaudill/agent-view"
import type { ChatEvent } from "@herbcaudill/agent-view"
import type { ConnectionStatus, AgentType } from "../hooks/useAgentChat"

/**
 * Status bar showing connection state, agent type, token usage, and context window progress.
 */
export function StatusBar({
  connectionStatus,
  isStreaming,
  agentType,
  events,
  error,
}: StatusBarProps) {
  const tokenUsage = useTokenUsage(events)
  const contextWindow = useContextWindow(events)

  return (
    <div className="flex w-full items-center justify-between">
      <div className="flex items-center gap-3">
        {/* Connection indicator */}
        <span className="flex items-center gap-1">
          {connectionStatus === "connected" ?
            <IconPlugConnected size={14} stroke={1.5} className="text-green-600" />
          : connectionStatus === "connecting" ?
            <IconLoader2 size={14} stroke={1.5} className="animate-spin text-amber-500" />
          : <IconPlugConnectedX size={14} stroke={1.5} className="text-red-500" />}
          <span className="capitalize">{connectionStatus}</span>
        </span>

        {/* Agent type */}
        <span className="text-muted-foreground/60">|</span>
        <span className="capitalize">{agentType === "claude" ? "Claude Code" : "Codex"}</span>

        {/* Error */}
        {error && (
          <>
            <span className="text-muted-foreground/60">|</span>
            <span className="text-red-500">{error}</span>
          </>
        )}
      </div>

      {/* Token usage & context window */}
      <div className="flex items-center gap-4">
        {(tokenUsage.input > 0 || tokenUsage.output > 0) && (
          <TokenUsageDisplay tokenUsage={tokenUsage} />
        )}
        <ContextWindowProgress contextWindow={contextWindow} />
      </div>
    </div>
  )
}

export type StatusBarProps = {
  connectionStatus: ConnectionStatus
  isStreaming: boolean
  agentType: AgentType
  events: ChatEvent[]
  error: string | null
}
