import type { ChatEvent, ErrorChatEvent } from "../types"

export function isErrorEvent(event: ChatEvent): event is ErrorChatEvent {
  return (
    (event.type === "error" || event.type === "server_error") && typeof event.error === "string"
  )
}
