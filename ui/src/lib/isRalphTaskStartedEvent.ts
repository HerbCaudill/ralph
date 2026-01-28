import type { ChatEvent, RalphTaskStartedChatEvent } from "@/types"

export function isRalphTaskStartedEvent(event: ChatEvent): event is RalphTaskStartedChatEvent {
  return event.type === "ralph_task_started"
}
