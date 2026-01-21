import type { RalphEvent, ErrorEventData } from "@/types"

export function isErrorEvent(event: RalphEvent): event is ErrorEventData & RalphEvent {
  return (
    (event.type === "error" || event.type === "server_error") &&
    typeof (event as any).error === "string"
  )
}
