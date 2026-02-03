import { cn } from "../lib/utils"
import { MarkdownContent } from "./MarkdownContent"
import type { AssistantTextEvent } from "../types"

/**  Renders assistant text content with markdown support. */
export function AssistantText({ event, className }: Props) {
  return (
    <div className={cn("max-w-[100ch] py-1.5 pr-12 pl-4", className)}>
      <MarkdownContent className="flex-1 font-serif">{event.content}</MarkdownContent>
    </div>
  )
}

/**  Props for the AssistantText component */
type Props = {
  /** The assistant text event to render */
  event: AssistantTextEvent
  /** Optional CSS class to apply to the container */
  className?: string
}
