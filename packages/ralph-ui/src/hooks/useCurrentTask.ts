import { useMemo } from "react"
import type { ChatEvent } from "@herbcaudill/agent-view"
import type { TaskLifecycleChatEvent } from "@herbcaudill/ralph-shared"

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

    // Find the most recent "starting" event to get the task ID.
    // We look for "starting" rather than using the last event because
    // completed sessions still need to show which task they worked on
    // (e.g., when viewing historical sessions in the SessionPicker).
    const lastStartingEvent = [...lifecycleEvents].reverse().find(e => e.action === "starting")

    if (!lastStartingEvent) {
      return { taskId: null, taskTitle: null }
    }

    const taskTitle = tasks?.find(t => t.id === lastStartingEvent.taskId)?.title ?? null
    return {
      taskId: lastStartingEvent.taskId,
      taskTitle,
    }
  }, [events, tasks])
}
