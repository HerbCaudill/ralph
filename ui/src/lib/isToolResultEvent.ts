import type { ChatEvent } from "@/types"

export function isToolResultEvent(event: ChatEvent): boolean {
  return event.type === "user" && typeof (event as any).tool_use_result !== "undefined"
}
