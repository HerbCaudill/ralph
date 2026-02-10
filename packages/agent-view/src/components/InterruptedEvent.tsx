import { cn } from "../lib/utils"
import { IconPlayerPause } from "@tabler/icons-react"
import type { InterruptedChatEvent } from "../types"

/** Renders an interrupted event when the user stops the agent mid-stream. */
export function InterruptedEvent({ event, className }: Props) {
  const message = event.message

  return (
    <div
      className={cn(
        "my-2 ml-4 mr-12 flex items-center gap-2 rounded-lg border px-4 py-3",
        "bg-amber-500/5 border-amber-500 text-amber-700 dark:text-amber-400",
        className,
      )}
      data-testid="interrupted-event"
    >
      <div className={cn("flex size-4 shrink-0 items-center justify-center rounded-full")}>
        <IconPlayerPause className="size-4" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm">
          {message ?
            <span className="text-foreground font-medium">{message}</span>
          : <>
              <span className="text-foreground font-medium">Interrupted</span>
              <span className="text-foreground"> · What should Ralph do instead?</span>
            </>
          }
        </span>
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
