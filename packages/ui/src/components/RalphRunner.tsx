import {
  AgentView,
  ChatInput,
  TokenUsageDisplay,
  ContextWindowProgress,
  useTokenUsage,
  useContextWindow,
  type ChatEvent,
  type ControlState,
  type AgentViewContextValue,
  type ConnectionStatus,
} from "@herbcaudill/agent-view"
import { IconPlayerPlayFilled, IconRobot } from "@tabler/icons-react"
import { ControlBar } from "@/components/ControlBar"
import { RepoBranch } from "@/components/RepoBranch"
import { RunDuration } from "@/components/RunDuration"
import { StatusIndicator } from "@/components/StatusIndicator"
import { useSessionTimer } from "@/hooks/useSessionTimer"

/**
 * Main Ralph agent display panel showing the event stream, comprehensive controls, and chat input.
 * Combines AgentView with full status bar footer including: play/pause/stop controls,
 * status indicator, session timer, repo/branch info, token usage, and context window.
 */
export function RalphRunner({
  events,
  isStreaming,
  controlState,
  connectionStatus,
  workspaceName,
  branch,
  workspacePath,
  isStoppingAfterCurrent = false,
  context,
  onSendMessage,
  onStart,
  onPause,
  onResume,
  onStop,
  onStopAfterCurrent,
  onCancelStopAfterCurrent,
  onNewSession: _onNewSession, // Kept for API compatibility, will be used by subtask r-0p41v.5
  className,
}: RalphRunnerProps) {
  const tokenUsage = useTokenUsage(events)
  const contextWindow = useContextWindow(events)
  const { elapsedMs } = useSessionTimer(events)

  const isConnected = connectionStatus === "connected"
  const showIdleState = controlState === "idle"

  // Empty state shown when idle and no events — prominent start button
  const idleEmptyState =
    showIdleState ?
      <div className="flex h-full items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <IconRobot size={48} stroke={1.5} />
          <p className="text-center text-sm">
            Start the Ralph loop to begin autonomous task execution.
          </p>
          <button
            onClick={onStart}
            disabled={!isConnected}
            aria-label="Start Ralph"
            className="mt-4 flex items-center gap-2 rounded-lg bg-green-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <IconPlayerPlayFilled size={20} />
            Start
          </button>
        </div>
      </div>
    : undefined

  return (
    <div className={className ?? "flex h-full flex-col"}>
      {/* Event stream display */}
      <AgentView
        events={events}
        isStreaming={isStreaming}
        context={context}
        emptyState={idleEmptyState}
        className="flex-1"
      />

      {/* Bottom bar: comprehensive controls and chat input */}
      <div className="flex flex-col border-t border-border">
        {/* Chat input - only show when session is active */}
        {controlState !== "idle" && (
          <ChatInput onSend={onSendMessage} disabled={isStreaming} placeholder="Send a message…" />
        )}

        {/* Status bar footer */}
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs">
          {/* Left section: controls + status */}
          <div className="flex items-center gap-3">
            {/* Full control bar with Start/Pause/Stop/Stop-after-current */}
            <ControlBar
              controlState={controlState}
              isConnected={isConnected}
              isStoppingAfterCurrent={isStoppingAfterCurrent}
              onStart={onStart}
              onPause={onPause}
              onResume={onResume}
              onStop={onStop}
              onStopAfterCurrent={onStopAfterCurrent}
              onCancelStopAfterCurrent={onCancelStopAfterCurrent}
            />

            {/* Status indicator - shows Running/Paused/Stopped with colored dot */}
            <StatusIndicator
              controlState={controlState}
              isStoppingAfterCurrent={isStoppingAfterCurrent}
              className="border-l border-border pl-3"
            />

            {/* Session timer */}
            <RunDuration elapsedMs={elapsedMs} className="border-l border-border pl-3" />
          </div>

          {/* Right section: info displays */}
          <div className="flex items-center">
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
              <div className="border-r border-border px-4">
                <TokenUsageDisplay tokenUsage={tokenUsage} />
              </div>
            )}

            {/* Context window */}
            <div className="pl-4">
              <ContextWindowProgress contextWindow={contextWindow} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export type RalphRunnerProps = {
  /** Events to display in the event stream. */
  events: ChatEvent[]
  /** Whether the agent is currently streaming/active. */
  isStreaming: boolean
  /** Current control state (idle, running, or paused). */
  controlState: ControlState
  /** Connection status to the agent server. */
  connectionStatus: ConnectionStatus
  /** Workspace/repository name. */
  workspaceName?: string | null
  /** Git branch name. */
  branch?: string | null
  /** Full path to the workspace (shown in tooltip). */
  workspacePath?: string | null
  /** Whether currently stopping after the current task. */
  isStoppingAfterCurrent?: boolean
  /** Context configuration passed to AgentViewProvider. */
  context?: Partial<AgentViewContextValue>
  /** Called when the user sends a message via the chat input. */
  onSendMessage: (message: string) => void
  /** Called when start button is clicked. */
  onStart?: () => void
  /** Called when the pause button is clicked. */
  onPause: () => void
  /** Called when the resume button is clicked. */
  onResume: () => void
  /** Called when the stop button is clicked. */
  onStop: () => void
  /** Called when stop-after-current button is clicked. */
  onStopAfterCurrent?: () => void
  /** Called when cancel-stop-after-current button is clicked. */
  onCancelStopAfterCurrent?: () => void
  /** Called when the new session button is clicked. */
  onNewSession: () => void
  /** Additional CSS classes for the container. */
  className?: string
}
