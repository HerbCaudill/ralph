import type { TaskLifecycleEventData } from "@/types"

export function parseTaskLifecycleEvent(
  text: string,
  timestamp: number,
): TaskLifecycleEventData | null {
  const startingMatch = text.match(
    /<start_task>([a-z]+-[a-z0-9]+(?:\.[a-z0-9]+)*)<\/start_task>/i,
  )
  if (startingMatch) {
    return {
      type: "task_lifecycle",
      timestamp,
      action: "starting",
      taskId: startingMatch[1],
    }
  }

  const completedMatch = text.match(
    /<end_task>([a-z]+-[a-z0-9]+(?:\.[a-z0-9]+)*)<\/end_task>/i,
  )
  if (completedMatch) {
    return {
      type: "task_lifecycle",
      timestamp,
      action: "completed",
      taskId: completedMatch[1],
    }
  }

  const emojiStartMatch = text.match(
    /✨\s*Starting\s+\*\*([a-z]+-[a-z0-9]+(?:\.[a-z0-9]+)*)(?:\s+([^*]+))?\*\*/i,
  )
  if (emojiStartMatch) {
    return {
      type: "task_lifecycle",
      timestamp,
      action: "starting",
      taskId: emojiStartMatch[1],
      taskTitle: emojiStartMatch[2]?.trim(),
    }
  }

  const emojiCompletedMatch = text.match(
    /✅\s*Completed\s+\*\*([a-z]+-[a-z0-9]+(?:\.[a-z0-9]+)*)(?:\s+([^*]+))?\*\*/i,
  )
  if (emojiCompletedMatch) {
    return {
      type: "task_lifecycle",
      timestamp,
      action: "completed",
      taskId: emojiCompletedMatch[1],
      taskTitle: emojiCompletedMatch[2]?.trim(),
    }
  }

  return null
}
