import type { ChatEvent, TaskLifecycleChatEvent, AssistantChatEvent } from "@herbcaudill/agent-view"
import { parseTaskLifecycleEvent } from "@herbcaudill/agent-view"

/**
 * Extract a task lifecycle event from an assistant event if it contains task markers.
 * Checks all text content blocks for `<start_task>` or `<end_task>` markers.
 */
export function extractTaskLifecycleEvent(
  /** The chat event to check */
  event: ChatEvent,
): TaskLifecycleChatEvent | null {
  if (event.type !== "assistant") return null

  const assistantEvent = event as AssistantChatEvent
  const content = assistantEvent.message?.content
  if (!content) return null

  // Check each content block for task lifecycle markers
  for (const block of content) {
    if (block.type === "text" && block.text) {
      const lifecycleEvent = parseTaskLifecycleEvent(block.text, event.timestamp)
      if (lifecycleEvent) {
        return lifecycleEvent as TaskLifecycleChatEvent
      }
    }
  }

  return null
}
