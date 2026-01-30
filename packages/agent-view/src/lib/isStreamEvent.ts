import type { ChatEvent, StreamChatEvent } from "../types"

export function isStreamEvent(event: ChatEvent): event is StreamChatEvent {
  return event.type === "stream_event"
}
