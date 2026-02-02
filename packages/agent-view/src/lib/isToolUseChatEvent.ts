import type { ChatEvent, ToolUseChatEvent } from "../types"

/** Check if a ChatEvent is a standalone tool_use event (not embedded in an assistant message). */
export function isToolUseChatEvent(event: ChatEvent): event is ToolUseChatEvent {
  return event.type === "tool_use" && typeof (event as ToolUseChatEvent).tool === "string"
}
