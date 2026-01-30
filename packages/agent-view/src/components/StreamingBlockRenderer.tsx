import { useContext } from "react"
import { AssistantText } from "./AssistantText"
import { ThinkingBlock } from "./ThinkingBlock"
import { ToolUseCard } from "./ToolUseCard"
import { parseTaskLifecycleEvent } from "../lib/parseTaskLifecycleEvent"
import { parsePromiseCompleteEvent } from "../lib/parsePromiseCompleteEvent"
import { unescapeJsonString } from "../lib/unescapeJsonString"
import { AgentViewContext } from "../context/AgentViewContext"
import type { AssistantTextEvent, StreamingContentBlock, ToolUseEvent } from "../types"

/**
 * Renders a single streaming content block (text or tool use) from the Claude API.
 * Handles parsing task lifecycle events from text and incomplete tool use JSON.
 *
 * Checks customEventRenderers from context before falling back to built-in renderers.
 */
export function StreamingBlockRenderer({ block, timestamp }: Props) {
  const { customEventRenderers } = useContext(AgentViewContext)

  if (block.type === "thinking") {
    if (!block.thinking) return null
    // Show thinking blocks expanded while streaming so user can see progress
    return <ThinkingBlock content={block.thinking} defaultExpanded={true} />
  }

  if (block.type === "text") {
    if (!block.text) return null

    // Check for task lifecycle events (rendered via customEventRenderers plugin)
    const lifecycleEvent = parseTaskLifecycleEvent(block.text, timestamp)
    if (lifecycleEvent) {
      const customRenderer = customEventRenderers?.["task_lifecycle"]
      return customRenderer ? <>{customRenderer(lifecycleEvent)}</> : null
    }

    // Check for promise complete events (rendered via customEventRenderers plugin)
    const promiseCompleteEvent = parsePromiseCompleteEvent(block.text, timestamp)
    if (promiseCompleteEvent) {
      const customRenderer = customEventRenderers?.["promise_complete"]
      return customRenderer ? <>{customRenderer(promiseCompleteEvent)}</> : null
    }

    const textEvent: AssistantTextEvent = {
      type: "text",
      timestamp,
      content: block.text,
    }
    return <AssistantText event={textEvent} />
  }

  if (block.type === "tool_use") {
    let input: Record<string, unknown> = {}
    try {
      input = JSON.parse(block.input)
    } catch {
      const commandMatch = block.input.match(/"command"\s*:\s*"((?:[^"\\]|\\.)*)/)
      const filePathMatch = block.input.match(/"file_path"\s*:\s*"((?:[^"\\]|\\.)*)/)
      const patternMatch = block.input.match(/"pattern"\s*:\s*"((?:[^"\\]|\\.)*)/)
      if (commandMatch) input = { command: unescapeJsonString(commandMatch[1]) }
      else if (filePathMatch) input = { file_path: unescapeJsonString(filePathMatch[1]) }
      else if (patternMatch) input = { pattern: unescapeJsonString(patternMatch[1]) }
    }

    const toolEvent: ToolUseEvent = {
      type: "tool_use",
      timestamp,
      tool: block.name as ToolUseEvent["tool"],
      input,
      status: "running",
    }
    return <ToolUseCard event={toolEvent} />
  }

  return null
}

type Props = {
  block: StreamingContentBlock
  timestamp?: number
}
