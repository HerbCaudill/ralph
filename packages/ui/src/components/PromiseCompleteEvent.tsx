import { cn } from "@herbcaudill/agent-view"
import type { PromiseCompleteChatEvent } from "@herbcaudill/agent-view"
import { IconCircleCheck } from "@tabler/icons-react"

/** Renders a promise complete event with special styling, similar to task lifecycle events. */
export function PromiseCompleteEvent({ event: _event, className }: Props) {
  return (
    <div
      className={cn(
        "mx-4 my-2 flex items-center gap-3 rounded-lg border px-4 py-3",
        "border-purple-500 dark:border-purple-800",
        className,
      )}
      data-testid="promise-complete-event"
    >
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          "bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400",
        )}
      >
        <IconCircleCheck className="size-4" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            "text-xs font-medium tracking-wide uppercase",
            "text-purple-600 dark:text-purple-400",
          )}
        >
          Session complete
        </span>
        <div className="text-muted-foreground text-xs">All tasks finished — no remaining work</div>
      </div>
    </div>
  )
}

type Props = {
  event: PromiseCompleteChatEvent
  className?: string
}
