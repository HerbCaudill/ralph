import type { ChatEvent, RalphTaskCompletedChatEvent } from "../types"

export function isRalphTaskCompletedEvent(event: ChatEvent): event is RalphTaskCompletedChatEvent {
  return event.type === "ralph_task_completed"
}
