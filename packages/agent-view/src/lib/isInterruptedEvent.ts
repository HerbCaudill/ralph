import type { ChatEvent, InterruptedChatEvent } from "../types"

export function isInterruptedEvent(event: ChatEvent): event is InterruptedChatEvent {
  return event.type === "interrupted"
}
