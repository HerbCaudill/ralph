/**
 * Re-export all agent types from @herbcaudill/agent-server,
 * plus Ralph-specific types like BdProxy.
 */

// Re-export everything from the generic agent-server
export {
  AgentAdapter,
  isAgentMessageEvent,
  isAgentThinkingEvent,
  isAgentToolUseEvent,
  isAgentToolResultEvent,
  isAgentResultEvent,
  isAgentErrorEvent,
  isAgentStatusEvent,
} from "@herbcaudill/agent-server"

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
  ConversationContext,
  ConversationMessage,
  AgentStartOptions,
  AgentMessage,
  AgentInfo,
  AgentAdapterEvents,
} from "@herbcaudill/agent-server"

// ── BdProxy type (Ralph-specific) ────────────────────────────────────

/**
 * Minimal interface for the BdProxy (BeadsClient) used by ralph-server modules.
 * This avoids a direct dependency on beads-sdk while allowing TaskChatManager
 * and RalphRegistry to interact with the issue tracker.
 */
export interface BdProxy {
  /** Add a comment to an issue. */
  addComment(issueId: string, text: string, author?: string): Promise<void>
  /** List issues with optional filters. */
  list(options?: {
    status?: string
    limit?: number
  }): Promise<Array<{ id: string; title: string; priority: number }>>
}
