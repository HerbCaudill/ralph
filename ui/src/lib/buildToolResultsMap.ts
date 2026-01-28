import type { ChatEvent } from "@/types"
import { isRalphTaskCompletedEvent } from "@/lib/isRalphTaskCompletedEvent"
import { isRalphTaskStartedEvent } from "@/lib/isRalphTaskStartedEvent"
import { isToolResultEvent } from "@/lib/isToolResultEvent"

export type ToolResult = { output?: string; error?: string }

export type ToolResultsInfo = {
  toolResults: Map<string, ToolResult>
  hasStructuredLifecycleEvents: boolean
}

/**
 * Builds a map of tool use IDs to their results from a list of chat events.
 *
 * Also detects whether the events contain structured lifecycle events
 * (ralph task started/completed).
 *
 * This logic was previously duplicated across EventDisplay and EventList components.
 */
export function buildToolResultsMap(events: ChatEvent[]): ToolResultsInfo {
  const results = new Map<string, ToolResult>()
  let hasLifecycleEvents = false

  for (const event of events) {
    if (isToolResultEvent(event)) {
      const content = (event as any).message?.content
      if (Array.isArray(content)) {
        for (const item of content) {
          if (item.type === "tool_result" && item.tool_use_id) {
            results.set(item.tool_use_id, {
              output: typeof item.content === "string" ? item.content : undefined,
              error:
                item.is_error ?
                  typeof item.content === "string" ?
                    item.content
                  : "Error"
                : undefined,
            })
          }
        }
      }
    }
    if (isRalphTaskStartedEvent(event) || isRalphTaskCompletedEvent(event)) {
      hasLifecycleEvents = true
    }
  }

  return { toolResults: results, hasStructuredLifecycleEvents: hasLifecycleEvents }
}
