import type { ChatEvent } from "@/types"

export function isAssistantMessage(event: ChatEvent): boolean {
  return event.type === "assistant" && typeof (event as any).message === "object"
}
