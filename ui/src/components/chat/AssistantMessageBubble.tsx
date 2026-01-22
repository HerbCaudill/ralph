import { cn } from "@/lib/utils"
import { MarkdownContent } from "@/components/ui/MarkdownContent"
import type { TaskChatMessage } from "@/types"

/**
 * Renders an assistant message bubble in the task chat interface with markdown support.
 */
export function AssistantMessageBubble({ message, className }: Props) {
  return (
    <div className={cn("py-1.5 pr-4 pl-4", className)}>
      <MarkdownContent className="flex-1 font-serif">{message.content}</MarkdownContent>
    </div>
  )
}

type Props = {
  /** The assistant message to display */
  message: TaskChatMessage
  /** Optional CSS class name to apply to the container */
  className?: string
}
