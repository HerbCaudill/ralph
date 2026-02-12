import type { BaseChatEvent, RalphTaskCompletedChatEvent } from "./types"

/** Check if a chat event is a Ralph task completed event. */
export function isRalphTaskCompletedEvent(
  event: BaseChatEvent,
): event is RalphTaskCompletedChatEvent {
  return event.type === "ralph_task_completed"
}
