import type { RalphEvent } from "@/types"

export function isRalphTaskCompletedEvent(event: RalphEvent): boolean {
  return event.type === "ralph_task_completed"
}
