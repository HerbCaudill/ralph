import { cn } from "@/lib/utils"
import type { TaskChatMessage } from "@/types"

/**
 * Renders a user message bubble in the task chat interface.
 */
export function UserMessageBubble({ message, className }: Props) {
  return (
    <div className={cn("flex justify-end py-2 pr-4 pl-12", className)}>
      <div className="bg-muted/60 max-w-[85%] rounded-lg px-4 py-2.5">
        <p className="text-foreground text-sm whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  )
}

type Props = {
  /** The user message to display */
  message: TaskChatMessage
  /** Optional CSS class name to apply to the container */
  className?: string
}
