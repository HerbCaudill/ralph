import {
  IconRobot,
  IconPlugConnected,
  IconPlugConnectedX,
  IconLoader2,
  IconHistory,
  IconPlayerPlayFilled,
} from "@tabler/icons-react"
import {
  AgentView,
  AgentViewProvider,
  SessionPicker,
  ChatInput,
  TokenUsageDisplay,
  ContextWindowProgress,
  useTokenUsage,
  useContextWindow,
} from "@herbcaudill/agent-view"
import { TopologySpinner } from "./TopologySpinner"
import type {
  ChatEvent,
  ControlState,
  ConnectionStatus,
  SessionIndexEntry,
  TokenUsage,
  ContextWindow,
} from "@herbcaudill/agent-view"

/**
 * Full-featured Ralph loop panel with session history, agent controls, and status bar.
 * This is the main panel for viewing and interacting with the Ralph autonomous agent loop.
 */
export function RalphLoopPanel({
  events,
  isStreaming,
  controlState,
  connectionStatus,
  sessionId,
  sessions,
  error,
  isViewingHistoricalSession = false,
  onSendMessage,
  onPause: _onPause,
  onResume: _onResume,
  onStop: _onStop,
  onStart,
  onNewSession: _onNewSession,
  onSelectSession,
  className,
}: RalphLoopPanelProps) {
  const tokenUsage = useTokenUsage(events)
  const contextWindow = useContextWindow(events)

  const isConnected = connectionStatus === "connected"
  const isSessionActive = controlState !== "idle"
  const isChatDisabled = isStreaming || isViewingHistoricalSession || !isConnected

  // Header with title and session picker
  const header = (
    <div className="flex items-center justify-between border-b border-border px-4 py-3">
      <div className="flex items-center gap-2">
        <IconRobot size={18} stroke={1.5} className="text-muted-foreground" />
        <span className="text-sm font-medium">Ralph Loop</span>
        {isViewingHistoricalSession && (
          <span className="flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            <IconHistory size={12} stroke={1.5} />
            Viewing history
          </span>
        )}
      </div>
      <SessionPicker
        sessions={sessions}
        currentSessionId={sessionId}
        onSelectSession={onSelectSession}
        disabled={isStreaming}
      />
    </div>
  )

  // Empty state shown when no events - shows start button when idle
  const showStartButton = controlState === "idle"
  const emptyState = (
    <div className="flex h-full items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4">
        <IconRobot size={48} stroke={1.5} className="text-muted-foreground" />
        <div className="text-center">
          <div className="text-lg font-medium text-foreground">Ralph is not running</div>
          <div className="text-sm text-muted-foreground">
            Click Start to begin working on open tasks
          </div>
        </div>
        {showStartButton && (
          <button
            onClick={onStart}
            disabled={!isConnected}
            aria-label="Start Ralph"
            className="mt-4 flex items-center gap-2 rounded-lg bg-green-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <IconPlayerPlayFilled size={20} />
            Start
          </button>
        )}
      </div>
    </div>
  )

  // Footer with chat input and status bar
  const footer = (
    <div className="flex flex-col border-t border-border">
      {/* Chat input - only show when there's an active session */}
      {isSessionActive && (
        <ChatInput
          onSend={onSendMessage}
          disabled={isChatDisabled}
          placeholder={
            isViewingHistoricalSession ? "Switch to current session to send messages"
            : !isConnected ?
              "Waiting for connection..."
            : "Send a message…"
          }
        />
      )}

      {/* Status bar */}
      <StatusBarFooter
        connectionStatus={connectionStatus}
        tokenUsage={tokenUsage}
        contextWindow={contextWindow}
        error={error}
      />
    </div>
  )

  return (
    <div className={className ?? "flex h-full flex-col"}>
      <AgentViewProvider>
        <AgentView
          events={events}
          isStreaming={isStreaming}
          spinner={<TopologySpinner />}
          header={header}
          footer={footer}
          emptyState={emptyState}
          className="flex-1"
        />
      </AgentViewProvider>
    </div>
  )
}

/**
 * Status bar footer showing connection status, token usage, and context window.
 */
function StatusBarFooter({
  connectionStatus,
  tokenUsage,
  contextWindow,
  error,
}: {
  connectionStatus: ConnectionStatus
  tokenUsage: TokenUsage
  contextWindow: ContextWindow
  error: string | null
}) {
  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
      {/* Left: connection status and error */}
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1">
          {connectionStatus === "connected" ?
            <IconPlugConnected size={14} stroke={1.5} className="text-green-600" />
          : connectionStatus === "connecting" ?
            <IconLoader2 size={14} stroke={1.5} className="animate-spin text-amber-500" />
          : <IconPlugConnectedX size={14} stroke={1.5} className="text-red-500" />}
          <span className="capitalize">{connectionStatus}</span>
        </span>
        {error && <span className="border-l border-border pl-3 text-red-500">{error}</span>}
      </div>

      {/* Right: token usage and context window */}
      <div className="flex items-center">
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

export type RalphLoopPanelProps = {
  /** Events to display in the event stream. */
  events: ChatEvent[]
  /** Whether the agent is currently streaming/active. */
  isStreaming: boolean
  /** Current control state (idle, running, or paused). */
  controlState: ControlState
  /** Status of the connection to the agent server. */
  connectionStatus: ConnectionStatus
  /** Current session ID. */
  sessionId: string | null
  /** List of available sessions for the session picker. */
  sessions: SessionIndexEntry[]
  /** Error message to display, if any. */
  error: string | null
  /** Whether viewing a historical session (not the current active one). */
  isViewingHistoricalSession?: boolean
  /** Called when the user sends a message via the chat input. */
  onSendMessage: (message: string) => void
  /** Called when the pause button is clicked. */
  onPause: () => void
  /** Called when the resume button is clicked. */
  onResume: () => void
  /** Called when the stop button is clicked. */
  onStop: () => void
  /** Called when the start button is clicked (in the empty state). */
  onStart: () => void
  /** Called when the new session button is clicked. */
  onNewSession: () => void
  /** Called when a session is selected from the session picker. */
  onSelectSession: (sessionId: string) => void
  /** Additional CSS classes for the container. */
  className?: string
}
