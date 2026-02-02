/**
 * Re-export AgentAdapter and related types from @herbcaudill/ralph-server.
 * These were extracted to agent-server as the canonical location.
 */
export {
  AgentAdapter,
  type AgentStartOptions,
  type AgentMessage,
  type AgentInfo,
  type AgentAdapterEvents,
  type ConversationContext,
  type ConversationMessage,
} from "@herbcaudill/ralph-server"

// Re-export event types from shared package for backward compatibility
export type {
  AgentEvent,
  AgentMessageEvent,
  AgentThinkingEvent,
  AgentToolUseEvent,
  AgentToolResultEvent,
  AgentResultEvent,
  AgentErrorEvent,
  AgentStatusEvent,
  AgentStatus,
} from "@herbcaudill/ralph-shared"

// Re-export type guards from shared package
export {
  isAgentMessageEvent,
  isAgentThinkingEvent,
  isAgentToolUseEvent,
  isAgentToolResultEvent,
  isAgentResultEvent,
  isAgentErrorEvent,
  isAgentStatusEvent,
} from "@herbcaudill/ralph-shared"
