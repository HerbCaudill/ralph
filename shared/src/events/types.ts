/**
 * Normalized Agent Event Types
 *
 * These types define the standard event format used to communicate
 * between agent backends (Claude CLI, Codex CLI, etc.) and consumers
 * (CLI, UI, etc.). All agent adapters translate their native events
 * into these normalized types.
 */

/**
 * Base properties for all agent events.
 */
export interface AgentEventBase {
  /** Event timestamp in milliseconds */
  timestamp: number
  /** Optional event ID for correlation */
  id?: string
}

/**
 * A text message from the assistant.
 */
export interface AgentMessageEvent extends AgentEventBase {
  type: "message"
  /** The message content */
  content: string
  /** Whether this is a partial/streaming message */
  isPartial?: boolean
}

/**
 * A tool invocation by the assistant.
 */
export interface AgentToolUseEvent extends AgentEventBase {
  type: "tool_use"
  /** Unique ID for this tool use (for correlating with tool_result) */
  toolUseId: string
  /** Name of the tool being used */
  tool: string
  /** Tool input parameters */
  input: Record<string, unknown>
}

/**
 * The result of a tool invocation.
 */
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

/**
 * Final result of an agent run.
 */
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

/**
 * An error from the agent.
 */
export interface AgentErrorEvent extends AgentEventBase {
  type: "error"
  /** Error message */
  message: string
  /** Error code if applicable */
  code?: string
  /** Whether this error is fatal (agent cannot continue) */
  fatal: boolean
}

/**
 * Agent status changed.
 */
export interface AgentStatusEvent extends AgentEventBase {
  type: "status"
  /** The new status */
  status: AgentStatus
}

/**
 * Union type for all normalized agent events.
 */
export type AgentEvent =
  | AgentMessageEvent
  | AgentToolUseEvent
  | AgentToolResultEvent
  | AgentResultEvent
  | AgentErrorEvent
  | AgentStatusEvent

/**
 * Possible agent statuses.
 */
export type AgentStatus = "idle" | "starting" | "running" | "paused" | "stopping" | "stopped"
