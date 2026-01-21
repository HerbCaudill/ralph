import { useState } from "react"
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react"
import { TaskLink } from "./TaskLink"
import type { RelatedTask } from "@/types"

export function CollapsibleSection({ label, tasks, issuePrefix, defaultExpanded = true }: Props) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  if (tasks.length === 0) return null

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1 text-xs font-medium transition-colors"
      >
        {isExpanded ?
          <IconChevronDown className="h-3.5 w-3.5" />
        : <IconChevronUp className="h-3.5 w-3.5" />}
        {label} ({tasks.length})
      </button>
      {isExpanded && (
        <div className="space-y-0.5">
          {tasks.map(task => (
            <TaskLink key={task.id} task={task} issuePrefix={issuePrefix} />
          ))}
        </div>
      )}
    </div>
  )
}

type Props = {
  label: string
  tasks: RelatedTask[]
  issuePrefix: string | null
  defaultExpanded?: boolean
}
