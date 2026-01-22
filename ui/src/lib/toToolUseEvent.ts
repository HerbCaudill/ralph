import type { TaskChatToolUse, ToolName, ToolUseEvent } from "@/types"

/**
 * Convert a TaskChatToolUse to a ToolUseEvent for rendering.
 */
export function toToolUseEvent(
  /** The tool use to convert */
  toolUse: TaskChatToolUse,
): ToolUseEvent {
  return {
    type: "tool_use",
    timestamp: toolUse.timestamp,
    tool: toolUse.tool as ToolName,
    input: toolUse.input,
    output: toolUse.output,
    error: toolUse.error,
    status: toolUse.status,
  }
}
