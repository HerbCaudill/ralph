import type { ChatEvent, UserChatEvent } from "@/types"

export function isToolResultEvent(event: ChatEvent): event is UserChatEvent {
  return event.type === "user" && typeof event.tool_use_result !== "undefined"
}
