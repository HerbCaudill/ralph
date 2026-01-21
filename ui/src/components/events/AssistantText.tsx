import { cn } from "@/lib/utils"
import { MarkdownContent } from "@/components/ui/MarkdownContent"
import type { AssistantTextEvent } from "@/types"

export function AssistantText({ event, className }: Props) {
  return (
    <div className={cn("py-1.5 pr-4 pl-4", className)}>
      <MarkdownContent className="flex-1 font-serif">{event.content}</MarkdownContent>
    </div>
  )
}

type Props = {
  event: AssistantTextEvent
  className?: string
}
