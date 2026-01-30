import type { ChatEvent, UserMessageChatEvent } from "@/types"

export function isUserMessageEvent(event: ChatEvent): event is UserMessageChatEvent {
  return event.type === "user_message" && typeof event.message === "string"
}
