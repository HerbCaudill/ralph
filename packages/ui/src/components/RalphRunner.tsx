import {
  AgentView,
  ChatInput,
  SessionPicker,
  TokenUsageDisplay,
  ContextWindowProgress,
  useTokenUsage,
  useContextWindow,
  useAdapterInfo,
  useDetectedModel,
  formatModelName,
  type AgentType,
  type ChatEvent,
  type ControlState,
  type AgentViewContextValue,
  type ConnectionStatus,
  type SessionIndexEntry,
} from "@herbcaudill/agent-view"
import { IconPlayerPlayFilled, IconRobot, IconHistory } from "@tabler/icons-react"
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
  sessions = [],
  sessionId,
  taskId,
  taskTitle,
  isViewingHistoricalSession = false,
  agentType = "claude",
  context,
  onSendMessage,
  onStart,
  onResume,
  onPause,
  onStopAfterCurrent,
  onCancelStopAfterCurrent,
  onNewSession: _onNewSession, // Kept for API compatibility, will be used by subtask r-0p41v.5
  onSelectSession,
  className,
}: RalphRunnerProps) {
  const tokenUsage = useTokenUsage(events)
  const contextWindow = useContextWindow(events)
  const { elapsedMs } = useSessionTimer(events)
  const { model: adapterModel } = useAdapterInfo(agentType)
  // Prefer model detected from streaming events; fall back to adapter info for initial state
  const detectedModel = useDetectedModel(events)
  const modelName = formatModelName(detectedModel ?? adapterModel)

  /** Capitalized adapter display name (e.g. "Claude", "Codex"). */
  const adapterDisplayName = agentType.charAt(0).toUpperCase() + agentType.slice(1)

  const isConnected = connectionStatus === "connected"
  const showIdleState = controlState === "idle"

  // Chat is only disabled when viewing historical sessions or disconnected
  const isChatDisabled = isViewingHistoricalSession || !isConnected

  // Header with robot icon, session picker (includes task info), and history badge
  const header = (
    <div className="flex items-center justify-between border-b border-border px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <IconRobot size={18} stroke={1.5} className="shrink-0 text-muted-foreground" />
        <SessionPicker
          sessions={sessions}
          currentSessionId={sessionId}
          onSelectSession={onSelectSession ?? (() => {})}
          taskId={taskId}
          taskTitle={taskTitle}
        />
      </div>
      {isViewingHistoricalSession && (
        <span className="flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          <IconHistory size={12} stroke={1.5} />
          Viewing history
        </span>
      )}
    </div>
  )

  // Empty state shown when idle and no events — prominent start button
  const idleEmptyState =
    showIdleState ?
      <div className="flex h-full items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4">
          <IconRobot size={48} stroke={1.5} className="text-muted-foreground" />
          <div className="text-center">
            <div className="text-lg font-medium text-foreground">Ralph is not running</div>
            <div className="text-sm text-muted-foreground">
              Click Start to begin working on open tasks
            </div>
          </div>
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
        header={header}
        emptyState={idleEmptyState}
        className="flex-1"
      />

      {/* Bottom bar: comprehensive controls and chat input */}
      <div className="flex flex-col border-t border-border">
        {/* Chat input - show when session is active */}
        {controlState !== "idle" && (
          <ChatInput
            onSend={onSendMessage}
            disabled={isChatDisabled}
            placeholder={
              isViewingHistoricalSession ? "Switch to current session to send messages"
              : !isConnected ?
                "Waiting for connection..."
              : "Send a message…"
            }
            storageKey="ralph-runner-chat-draft"
          />
        )}

        {/* Status bar footer */}
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs">
          {/* Left section: controls + status */}
          <div className="flex items-center gap-3">
            {/* Control bar with Start/Resume/Pause/Stop-after-current buttons */}
            <ControlBar
              controlState={controlState}
              isConnected={isConnected}
              isStoppingAfterCurrent={isStoppingAfterCurrent}
              onStart={onStart}
              onResume={onResume}
              onPause={onPause}
              onStopAfterCurrent={onStopAfterCurrent}
              onCancelStopAfterCurrent={onCancelStopAfterCurrent}
            />

            {/* Status indicator - shows Running/Idle with colored dot */}
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
            {/* Agent adapter and model */}
            <span
              data-testid="agent-info"
              className="border-r border-border pr-4 text-muted-foreground"
            >
              {adapterDisplayName}
              {modelName && ` (${modelName})`}
            </span>

            {/* Workspace name and branch */}
            {(workspaceName || branch) && (
              <RepoBranch
                workspaceName={workspaceName}
                branch={branch}
                workspacePath={workspacePath}
                className="border-r border-border px-4"
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
  /** Whether currently stopping after the current session. */
  isStoppingAfterCurrent?: boolean
  /** List of available sessions for the session picker. */
  sessions?: SessionIndexEntry[]
  /** Current session ID. */
  sessionId?: string | null
  /** Current task ID being worked on (from task lifecycle events). */
  taskId?: string | null
  /** Title of the current task being worked on. */
  taskTitle?: string | null
  /** Whether viewing a historical session (not the current active one). */
  isViewingHistoricalSession?: boolean
  /** Agent adapter type, used to fetch adapter info for display. Defaults to "claude". */
  agentType?: AgentType
  /** Context configuration passed to AgentViewProvider. */
  context?: Partial<AgentViewContextValue>
  /** Called when the user sends a message via the chat input. */
  onSendMessage: (message: string) => void
  /** Called when start button is clicked (from idle state). */
  onStart?: () => void
  /** Called when resume button is clicked (from paused state). */
  onResume?: () => void
  /** Called when the pause button is clicked. */
  onPause: () => void
  /** Called when stop-after-current button is clicked. */
  onStopAfterCurrent?: () => void
  /** Called when cancel-stop-after-current button is clicked. */
  onCancelStopAfterCurrent?: () => void
  /** Called when the new session button is clicked. */
  onNewSession: () => void
  /** Called when a session is selected from the session picker. */
  onSelectSession?: (sessionId: string) => void
  /** Additional CSS classes for the container. */
  className?: string
}
