import type { ChatEvent } from "@/types"

export function isRalphTaskStartedEvent(event: ChatEvent): boolean {
  return event.type === "ralph_task_started"
}
