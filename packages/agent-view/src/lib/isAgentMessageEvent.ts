import type { ChatEvent } from "../types"

/** Agent-server message event with text content. */
export interface AgentMessageChatEvent extends ChatEvent {
  type: "message"
  content: string
  isPartial?: boolean
}

/** Check if an event is a non-partial agent-server message event. */
export function isAgentMessageEvent(event: ChatEvent): event is AgentMessageChatEvent {
  return event.type === "message" && typeof (event as AgentMessageChatEvent).content === "string"
}
