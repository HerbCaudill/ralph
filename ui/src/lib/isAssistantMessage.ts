import type { RalphEvent } from "@/types"

export function isAssistantMessage(event: RalphEvent): boolean {
  return event.type === "assistant" && typeof (event as any).message === "object"
}
