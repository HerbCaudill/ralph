import {
  AgentView,
  AgentControls,
  ChatInput,
  type ChatEvent,
  type ControlState,
  type AgentViewContextValue,
} from "@herbcaudill/agent-view"

/**
 * Main Ralph agent display panel showing the event stream, agent controls, and chat input.
 * Combines AgentView, AgentControls, and ChatInput into a cohesive interface for
 * interacting with an AI coding agent.
 */
export function RalphRunner({
  events,
  isStreaming,
  controlState,
  context,
  onSendMessage,
  onPause,
  onResume,
  onStop,
  onNewSession,
  className,
}: RalphRunnerProps) {
  return (
    <div className={className ?? "flex h-full flex-col"}>
      {/* Event stream display */}
      <AgentView events={events} isStreaming={isStreaming} context={context} className="flex-1" />

      {/* Bottom bar: controls and chat input */}
      <div className="flex flex-col border-t border-border">
        {/* Agent controls row */}
        <div className="flex items-center justify-end border-b border-border px-4 py-2">
          <AgentControls
            state={controlState}
            onPause={onPause}
            onResume={onResume}
            onStop={onStop}
            onNewSession={onNewSession}
            size="sm"
          />
        </div>

        {/* Chat input */}
        <ChatInput onSend={onSendMessage} disabled={isStreaming} placeholder="Send a message…" />
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
  /** Context configuration passed to AgentViewProvider. */
  context?: Partial<AgentViewContextValue>
  /** Called when the user sends a message via the chat input. */
  onSendMessage: (message: string) => void
  /** Called when the pause button is clicked. */
  onPause: () => void
  /** Called when the resume button is clicked. */
  onResume: () => void
  /** Called when the stop button is clicked. */
  onStop: () => void
  /** Called when the new session button is clicked. */
  onNewSession: () => void
  /** Additional CSS classes for the container. */
  className?: string
}
