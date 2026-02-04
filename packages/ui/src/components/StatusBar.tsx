import {
  useTokenUsage,
  useContextWindow,
  TokenUsageDisplay,
  ContextWindowProgress,
} from "@herbcaudill/agent-view"
import type { ChatEvent, ConnectionStatus, ControlState } from "@herbcaudill/agent-view"
import { useSessionTimer } from "@/hooks/useSessionTimer"
import { ControlBar } from "@/components/ControlBar"
import { RepoBranch } from "@/components/RepoBranch"
import { RunDuration } from "@/components/RunDuration"
import { SessionProgress } from "@/components/SessionProgress"
import { StatusIndicator } from "@/components/StatusIndicator"
import type { TaskCardTask } from "@herbcaudill/beads-view"

/**
 * Footer status bar showing agent controls, status, session duration, repo info, token usage, context window, and session progress.
 *
 * Layout: [ControlBar] [StatusIndicator] [RunDuration] | [RepoBranch] [TokenUsage] [ContextWindow] [SessionProgress]
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
  workspaceName,
  branch,
  tasks,
  accentColor,
}: StatusBarProps) {
  const tokenUsage = useTokenUsage(events)
  const contextWindow = useContextWindow(events)
  const { elapsedMs } = useSessionTimer(events)

  return (
    <div className="flex w-full items-center justify-between">
      {/* Left section: controls + status */}
      <div className="flex items-center gap-3 pl-4">
        {/* Agent controls - full ControlBar with Start/Pause/Stop/Stop-after-current */}
        {controlState && (
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
        )}

        {/* Status indicator - shows Running/Paused/Stopped with colored dot */}
        {controlState && (
          <StatusIndicator
            controlState={controlState}
            isStoppingAfterCurrent={isStoppingAfterCurrent}
            className="border-l border-border pl-3"
          />
        )}

        {/* Session timer */}
        <RunDuration elapsedMs={elapsedMs} className="border-l border-border pl-3" />

        {/* Error */}
        {error && <span className="border-l border-border pl-3 text-red-500">{error}</span>}
      </div>

      {/* Right section: info displays */}
      <div className="flex items-center pr-4">
        {/* Workspace name and branch */}
        {(workspaceName || branch) && (
          <RepoBranch
            workspaceName={workspaceName}
            branch={branch}
            workspacePath={workspacePath}
            className="border-r border-border pr-4"
          />
        )}

        {/* Token usage */}
        {(tokenUsage.input > 0 || tokenUsage.output > 0) && (
          <div className="border-r border-border pr-4">
            <TokenUsageDisplay tokenUsage={tokenUsage} />
          </div>
        )}

        {/* Context window */}
        <div className="border-r border-border pr-4">
          <ContextWindowProgress contextWindow={contextWindow} />
        </div>

        {/* Session progress - task completion progress bar */}
        {tasks && tasks.length > 0 && (
          <SessionProgress tasks={tasks} accentColor={accentColor} className="pl-4" />
        )}
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
  /** Workspace name. */
  workspaceName?: string | null
  /** Git branch name. */
  branch?: string | null
  /** Tasks for session progress calculation. */
  tasks?: TaskCardTask[]
  /** Accent color for the progress bar. */
  accentColor?: string | null
}
