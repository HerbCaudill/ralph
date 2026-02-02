import type { ChatEvent } from "../types"
import { isRalphTaskCompletedEvent } from "./isRalphTaskCompletedEvent"
import { isRalphTaskStartedEvent } from "./isRalphTaskStartedEvent"
import { isToolResultEvent } from "./isToolResultEvent"

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
    // Legacy format: type="user" with tool_use_result containing message.content[]
    if (isToolResultEvent(event)) {
      const content = event.message?.content
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

    // Standalone tool_result events from agent-server
    if (isStandaloneToolResult(event)) {
      results.set(event.toolUseId, {
        output: event.output,
        error: event.error,
      })
    }

    if (isRalphTaskStartedEvent(event) || isRalphTaskCompletedEvent(event)) {
      hasLifecycleEvents = true
    }
  }

  return { toolResults: results, hasStructuredLifecycleEvents: hasLifecycleEvents }
}

/** Standalone tool_result event shape from agent-server. */
type StandaloneToolResult = ChatEvent & {
  type: "tool_result"
  toolUseId: string
  output?: string
  error?: string
}

/** Check if an event is a standalone tool_result from the agent-server. */
function isStandaloneToolResult(event: ChatEvent): event is StandaloneToolResult {
  return (
    event.type === "tool_result" && typeof (event as StandaloneToolResult).toolUseId === "string"
  )
}
