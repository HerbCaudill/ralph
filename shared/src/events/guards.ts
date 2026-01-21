/**
 * Type Guards for Agent Events
 *
 * Type-safe predicates for narrowing AgentEvent to specific event types.
 */

import type {
  AgentEvent,
  AgentMessageEvent,
  AgentToolUseEvent,
  AgentToolResultEvent,
  AgentResultEvent,
  AgentErrorEvent,
  AgentStatusEvent,
} from "./types.js"

/**
 * Check if an event is a message event.
 */
export function isAgentMessageEvent(event: AgentEvent): event is AgentMessageEvent {
  return event.type === "message"
}

/**
 * Check if an event is a tool use event.
 */
export function isAgentToolUseEvent(event: AgentEvent): event is AgentToolUseEvent {
  return event.type === "tool_use"
}

/**
 * Check if an event is a tool result event.
 */
export function isAgentToolResultEvent(event: AgentEvent): event is AgentToolResultEvent {
  return event.type === "tool_result"
}

/**
 * Check if an event is a result event.
 */
export function isAgentResultEvent(event: AgentEvent): event is AgentResultEvent {
  return event.type === "result"
}

/**
 * Check if an event is an error event.
 */
export function isAgentErrorEvent(event: AgentEvent): event is AgentErrorEvent {
  return event.type === "error"
}

/**
 * Check if an event is a status event.
 */
export function isAgentStatusEvent(event: AgentEvent): event is AgentStatusEvent {
  return event.type === "status"
}
