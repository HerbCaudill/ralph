import type { RalphEvent } from "@/types"

export function isToolResultEvent(event: RalphEvent): boolean {
  return event.type === "user" && typeof (event as any).tool_use_result !== "undefined"
}
