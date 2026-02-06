import { useMemo } from "react"
import type { ChatEvent, TaskLifecycleChatEvent } from "@herbcaudill/agent-view"

/**
 * Extract current task ID from Ralph events by tracking task lifecycle events.
 */
export function useCurrentTask(
  /** Array of chat events from Ralph loop */
  events: ChatEvent[],
): { taskId: string | null; taskTitle: string | null } {
  return useMemo(() => {
    // Find the most recent task lifecycle event
    const lifecycleEvents = events.filter(
      (e): e is TaskLifecycleChatEvent => e.type === "task_lifecycle",
    )

    if (lifecycleEvents.length === 0) {
      return { taskId: null, taskTitle: null }
    }

    // Get the last lifecycle event
    const lastEvent = lifecycleEvents[lifecycleEvents.length - 1]

    // If it's a starting event, return the task ID
    if (lastEvent.action === "starting") {
      return {
        taskId: lastEvent.taskId,
        // We don't have the title in the event, so return null
        taskTitle: null,
      }
    }

    // If it's a completed event, no current task
    return { taskId: null, taskTitle: null }
  }, [events])
}
