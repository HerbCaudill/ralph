import { cn } from "@/lib/utils"
import { MarkdownContent } from "@/components/ui/MarkdownContent"
import type { TaskChatMessage } from "@/types"

export function AssistantMessageBubble({ message, className }: Props) {
  return (
    <div className={cn("py-1.5 pr-4 pl-4", className)}>
      <MarkdownContent className="flex-1 font-serif">{message.content}</MarkdownContent>
    </div>
  )
}

type Props = {
  message: TaskChatMessage
  className?: string
}
