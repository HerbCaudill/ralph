import type { RalphEvent, UserMessageEvent } from "@/types"

export function isUserMessageEvent(event: RalphEvent): event is UserMessageEvent & RalphEvent {
  return event.type === "user_message" && typeof (event as any).message === "string"
}
