/**
 * Re-export ClaudeAdapter and related types from @herbcaudill/agent-server.
 * These were extracted to agent-server as the canonical location.
 */
export {
  ClaudeAdapter,
  buildCwdContext,
  type ClaudeAdapterOptions,
  type QueryFn,
  type RetryConfig,
} from "@herbcaudill/agent-server"

// Re-export conversation types for backward compatibility
export type { ConversationContext, ConversationMessage } from "@herbcaudill/agent-server"
