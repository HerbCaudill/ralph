import { cn } from "../../lib/cn"
import { stripTaskPrefix } from "../../lib/stripTaskPrefix"
import { buildTaskIdPath } from "../../lib/buildTaskIdPath"
import {
  IconCircle,
  IconCircleDot,
  IconCircleCheck,
  IconBan,
  IconClock,
  type TablerIcon,
} from "@tabler/icons-react"
import type { RelatedTask, TaskStatus } from "../../types"

export function TaskLink({ task, issuePrefix }: Props) {
  const config = statusConfig[task.status] || statusConfig.open
  const StatusIcon = config.icon

  return (
    <a
      href={buildTaskIdPath(task.id)}
      className={cn(
        "flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm transition-colors",
        "hover:bg-muted",
        task.status === "closed" && "opacity-60",
      )}
    >
      {/* Only show icon for non-open statuses - open status shows a placeholder to maintain alignment */}
      {task.status !== "open" ?
        <StatusIcon className={cn("size-3.5 shrink-0", config.color)} />
      : <span className="inline-block size-3.5 shrink-0" />}
      <span className="text-muted-foreground shrink-0 font-mono text-xs">
        {stripTaskPrefix(task.id, issuePrefix)}
      </span>
      <span className={cn("min-w-0 flex-1 truncate", task.status === "closed" && "line-through")}>
        {task.title}
      </span>
    </a>
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
