import { AssistantText } from "@/components/events/AssistantText"
import { ThinkingBlock } from "@/components/events/ThinkingBlock"
import { ToolUseCard } from "@/components/events/ToolUseCard"
import { TaskLifecycleEvent } from "@/components/events/TaskLifecycleEvent"
import { parseTaskLifecycleEvent } from "@/lib/parseTaskLifecycleEvent"
import type { AssistantContentBlock, AssistantTextEvent, ToolUseEvent } from "@/types"

export function renderEventContentBlock(
  block: AssistantContentBlock,
  index: number,
  timestamp: number,
  toolResults: Map<string, { output?: string; error?: string }>,
  options?: { hasStructuredLifecycleEvents?: boolean },
) {
  if (block.type === "thinking") {
    return <ThinkingBlock key={`thinking-${index}`} content={block.thinking} />
  }

  if (block.type === "text") {
    const lifecycleEvent = parseTaskLifecycleEvent(block.text, timestamp)
    if (lifecycleEvent) {
      if (options?.hasStructuredLifecycleEvents) {
        return null
      }
      return <TaskLifecycleEvent key={`lifecycle-${index}`} event={lifecycleEvent} />
    }

    const textEvent: AssistantTextEvent = {
      type: "text",
      timestamp,
      content: block.text,
    }
    return <AssistantText key={`text-${index}`} event={textEvent} />
  }

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
    return <ToolUseCard key={`tool-${block.id}`} event={toolEvent} />
  }

  return null
}
