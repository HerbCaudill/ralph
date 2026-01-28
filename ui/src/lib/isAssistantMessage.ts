import type { AssistantChatEvent, ChatEvent } from "@/types"

export function isAssistantMessage(event: ChatEvent): event is AssistantChatEvent {
  return event.type === "assistant" && typeof event.message === "object"
}
