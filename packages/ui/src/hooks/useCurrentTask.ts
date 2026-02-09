import { useMemo } from "react"
import type { ChatEvent, TaskLifecycleChatEvent } from "@herbcaudill/agent-view"

/**
 * Extract current task ID and title from Ralph events by tracking task lifecycle events.
 * Optionally resolves the task title from a tasks array.
 */
export function useCurrentTask(
  /** Array of chat events from Ralph loop */
  events: ChatEvent[],
  /** Optional array of tasks to resolve the title from */
  tasks?: Array<{ id: string; title: string }>,
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

    // If it's a starting event, return the task ID and resolve title
    if (lastEvent.action === "starting") {
      const taskTitle = tasks?.find(t => t.id === lastEvent.taskId)?.title ?? null
      return {
        taskId: lastEvent.taskId,
        taskTitle,
      }
    }

    // If it's a completed event, no current task
    return { taskId: null, taskTitle: null }
  }, [events, tasks])
}
