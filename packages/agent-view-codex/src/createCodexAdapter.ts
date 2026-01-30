import type { AgentAdapter } from "@herbcaudill/agent-view"
import { createBatchConverter } from "@herbcaudill/agent-view"
import { convertCodexEvent } from "./convertCodexEvent"

/**
 * Create an AgentAdapter for Codex SDK events.
 *
 * The returned adapter translates Codex's native thread events
 * into the ChatEvent format consumed by agent-view components.
 */
export const createCodexAdapter = (): AgentAdapter => ({
  meta: {
    name: "codex",
    displayName: "Codex",
  },
  convertEvent: convertCodexEvent,
  convertEvents: createBatchConverter(convertCodexEvent),
})
