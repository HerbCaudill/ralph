/**
 * Re-export TaskChatManager and related types from @herbcaudill/agent-server.
 * These were extracted to agent-server as the canonical location.
 */
export {
  TaskChatManager,
  type TaskChatStatus,
  type TaskChatMessage,
  type TaskChatEvent,
  type TaskChatToolUse,
  type GetBdProxyFn,
  type TaskChatManagerOptions,
} from "@herbcaudill/agent-server"
