/**  Base properties for all agent events. */
export interface AgentEventBase {
  /** Event timestamp in milliseconds */
  timestamp: number
  /** Optional event ID for correlation */
  id?: string
}

/**  A text message from the assistant. */
export interface AgentMessageEvent extends AgentEventBase {
  type: "message"
  /** The message content */
  content: string
  /** Whether this is a partial/streaming message */
  isPartial?: boolean
}

/**  A tool invocation by the assistant. */
export interface AgentToolUseEvent extends AgentEventBase {
  type: "tool_use"
  /** Unique ID for this tool use (for correlating with tool_result) */
  toolUseId: string
  /** Name of the tool being used */
  tool: string
  /** Tool input parameters */
  input: Record<string, unknown>
}

/**  The result of a tool invocation. */
export interface AgentToolResultEvent extends AgentEventBase {
  type: "tool_result"
  /** ID of the corresponding tool_use event */
  toolUseId: string
  /** Tool output (success case) */
  output?: string
  /** Error message (error case) */
  error?: string
  /** Whether this result is an error */
  isError: boolean
}

/**  Final result of an agent run. */
export interface AgentResultEvent extends AgentEventBase {
  type: "result"
  /** The final text output from the agent */
  content: string
  /** Exit code if applicable */
  exitCode?: number
  /** Usage statistics */
  usage?: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
  }
}

/**  An error from the agent. */
export interface AgentErrorEvent extends AgentEventBase {
  type: "error"
  /** Error message */
  message: string
  /** Error code if applicable */
  code?: string
  /** Whether this error is fatal (agent cannot continue) */
  fatal: boolean
}

/**  A thinking block from the assistant (extended thinking). */
export interface AgentThinkingEvent extends AgentEventBase {
  type: "thinking"
  /** The thinking content */
  content: string
  /** Whether this is a partial/streaming thinking block */
  isPartial?: boolean
}

/**  Agent status changed. */
export interface AgentStatusEvent extends AgentEventBase {
  type: "status"
  /** The new status */
  status: AgentStatus
}

/**  Union type for all normalized agent events. */
export type AgentEvent =
  | AgentMessageEvent
  | AgentThinkingEvent
  | AgentToolUseEvent
  | AgentToolResultEvent
  | AgentResultEvent
  | AgentErrorEvent
  | AgentStatusEvent

/**  Possible agent statuses. */
export type AgentStatus = "idle" | "starting" | "running" | "paused" | "stopping" | "stopped"

// ---------------------------------------------------------------------------
// Unified wire message envelope
// ---------------------------------------------------------------------------

/** Source of the agent event — distinguishes Ralph session events from Task Chat events. */
export type AgentEventSource = "ralph" | "task-chat"

/**
 * Unified WebSocket wire message envelope for all agent events.
 *
 * Both Ralph session events and Task Chat events share this common envelope
 * when broadcast over the WebSocket connection. The `source` field discriminates
 * between the two origins while keeping a single message type (`"agent:event"`)
 * on the wire.
 *
 * This replaces the previous divergent schemas where Ralph used `"ralph:event"`
 * and Task Chat used `"task-chat:event"` with different payload shapes.
 */
export interface AgentEventEnvelope {
  /** Wire message type — always `"agent:event"` for this envelope. */
  type: "agent:event"

  /** Which subsystem produced this event. */
  source: AgentEventSource

  /** Instance this event belongs to (for routing to the correct Ralph instance). */
  instanceId: string

  /** Workspace identifier (null for the main/default workspace). */
  workspaceId: string | null

  /** The normalized agent event payload. */
  event: AgentEvent

  /** Server-side timestamp (ms) when the message was broadcast. */
  timestamp: number

  /**
   * Monotonically increasing index for reconnection sync.
   * Clients can send the last received `eventIndex` on reconnect to resume
   * from where they left off, avoiding duplicate or missed events.
   */
  eventIndex?: number
}
