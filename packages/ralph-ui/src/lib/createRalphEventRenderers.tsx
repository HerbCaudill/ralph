import type { ChatEvent, CustomEventRenderer } from "@herbcaudill/agent-view"
import type { TaskLifecycleChatEvent, PromiseCompleteChatEvent } from "@herbcaudill/ralph-shared"
import { TaskLifecycleEvent } from "@/components/TaskLifecycleEvent"
import { PromiseCompleteEvent } from "@/components/PromiseCompleteEvent"

/**
 * Creates custom event renderers for Ralph-specific events like task_lifecycle and promise_complete.
 * These renderers are passed to AgentView via the context prop to customize event rendering.
 */
export function createRalphEventRenderers(): Record<string, CustomEventRenderer> {
  return {
    task_lifecycle: (event: ChatEvent) => (
      <TaskLifecycleEvent event={event as TaskLifecycleChatEvent} />
    ),
    promise_complete: (event: ChatEvent) => (
      <PromiseCompleteEvent event={event as PromiseCompleteChatEvent} />
    ),
  }
}
