import { cn } from "@/lib/utils"
import { IconPlayerPlay, IconCheck } from "@tabler/icons-react"
import { TaskIdLink } from "@/components/ui/TaskIdLink"
import type { TaskLifecycleEventData } from "@/types"

/**  Renders a task lifecycle event (starting or completing a task) with special styling. */
export function TaskLifecycleEvent({ event, className }: Props) {
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
          <TaskIdLink className="text-muted-foreground shrink-0 font-mono text-xs">
            {event.taskId}
          </TaskIdLink>
          {event.taskTitle && <span className="truncate text-xs">{event.taskTitle}</span>}
        </div>
      </div>
    </div>
  )
}

type Props = {
  event: TaskLifecycleEventData
  className?: string
}
