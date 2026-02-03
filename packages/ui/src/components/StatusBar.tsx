import { IconPlugConnected, IconPlugConnectedX, IconLoader2 } from "@tabler/icons-react"
import {
  useTokenUsage,
  useContextWindow,
  TokenUsageDisplay,
  ContextWindowProgress,
} from "@herbcaudill/agent-view"
import type { ChatEvent, ConnectionStatus } from "@herbcaudill/agent-view"

/**
 * Footer status bar showing connection status, workspace path, token usage, and context window progress.
 */
export function StatusBar({ connectionStatus, workspacePath, events, error }: StatusBarProps) {
  const tokenUsage = useTokenUsage(events)
  const contextWindow = useContextWindow(events)

  return (
    <div className="flex w-full items-center justify-between">
      {/* Left section: connection and workspace */}
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

        {/* Workspace path */}
        {workspacePath && (
          <span
            className="max-w-[300px] truncate border-l border-border pl-3 font-mono text-[10px]"
            title={workspacePath}
          >
            {workspacePath}
          </span>
        )}

        {/* Error */}
        {error && <span className="border-l border-border pl-3 text-red-500">{error}</span>}
      </div>

      {/* Right section: token usage and context window */}
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
  /** Current WebSocket connection status. */
  connectionStatus: ConnectionStatus
  /** Path to the current workspace. */
  workspacePath?: string | null
  /** Chat events used to compute token usage and context window. */
  events: ChatEvent[]
  /** Error message to display. */
  error: string | null
}
