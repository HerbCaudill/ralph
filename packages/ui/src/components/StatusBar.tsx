import { IconPlugConnected, IconPlugConnectedX, IconLoader2 } from "@tabler/icons-react"
import {
  useTokenUsage,
  useContextWindow,
  TokenUsageDisplay,
  ContextWindowProgress,
  AgentControls,
} from "@herbcaudill/agent-view"
import type { ChatEvent, ConnectionStatus, ControlState } from "@herbcaudill/agent-view"

/**
 * Footer status bar showing connection status, workspace path, current task, agent controls, token usage, and context window progress.
 */
export function StatusBar({
  connectionStatus,
  workspacePath,
  events,
  error,
  controlState,
  onPause,
  onResume,
  onStop,
  currentTaskId,
  currentTaskTitle,
}: StatusBarProps) {
  const tokenUsage = useTokenUsage(events)
  const contextWindow = useContextWindow(events)

  return (
    <div className="flex w-full items-center justify-between">
      {/* Left section: connection, workspace, and controls */}
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

        {/* Agent controls - only show when connected and callbacks provided */}
        {connectionStatus === "connected" && controlState && onPause && onResume && onStop && (
          <div className="border-l border-border pl-3">
            <AgentControls
              state={controlState}
              onPause={onPause}
              onResume={onResume}
              onStop={onStop}
              showNewSession={false}
              showPauseResume={true}
              showStop={true}
              size="sm"
            />
          </div>
        )}

        {/* Current task indicator */}
        {currentTaskId && (
          <span className="flex items-center gap-1.5 border-l border-border pl-3">
            <span className="text-muted-foreground text-[10px]">Task:</span>
            <span className="font-mono text-[10px]" title={currentTaskTitle ?? currentTaskId}>
              {currentTaskId}
            </span>
          </span>
        )}

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
  /** Current agent control state. */
  controlState?: ControlState
  /** Called when pause button is clicked. */
  onPause?: () => void
  /** Called when resume button is clicked. */
  onResume?: () => void
  /** Called when stop button is clicked. */
  onStop?: () => void
  /** ID of the current task being worked on. */
  currentTaskId?: string | null
  /** Title of the current task being worked on. */
  currentTaskTitle?: string | null
}
