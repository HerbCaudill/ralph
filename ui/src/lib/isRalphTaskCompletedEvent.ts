import type { ChatEvent } from "@/types"

export function isRalphTaskCompletedEvent(event: ChatEvent): boolean {
  return event.type === "ralph_task_completed"
}
