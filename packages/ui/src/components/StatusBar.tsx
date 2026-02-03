import { IconPlugConnected, IconPlugConnectedX, IconLoader2 } from "@tabler/icons-react"
import {
  useTokenUsage,
  useContextWindow,
  TokenUsageDisplay,
  ContextWindowProgress,
} from "@herbcaudill/agent-view"
import type { ChatEvent, ConnectionStatus, ControlState } from "@herbcaudill/agent-view"
import { useSessionTimer } from "@/hooks/useSessionTimer"
import { ControlBar } from "@/components/controls/ControlBar"
import { RepoBranch, RunDuration, StatusIndicator } from "@/components/layout"

/**
 * Footer status bar showing connection status, workspace path, current task, agent controls, token usage, and context window progress.
 */
export function StatusBar({
  connectionStatus,
  workspacePath,
  events,
  error,
  controlState,
  isStoppingAfterCurrent,
  onStart,
  onPause,
  onResume,
  onStop,
  onStopAfterCurrent,
  onCancelStopAfterCurrent,
  currentTaskId,
  currentTaskTitle,
  workspaceName,
  branch,
}: StatusBarProps) {
  const tokenUsage = useTokenUsage(events)
  const contextWindow = useContextWindow(events)
  const { elapsedMs } = useSessionTimer(events)

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

        {/* Agent controls - full ControlBar with Start/Pause/Stop/Stop-after-current */}
        {controlState && (
          <div className="border-l border-border pl-3">
            <ControlBar
              controlState={controlState}
              isConnected={connectionStatus === "connected"}
              isStoppingAfterCurrent={isStoppingAfterCurrent}
              onStart={onStart}
              onPause={onPause}
              onResume={onResume}
              onStop={onStop}
              onStopAfterCurrent={onStopAfterCurrent}
              onCancelStopAfterCurrent={onCancelStopAfterCurrent}
            />
          </div>
        )}

        {/* Status indicator - shows Running/Paused/Stopped with colored dot */}
        {controlState && (
          <StatusIndicator
            controlState={controlState}
            isStoppingAfterCurrent={isStoppingAfterCurrent}
            className="border-l border-border pl-3"
          />
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

        {/* Workspace name and branch */}
        {(workspaceName || branch) && (
          <RepoBranch
            workspaceName={workspaceName}
            branch={branch}
            workspacePath={workspacePath}
            className="border-l border-border pl-3"
          />
        )}

        {/* Error */}
        {error && <span className="border-l border-border pl-3 text-red-500">{error}</span>}
      </div>

      {/* Right section: session timer, token usage, and context window */}
      <div className="flex items-center pr-4">
        {/* Session timer */}
        <RunDuration elapsedMs={elapsedMs} className="border-r border-border pr-4" />

        {/* Token usage */}
        {(tokenUsage.input > 0 || tokenUsage.output > 0) && (
          <div className="border-r border-border pr-4">
            <TokenUsageDisplay tokenUsage={tokenUsage} />
          </div>
        )}

        {/* Context window */}
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
  /** Whether currently stopping after the current task. */
  isStoppingAfterCurrent?: boolean
  /** Called when start button is clicked. */
  onStart?: () => void
  /** Called when pause button is clicked. */
  onPause?: () => void
  /** Called when resume button is clicked. */
  onResume?: () => void
  /** Called when stop button is clicked. */
  onStop?: () => void
  /** Called when stop-after-current button is clicked. */
  onStopAfterCurrent?: () => void
  /** Called when cancel-stop-after-current button is clicked. */
  onCancelStopAfterCurrent?: () => void
  /** ID of the current task being worked on. */
  currentTaskId?: string | null
  /** Title of the current task being worked on. */
  currentTaskTitle?: string | null
  /** Workspace name. */
  workspaceName?: string | null
  /** Git branch name. */
  branch?: string | null
}
