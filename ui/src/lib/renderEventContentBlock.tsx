import { AssistantText } from "@/components/events/AssistantText"
import { ThinkingBlock } from "@/components/events/ThinkingBlock"
import { ToolUseCard } from "@/components/events/ToolUseCard"
import { TaskLifecycleEvent } from "@/components/events/TaskLifecycleEvent"
import type { ToolResult } from "@/lib/buildToolResultsMap"
import { parseTaskLifecycleEvent } from "@/lib/parseTaskLifecycleEvent"
import { shouldFilterContentBlock, logContentBlockFilterDecision } from "@/lib/EventFilterPipeline"
import type { AssistantContentBlock, AssistantTextEvent, ToolUseEvent } from "@/types"

/**
 * Renders a single content block from an assistant message.
 *
 * This function handles Layer 4 of the event filtering pipeline.
 * See EVENT_FILTERING_PIPELINE.md for full documentation.
 *
 * Supported block types:
 * - thinking: Extended thinking blocks (rendered as collapsible)
 * - text: Regular text (may contain lifecycle markers)
 * - tool_use: Tool invocations (rendered with results inline)
 *
 * Filtered (return null):
 * - Lifecycle text when structured events exist (avoid duplication)
 * - Unrecognized block types
 */
export function renderEventContentBlock(
  block: AssistantContentBlock,
  index: number,
  timestamp: number,
  toolResults: Map<string, ToolResult>,
  options?: { hasStructuredLifecycleEvents?: boolean; eventIndex?: number },
) {
  // For text blocks, check if it's a lifecycle marker
  const lifecycleEvent =
    block.type === "text" ? parseTaskLifecycleEvent(block.text, timestamp) : null
  const isLifecycleText = lifecycleEvent !== null

  // Use centralized filter logic
  const filterResult = shouldFilterContentBlock(block, isLifecycleText, {
    hasStructuredLifecycleEvents: options?.hasStructuredLifecycleEvents,
  })

  // Log filter decision when debug mode is enabled
  // Enable with: localStorage.setItem('ralph-filter-debug', 'true')
  logContentBlockFilterDecision(block, filterResult, index)

  if (!filterResult.shouldRender) {
    return null
  }

  // Build a key prefix that includes the event index to ensure uniqueness
  // across multiple assistant message events containing the same block IDs
  const keyPrefix = options?.eventIndex !== undefined ? `${options.eventIndex}-` : ""

  // Render thinking blocks
  if (block.type === "thinking") {
    return <ThinkingBlock key={`${keyPrefix}thinking-${index}`} content={block.thinking} />
  }

  // Render text blocks (may be lifecycle events or regular text)
  if (block.type === "text") {
    // If it's a lifecycle text and we get here, structured events don't exist
    // so we should render it as a lifecycle event
    if (lifecycleEvent) {
      return <TaskLifecycleEvent key={`${keyPrefix}lifecycle-${index}`} event={lifecycleEvent} />
    }

    const textEvent: AssistantTextEvent = {
      type: "text",
      timestamp,
      content: block.text,
    }
    return <AssistantText key={`${keyPrefix}text-${index}`} event={textEvent} />
  }

  // Render tool use blocks
  if (block.type === "tool_use") {
    const result = toolResults.get(block.id)
    const toolEvent: ToolUseEvent = {
      type: "tool_use",
      timestamp,
      tool: block.name as ToolUseEvent["tool"],
      input: block.input,
      status:
        result ?
          result.error ?
            "error"
          : "success"
        : "success",
      output: result?.output,
      error: result?.error,
    }
    return <ToolUseCard key={`${keyPrefix}tool-${block.id}`} event={toolEvent} />
  }

  // This shouldn't be reached if filter logic is correct
  return null
}
