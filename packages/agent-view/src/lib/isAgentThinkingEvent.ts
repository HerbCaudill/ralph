import type { ChatEvent } from "../types"

/** Agent-server thinking event with extended thinking content. */
export interface AgentThinkingChatEvent extends ChatEvent {
  type: "thinking"
  content: string
  isPartial?: boolean
}

/** Check if an event is an agent-server thinking event. */
export function isAgentThinkingEvent(event: ChatEvent): event is AgentThinkingChatEvent {
  return event.type === "thinking" && typeof (event as AgentThinkingChatEvent).content === "string"
}
