import { cn, TextWithLinks, useAgentViewContext } from "@herbcaudill/agent-view"
import type { TaskLifecycleChatEvent } from "@herbcaudill/agent-view"
import { IconPlayerPlay, IconCheck } from "@tabler/icons-react"

/** Renders a task lifecycle event (starting or completing a task) with special styling. */
export function TaskLifecycleEvent({ event, className }: Props) {
  const isStarting = event.action === "starting"
  const Icon = isStarting ? IconPlayerPlay : IconCheck

  // Look up task title from context
  const { tasks } = useAgentViewContext()
  const taskTitle = event.taskId ? tasks?.find(t => t.id === event.taskId)?.title : undefined

  return (
    <div
      className={cn(
        "my-2 ml-4 mr-12 flex items-center gap-3 rounded-lg border px-4 py-3",
        isStarting ?
          "border-blue-500 dark:border-blue-800"
        : "border-green-500 dark:border-green-800",
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
        <div className="flex items-baseline gap-2 text-xs">
          {/* TaskIdLink expects a string that may contain task IDs - pass the ID as text */}
          <span className="text-muted-foreground shrink-0 font-mono text-xs">
            <TextWithLinks>{event.taskId}</TextWithLinks>
          </span>
          {taskTitle && <span className="truncate">{taskTitle}</span>}
        </div>
      </div>
    </div>
  )
}

type Props = {
  event: TaskLifecycleChatEvent
  className?: string
}
