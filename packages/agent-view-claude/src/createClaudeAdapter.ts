import type { AgentAdapter } from "@herbcaudill/agent-view"
import { createBatchConverter } from "@herbcaudill/agent-view"
import { convertClaudeEvent } from "./convertClaudeEvent"

/**
 * Create an AgentAdapter for Claude CLI/SDK events.
 *
 * The returned adapter translates Claude's native JSON stream events
 * into the ChatEvent format consumed by agent-view components.
 */
export const createClaudeAdapter = (): AgentAdapter => ({
  meta: {
    name: "claude",
    displayName: "Claude",
  },
  convertEvent: convertClaudeEvent,
  convertEvents: createBatchConverter(convertClaudeEvent),
})
