import { cn, stripTaskPrefix } from "@/lib/utils"
import {
  IconCircle,
  IconCircleDot,
  IconCircleCheck,
  IconBan,
  IconClock,
  IconExternalLink,
  type TablerIcon,
} from "@tabler/icons-react"
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card"
import { Button } from "@/components/ui/button"
import { useAppStore, selectIssuePrefix } from "@/store"
import type { TaskCardTask, TaskStatus } from "./TaskCard"

// Types

export interface TaskHoverCardProps {
  /** The task to display */
  task: TaskCardTask
  /** Trigger element (the task card row) */
  children: React.ReactNode
  /** Whether hover card is disabled */
  disabled?: boolean
  /** Callback when "Open details" is clicked */
  onOpenDetails?: (id: string) => void
}

// Status Configuration

interface StatusConfig {
  icon: TablerIcon
  label: string
  color: string
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

// Priority labels

const priorityLabels: Record<number, string> = {
  0: "P0",
  1: "P1",
  2: "P2",
  3: "P3",
  4: "P4",
}

// TaskHoverCard Component

/**
 * Hover card that displays task details when hovering over a task.
 * Designed so that the status icon and title align with the underlying task card.
 */
export function TaskHoverCard({
  task,
  children,
  disabled = false,
  onOpenDetails,
}: TaskHoverCardProps) {
  const config = statusConfig[task.status]
  const StatusIcon = config.icon
  const issuePrefix = useAppStore(selectIssuePrefix)

  if (disabled) {
    return <>{children}</>
  }

  return (
    <HoverCard openDelay={400} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="w-72 p-0" side="right" align="start" sideOffset={8}>
        <div className="flex flex-col">
          {/* Metadata row - above the title */}
          <div className="border-border flex items-center gap-2 border-b px-3 py-2">
            <span className="text-muted-foreground font-mono text-xs">
              {stripTaskPrefix(task.id, issuePrefix)}
            </span>
            {task.priority !== undefined && (
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-xs font-medium",
                  task.priority === 0 && "bg-red-500/10 text-red-500",
                  task.priority === 1 && "bg-orange-500/10 text-orange-500",
                  task.priority === 2 && "bg-yellow-500/10 text-yellow-500",
                  task.priority === 3 && "bg-blue-500/10 text-blue-500",
                  task.priority === 4 && "bg-gray-500/10 text-gray-500",
                )}
              >
                {priorityLabels[task.priority] ?? `P${task.priority}`}
              </span>
            )}
            {task.issue_type && (
              <span className="text-muted-foreground text-xs capitalize">{task.issue_type}</span>
            )}
          </div>

          {/* Title row - aligns with the original card's icon + title */}
          <div className="flex items-center gap-2 px-3 py-2">
            <StatusIcon className={cn("size-4 shrink-0", config.color)} />
            <span
              className={cn(
                "min-w-0 flex-1 text-sm font-medium",
                task.status === "closed" && "line-through opacity-60",
              )}
            >
              {task.title}
            </span>
          </div>

          {/* Description */}
          {task.description && (
            <div className="border-border border-t px-3 py-2">
              <p className="text-muted-foreground line-clamp-4 text-xs whitespace-pre-wrap">
                {task.description}
              </p>
            </div>
          )}

          {/* Parent info */}
          {task.parent && (
            <div className="border-border border-t px-3 py-2">
              <span className="text-muted-foreground text-xs">
                Parent:{" "}
                <span className="font-mono">{stripTaskPrefix(task.parent, issuePrefix)}</span>
              </span>
            </div>
          )}

          {/* Open details button */}
          {onOpenDetails && (
            <div className="border-border border-t px-3 py-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={e => {
                  e.stopPropagation()
                  onOpenDetails(task.id)
                }}
              >
                <IconExternalLink className="size-3.5" />
                Open details
              </Button>
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
