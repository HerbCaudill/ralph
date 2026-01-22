import { cn } from "@/lib/utils"
import type { UserMessageEvent } from "@/types"

/**
 * Renders a user-sent message in the event stream.
 * Displays as a right-aligned bubble with muted background.
 */
export function UserMessage({ event, className }: Props) {
  return (
    <div className={cn("flex justify-end py-2 pr-4 pl-12", className)}>
      <div className="bg-muted/60 max-w-[85%] rounded-lg px-4 py-2.5">
        <p className="text-foreground text-sm whitespace-pre-wrap">{event.message}</p>
      </div>
    </div>
  )
}

type Props = {
  event: UserMessageEvent
  className?: string
}
