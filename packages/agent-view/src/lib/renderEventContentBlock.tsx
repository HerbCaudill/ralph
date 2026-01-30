import { AssistantText } from "../components/AssistantText"
import { ThinkingBlock } from "../components/ThinkingBlock"
import { ToolUseCard } from "../components/ToolUseCard"
import { TaskLifecycleEvent } from "../components/TaskLifecycleEvent"
import { PromiseCompleteEvent } from "../components/PromiseCompleteEvent"
import type { ToolResult } from "./buildToolResultsMap"
import { parseTaskLifecycleEvent } from "./parseTaskLifecycleEvent"
import { parsePromiseCompleteEvent } from "./parsePromiseCompleteEvent"
import { shouldFilterContentBlock, logContentBlockFilterDecision } from "./EventFilterPipeline"
import type {
  AssistantContentBlock,
  AssistantTextEvent,
  CustomEventRenderer,
  ToolUseEvent,
} from "../types"

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
  timestamp: number | undefined,
  toolResults: Map<string, ToolResult>,
  options?: {
    hasStructuredLifecycleEvents?: boolean
    eventIndex?: number
    customEventRenderers?: Record<string, CustomEventRenderer>
  },
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
      // Check custom renderer first, fall back to built-in
      const customRenderer = options?.customEventRenderers?.["task_lifecycle"]
      if (customRenderer) {
        return <span key={`${keyPrefix}lifecycle-${index}`}>{customRenderer(lifecycleEvent)}</span>
      }
      return <TaskLifecycleEvent key={`${keyPrefix}lifecycle-${index}`} event={lifecycleEvent} />
    }

    // Check for promise complete events
    const promiseCompleteEvent = parsePromiseCompleteEvent(block.text, timestamp)
    if (promiseCompleteEvent) {
      // Check custom renderer first, fall back to built-in
      const customRenderer = options?.customEventRenderers?.["promise_complete"]
      if (customRenderer) {
        return (
          <span key={`${keyPrefix}promise-${index}`}>{customRenderer(promiseCompleteEvent)}</span>
        )
      }
      return (
        <PromiseCompleteEvent key={`${keyPrefix}promise-${index}`} event={promiseCompleteEvent} />
      )
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
