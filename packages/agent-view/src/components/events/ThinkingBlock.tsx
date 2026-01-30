import { useState } from "react"
import { IconBrain, IconChevronDown, IconChevronRight } from "@tabler/icons-react"
import { cn } from "../../lib/utils"
import { MarkdownContent } from "../ui/MarkdownContent"

/**
 * Renders Claude's extended thinking/internal monologue content.
 * Displayed with muted styling and collapsible to reduce visual prominence
 * since this is internal reasoning rather than user-facing content.
 */
export function ThinkingBlock({ content, className, defaultExpanded = false }: Props) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  return (
    <div className={cn("py-1.5 pr-4 pl-4", className)}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-muted-foreground hover:text-foreground flex w-full items-center gap-2 text-left transition-colors"
      >
        {isExpanded ?
          <IconChevronDown className="size-4 shrink-0" />
        : <IconChevronRight className="size-4 shrink-0" />}
        <IconBrain className="size-4 shrink-0" />
        <span className="text-xs font-medium italic">Thinking...</span>
      </button>

      {isExpanded && (
        <div className="border-muted-foreground/30 mt-2 ml-4 border-l pl-3">
          <div className="bg-muted/30 rounded-md p-3">
            <MarkdownContent
              className="text-muted-foreground flex-1 font-serif text-sm italic"
              size="sm"
            >
              {content}
            </MarkdownContent>
          </div>
        </div>
      )}
    </div>
  )
}

type Props = {
  /** The thinking content to render */
  content: string
  /** Optional CSS class to apply to the container */
  className?: string
  /** Whether the thinking block should start expanded (default: false) */
  defaultExpanded?: boolean
}
