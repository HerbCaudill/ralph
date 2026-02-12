/**
 * Backward-compatible re-exports of agent event types.
 *
 * Core event types (AgentEvent, AgentMessageEvent, etc.) are now defined in
 * @herbcaudill/agent-view using Effect Schema as the single source of truth.
 * This module re-exports them under their original `Agent*` names for backward
 * compatibility.
 */

import type {
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

// Utility: make canonical types backward-compatible

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

// Re-export core event types from agent-view with backward-compatible names

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

/** Possible agent statuses. */
export type AgentStatus = CanonicalAgentStatus
