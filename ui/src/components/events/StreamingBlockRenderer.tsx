import { AssistantText } from "./AssistantText"
import { ToolUseCard } from "./ToolUseCard"
import { TaskLifecycleEvent } from "./TaskLifecycleEvent"
import { parseTaskLifecycleEvent } from "@/lib/parseTaskLifecycleEvent"
import { unescapeJsonString } from "@/lib/unescapeJsonString"
import type { AssistantTextEvent, StreamingContentBlock, ToolUseEvent } from "@/types"

/**
 * Renders a single streaming content block (text or tool use) from the Claude API.
 * Handles parsing task lifecycle events from text and incomplete tool use JSON.
 */
export function StreamingBlockRenderer({ block, timestamp }: Props) {
  if (block.type === "text") {
    if (!block.text) return null

    const lifecycleEvent = parseTaskLifecycleEvent(block.text, timestamp)
    if (lifecycleEvent) {
      return <TaskLifecycleEvent event={lifecycleEvent} />
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
  timestamp: number
}
