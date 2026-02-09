import { cn } from "../lib/utils"
import { IconPlayerPause } from "@tabler/icons-react"
import type { InterruptedChatEvent } from "../types"

/** Renders an interrupted event when the user stops the agent mid-stream. */
export function InterruptedEvent({ event, className }: Props) {
  const message = event.message ?? "Interrupted · What should Ralph do instead?"

  return (
    <div
      className={cn(
        "mx-4 my-2 flex items-center gap-2 rounded-lg border px-4 py-3",
        "bg-amber-500/5 border-amber-500 text-amber-700 dark:text-amber-400",
        className,
      )}
      data-testid="interrupted-event"
    >
      <div className={cn("flex size-4 shrink-0 items-center justify-center rounded-full")}>
        <IconPlayerPause className="size-4" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-foreground text-sm font-medium">{message}</span>
      </div>
    </div>
  )
}

/** Props for InterruptedEvent component */
type Props = {
  /** The interrupted event data to display */
  event: InterruptedChatEvent
  /** Optional CSS class to apply to the container */
  className?: string
}
