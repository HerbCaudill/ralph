import { IconX } from "@tabler/icons-react"
import { TaskLink } from "./TaskLink"
import type { RelatedTask } from "../../types"

/**
 * Displays a static section with a header and list of tasks.
 * Section is always expanded (non-collapsible).
 */
export function CollapsibleSection({
  label,
  tasks,
  issuePrefix,
  onRemove,
  removableIds = [],
}: Props) {
  if (tasks.length === 0) return null

  return (
    <div className="space-y-1">
      <span className="text-muted-foreground text-xs font-medium">
        {label} ({tasks.length})
      </span>
      <div className="space-y-0.5">
        {tasks.map(task => (
          <div key={task.id} className="group flex items-center">
            <TaskLink task={task} issuePrefix={issuePrefix} />
            {onRemove && removableIds.includes(task.id) && (
              <button
                type="button"
                onClick={() => onRemove(task.id)}
                className="text-muted-foreground hover:text-destructive ml-1 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100"
                aria-label={`Remove ${task.id} as blocker`}
              >
                <IconX className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

type Props = {
  label: string
  tasks: RelatedTask[]
  issuePrefix: string | null
  onRemove?: (taskId: string) => void
  removableIds?: string[]
}
