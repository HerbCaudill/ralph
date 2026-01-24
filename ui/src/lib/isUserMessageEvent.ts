import type { ChatEvent, UserMessageEvent } from "@/types"

export function isUserMessageEvent(event: ChatEvent): event is UserMessageEvent & ChatEvent {
  return event.type === "user_message" && typeof (event as any).message === "string"
}
