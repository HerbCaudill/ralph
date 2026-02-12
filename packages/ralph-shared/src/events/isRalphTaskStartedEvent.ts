import type { BaseChatEvent, RalphTaskStartedChatEvent } from "./types"

/** Check if a chat event is a Ralph task started event. */
export function isRalphTaskStartedEvent(event: BaseChatEvent): event is RalphTaskStartedChatEvent {
  return event.type === "ralph_task_started"
}
