import { IconPlugConnected, IconPlugConnectedX, IconLoader2 } from "@tabler/icons-react"
import {
  useTokenUsage,
  useContextWindow,
  TokenUsageDisplay,
  ContextWindowProgress,
} from "@herbcaudill/agent-view"
import type { ChatEvent, ConnectionStatus, AgentType } from "@herbcaudill/agent-view"

/**
 * Status bar showing connection state, agent type, token usage, and context window progress.
 */
export function StatusBar({
  connectionStatus,
  isStreaming: _isStreaming,
  agentType,
  agentVersion,
  modelName,
  events,
  error,
  sessionId,
}: StatusBarProps) {
  const tokenUsage = useTokenUsage(events)
  const contextWindow = useContextWindow(events)

  return (
    <div className="flex w-full items-center justify-between">
      <div className="flex items-center gap-3 pl-4">
        {/* Connection indicator */}
        <span className="flex items-center gap-1">
          {connectionStatus === "connected" ?
            <IconPlugConnected size={14} stroke={1.5} className="text-green-600" />
          : connectionStatus === "connecting" ?
            <IconLoader2 size={14} stroke={1.5} className="animate-spin text-amber-500" />
          : <IconPlugConnectedX size={14} stroke={1.5} className="text-red-500" />}
          <span className="capitalize">{connectionStatus}</span>
        </span>

        {/* Agent type & version */}
        <span className="border-l border-border pl-3 capitalize">
          {agentType === "claude" ? "Claude Code" : "Codex"}
          {agentVersion && <span className="ml-1 text-muted-foreground/60">v{agentVersion}</span>}
          {modelName && <span className="ml-1 text-muted-foreground/60">({modelName})</span>}
        </span>

        {/* Session ID */}
        {sessionId && (
          <span
            className="border-l border-border pl-3 font-mono text-muted-foreground/60"
            title={sessionId}
          >
            Session {sessionId.slice(0, 8)}
          </span>
        )}

        {/* Error */}
        {error && <span className="border-l border-border pl-3 text-red-500">{error}</span>}
      </div>

      {/* Token usage & context window */}
      <div className="flex items-center pr-4">
        {(tokenUsage.input > 0 || tokenUsage.output > 0) && (
          <div className="border-r border-border pr-4">
            <TokenUsageDisplay tokenUsage={tokenUsage} />
          </div>
        )}
        <div className="pl-4">
          <ContextWindowProgress contextWindow={contextWindow} />
        </div>
      </div>
    </div>
  )
}

export type StatusBarProps = {
  connectionStatus: ConnectionStatus
  isStreaming: boolean
  agentType: AgentType
  /** Version string for the current agent (e.g. "0.2.19") */
  agentVersion?: string
  /** Friendly model name (e.g. "Opus 4.5") */
  modelName?: string
  events: ChatEvent[]
  error: string | null
  /** Current session ID for debugging */
  sessionId: string | null
}
