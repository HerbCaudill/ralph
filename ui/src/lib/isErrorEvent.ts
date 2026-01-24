import type { ChatEvent, ErrorEventData } from "@/types"

export function isErrorEvent(event: ChatEvent): event is ErrorEventData & ChatEvent {
  return (
    (event.type === "error" || event.type === "server_error") &&
    typeof (event as any).error === "string"
  )
}
