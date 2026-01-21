import type { RalphEvent } from "@/types"

export function isRalphTaskStartedEvent(event: RalphEvent): boolean {
  return event.type === "ralph_task_started"
}
