import { cn, stripTaskPrefix } from "@/lib/utils"
import { buildTaskIdPath } from "@/hooks/useTaskDialogRouter"
import {
  IconCircle,
  IconCircleDot,
  IconCircleCheck,
  IconBan,
  IconClock,
  type TablerIcon,
} from "@tabler/icons-react"
import type { RelatedTask, TaskStatus } from "@/types"

export function RelationshipGraphNode({
  task,
  issuePrefix,
  isCurrent = false,
  size = "sm",
}: Props) {
  const config = statusConfig[task.status] || statusConfig.open
  const StatusIcon = config.icon

  return (
    <a
      href={buildTaskIdPath(task.id)}
      title={task.title}
      className={cn(
        "flex items-center gap-1.5 rounded-md border-2 transition-all",
        "hover:scale-105 hover:shadow-md",
        config.bgColor,
        config.borderColor,
        isCurrent ? "ring-primary ring-2 ring-offset-2" : "",
        size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm",
        task.status === "closed" && "opacity-60",
      )}
    >
      <StatusIcon
        className={cn("shrink-0", config.textColor, size === "sm" ? "h-3 w-3" : "h-4 w-4")}
      />
      <span className={cn("shrink-0 font-mono", config.textColor)}>
        {stripTaskPrefix(task.id, issuePrefix)}
      </span>
      <span className={cn("max-w-30 truncate", task.status === "closed" && "line-through")}>
        {task.title}
      </span>
    </a>
  )
}

const statusConfig: Record<TaskStatus, StatusConfig> = {
  open: {
    icon: IconCircle,
    label: "Open",
    bgColor: "bg-gray-100 dark:bg-gray-800",
    borderColor: "border-gray-400",
    textColor: "text-gray-600 dark:text-gray-400",
  },
  in_progress: {
    icon: IconCircleDot,
    label: "In Progress",
    bgColor: "bg-blue-50 dark:bg-blue-950",
    borderColor: "border-blue-500",
    textColor: "text-blue-600 dark:text-blue-400",
  },
  blocked: {
    icon: IconBan,
    label: "Blocked",
    bgColor: "bg-red-50 dark:bg-red-950",
    borderColor: "border-red-500",
    textColor: "text-red-600 dark:text-red-400",
  },
  deferred: {
    icon: IconClock,
    label: "Deferred",
    bgColor: "bg-amber-50 dark:bg-amber-950",
    borderColor: "border-amber-500",
    textColor: "text-amber-600 dark:text-amber-400",
  },
  closed: {
    icon: IconCircleCheck,
    label: "Closed",
    bgColor: "bg-green-50 dark:bg-green-950",
    borderColor: "border-green-500",
    textColor: "text-green-600 dark:text-green-400",
  },
}

type StatusConfig = {
  icon: TablerIcon
  label: string
  bgColor: string
  borderColor: string
  textColor: string
}

type Props = {
  task: RelatedTask
  issuePrefix: string | null
  isCurrent?: boolean
  size?: "sm" | "md"
}
