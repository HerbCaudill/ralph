import type { ChatEvent, SystemChatEvent } from "../types"

export function isSystemEvent(event: ChatEvent): event is SystemChatEvent {
  return event.type === "system"
}
