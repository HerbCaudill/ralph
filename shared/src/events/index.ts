/**
 * Agent Events - Shared event types and type guards
 *
 * This module provides the normalized event types used to communicate
 * between agent backends and consumers. All agent adapters emit events
 * in this format, allowing UI/CLI code to handle events uniformly
 * regardless of which agent backend is being used.
 */

// Types
export type {
  AgentEvent,
  AgentEventBase,
  AgentMessageEvent,
  AgentToolUseEvent,
  AgentToolResultEvent,
  AgentResultEvent,
  AgentErrorEvent,
  AgentStatusEvent,
  AgentStatus,
} from "./types.js"

// Type guards
export {
  isAgentMessageEvent,
  isAgentToolUseEvent,
  isAgentToolResultEvent,
  isAgentResultEvent,
  isAgentErrorEvent,
  isAgentStatusEvent,
} from "./guards.js"
