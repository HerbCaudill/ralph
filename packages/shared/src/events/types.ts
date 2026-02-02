/**
 * Event types for the Ralph wire protocol and backward-compatible re-exports.
 *
 * Core event types (AgentEvent, AgentMessageEvent, etc.) are now defined in
 * @herbcaudill/agent-view using Effect Schema as the single source of truth.
 * This module re-exports them under their original `Agent*` names for backward
 * compatibility, and defines the wire protocol types (envelope, reconnection)
 * that are specific to Ralph's WebSocket transport.
 */

import type {
  CanonicalEventType,
  MessageEventType,
  ThinkingEventType,
  ToolUseEventType,
  ToolResultEventType,
  ResultEventType,
  ErrorEventType,
  StatusEventType,
  BaseEventType,
  AgentStatus as CanonicalAgentStatus,
} from "@herbcaudill/agent-view"

// ---------------------------------------------------------------------------
// Utility: make canonical types backward-compatible
// ---------------------------------------------------------------------------

/**
 * Makes `id` optional and removes `readonly` modifiers for backward compatibility.
 *
 * The canonical types from agent-view require `id` (auto-generated via Effect
 * Schema defaults during decoding) and use `readonly` properties. Existing code
 * creates events without `id` and expects mutable properties, so the
 * backward-compatible aliases relax these constraints.
 */
type BackwardCompat<T> = { -readonly [K in keyof T as K extends "id" ? never : K]: T[K] } & {
  id?: string
}

// ---------------------------------------------------------------------------
// Re-export core event types from agent-view with backward-compatible names
// ---------------------------------------------------------------------------

/**  Base properties for all agent events. */
export type AgentEventBase = BackwardCompat<BaseEventType>

/**  A text message from the assistant. */
export type AgentMessageEvent = BackwardCompat<MessageEventType>

/**  A thinking block from the assistant (extended thinking). */
export type AgentThinkingEvent = BackwardCompat<ThinkingEventType>

/**  A tool invocation by the assistant. */
export type AgentToolUseEvent = BackwardCompat<ToolUseEventType>

/**  The result of a tool invocation. */
export type AgentToolResultEvent = BackwardCompat<ToolResultEventType>

/**  Final result of an agent run. */
export type AgentResultEvent = BackwardCompat<ResultEventType>

/**  An error from the agent. */
export type AgentErrorEvent = BackwardCompat<ErrorEventType>

/**  Agent status changed. */
export type AgentStatusEvent = BackwardCompat<StatusEventType>

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
export type AgentStatus = CanonicalAgentStatus

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

// ---------------------------------------------------------------------------
// Unified reconnection wire messages
// ---------------------------------------------------------------------------

/**
 * Client → Server reconnection request.
 *
 * Sent on WebSocket open to request events missed while disconnected.
 * The `source` field tells the server which subsystem to query (Ralph
 * in-memory history or Task Chat disk persister).  Both sources share the
 * same wire message type (`"agent:reconnect"`), replacing the previous
 * divergent `"reconnect"` / `"task-chat:reconnect"` message types.
 */
export interface AgentReconnectRequest {
  /** Wire message type — always `"agent:reconnect"`. */
  type: "agent:reconnect"

  /** Which subsystem to query for missed events. */
  source: AgentEventSource

  /** Instance to retrieve events for. */
  instanceId: string

  /**
   * Last event timestamp (ms) the client received.
   * The server returns events with `timestamp > lastEventTimestamp`.
   * If omitted or 0, the server returns the full event history.
   */
  lastEventTimestamp?: number
}

/**
 * Server → Client reconnection response.
 *
 * Contains the events the client missed while disconnected, along with
 * diagnostic metadata.  Both Ralph and Task Chat events use the same
 * response envelope (`"agent:pending_events"`), replacing the previous
 * divergent `"pending_events"` / `"task-chat:pending_events"` types.
 */
export interface AgentPendingEventsResponse {
  /** Wire message type — always `"agent:pending_events"`. */
  type: "agent:pending_events"

  /** Which subsystem produced these events. */
  source: AgentEventSource

  /** Instance the events belong to. */
  instanceId: string

  /** Events the client missed, ordered by timestamp ascending. */
  events: Array<{ type: string; timestamp: number; [key: string]: unknown }>

  /** Total number of events the server has for this instance (diagnostic). */
  totalEvents: number

  /** Current agent status for this source/instance. */
  status: string

  /** Server-side timestamp (ms) when this response was sent. */
  timestamp: number
}
