import { cn, stripTaskPrefix } from "@/lib/utils"
import { useTaskDialogContext } from "@/contexts"
import {
  IconCircle,
  IconCircleDot,
  IconCircleCheck,
  IconBan,
  IconClock,
  type TablerIcon,
} from "@tabler/icons-react"
import type { RelatedTask, TaskStatus } from "@/types"

export function TaskLink({ task, issuePrefix }: Props) {
  const taskDialogContext = useTaskDialogContext()
  const config = statusConfig[task.status] || statusConfig.open
  const StatusIcon = config.icon

  const handleClick = () => {
    taskDialogContext?.openTaskById(task.id)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm transition-colors",
        "hover:bg-muted",
        task.status === "closed" && "opacity-60",
      )}
    >
      <StatusIcon className={cn("h-3.5 w-3.5 shrink-0", config.color)} />
      <span className="text-muted-foreground shrink-0 font-mono text-xs">
        {stripTaskPrefix(task.id, issuePrefix)}
      </span>
      <span className={cn("min-w-0 flex-1 truncate", task.status === "closed" && "line-through")}>
        {task.title}
      </span>
    </button>
  )
}

const statusConfig: Record<TaskStatus, StatusConfig> = {
  open: {
    icon: IconCircle,
    label: "Open",
    color: "text-gray-500",
  },
  in_progress: {
    icon: IconCircleDot,
    label: "In Progress",
    color: "text-blue-500",
  },
  blocked: {
    icon: IconBan,
    label: "Blocked",
    color: "text-red-500",
  },
  deferred: {
    icon: IconClock,
    label: "Deferred",
    color: "text-amber-500",
  },
  closed: {
    icon: IconCircleCheck,
    label: "Closed",
    color: "text-green-500",
  },
}

type StatusConfig = {
  icon: TablerIcon
  label: string
  color: string
}

type Props = {
  task: RelatedTask
  issuePrefix: string | null
}
