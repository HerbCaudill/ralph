import { cn } from "@/lib/utils"
import { IconPlayerPlay, IconCheck } from "@tabler/icons-react"
import { TaskIdLink } from "@/components/ui/TaskIdLink"

export interface TaskLifecycleEventData {
  type: "task_lifecycle"
  timestamp: number
  action: "starting" | "completed"
  taskId: string
  taskTitle?: string
}

export interface TaskLifecycleEventProps {
  event: TaskLifecycleEventData
  className?: string
}

/**
 * Parse a text message to detect task lifecycle events.
 * Returns TaskLifecycleEventData if the text matches the pattern, null otherwise.
 *
 * Patterns recognized:
 * - "<start_task>task-id</start_task>"
 * - "<end_task>task-id</end_task>"
 * - "✨ Starting **task-id** or **task-id title**"
 * - "✅ Completed **task-id** or **task-id title**"
 */
export function parseTaskLifecycleEvent(
  text: string,
  timestamp: number,
): TaskLifecycleEventData | null {
  // Match starting pattern: <start_task>task-id</start_task>
  const startingMatch = text.match(/<start_task>([a-z]+-[a-z0-9]+(?:\.[a-z0-9]+)*)<\/start_task>/i)
  if (startingMatch) {
    return {
      type: "task_lifecycle",
      timestamp,
      action: "starting",
      taskId: startingMatch[1],
    }
  }

  // Match completed pattern: <end_task>task-id</end_task>
  const completedMatch = text.match(/<end_task>([a-z]+-[a-z0-9]+(?:\.[a-z0-9]+)*)<\/end_task>/i)
  if (completedMatch) {
    return {
      type: "task_lifecycle",
      timestamp,
      action: "completed",
      taskId: completedMatch[1],
    }
  }

  // Match emoji starting pattern: ✨ Starting **task-id** or ✨ Starting **task-id title**
  // Task ID format: prefix-suffix (e.g., r-abc1, rui-4rt5)
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

  // Match emoji completed pattern: ✅ Completed **task-id** or ✅ Completed **task-id title**
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

/**
 * Renders a task lifecycle event (starting or completing a task) with special styling.
 */
export function TaskLifecycleEvent({ event, className }: TaskLifecycleEventProps) {
  const isStarting = event.action === "starting"
  const Icon = isStarting ? IconPlayerPlay : IconCheck

  return (
    <div
      className={cn(
        "mx-4 my-2 flex items-center gap-3 rounded-lg border px-4 py-3",
        isStarting ?
          "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/50"
        : "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/50",
        className,
      )}
      data-testid="task-lifecycle-event"
      data-action={event.action}
    >
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          isStarting ?
            "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400"
          : "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400",
        )}
      >
        <Icon className="size-4" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            "text-xs font-medium tracking-wide uppercase",
            isStarting ? "text-blue-600 dark:text-blue-400" : "text-green-600 dark:text-green-400",
          )}
        >
          {isStarting ? "Starting" : "Completed"}
        </span>
        <div className="flex items-baseline gap-2">
          {/* TaskIdLink expects a string that may contain task IDs - pass the ID as text */}
          <TaskIdLink className="font-mono text-sm font-medium">{event.taskId}</TaskIdLink>
          {event.taskTitle && (
            <span className="text-muted-foreground truncate text-sm">{event.taskTitle}</span>
          )}
        </div>
      </div>
    </div>
  )
}
