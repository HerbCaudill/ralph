import { cn } from "@/lib/utils"
import type { TaskChatMessage } from "@/types"

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
  message: TaskChatMessage
  className?: string
}
