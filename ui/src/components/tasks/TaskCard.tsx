import { cn } from "@/lib/utils"
import { forwardRef, useCallback, useState } from "react"
import {
  IconCircle,
  IconCircleDot,
  IconCircleCheck,
  IconBan,
  IconClock,
  IconBug,
  IconSparkles,
  IconStack2,
  type TablerIcon,
} from "@tabler/icons-react"

// Types

export type TaskStatus = "open" | "in_progress" | "blocked" | "deferred" | "closed"

export interface TaskCardTask {
  /** Unique task ID (e.g., "rui-4rt.5") */
  id: string
  /** Task title */
  title: string
  /** Optional description */
  description?: string
  /** Task status */
  status: TaskStatus
  /** Priority (0 = highest, 4 = lowest) */
  priority?: number
  /** Issue type (e.g., "task", "bug", "epic") */
  issue_type?: string
  /** Parent issue ID */
  parent?: string
  /** Timestamp when task was created */
  created_at?: string
  /** Timestamp when task was closed */
  closed_at?: string
  /** Labels attached to this task */
  labels?: string[]
}

export interface TaskCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onClick"> {
  /** The task to display */
  task: TaskCardTask
  /** Callback when status is changed */
  onStatusChange?: (id: string, status: TaskStatus) => void
  /** Callback when task is clicked */
  onClick?: (id: string) => void
}

// Status Configuration

interface StatusConfig {
  icon: TablerIcon
  label: string
  color: string
  bgColor: string
}

const statusConfig: Record<TaskStatus, StatusConfig> = {
  open: {
    icon: IconCircle,
    label: "Open",
    color: "text-status-neutral",
    bgColor: "bg-status-neutral/10",
  },
  in_progress: {
    icon: IconCircleDot,
    label: "In Progress",
    color: "text-status-info",
    bgColor: "bg-status-info/10",
  },
  blocked: {
    icon: IconBan,
    label: "Blocked",
    color: "text-status-error",
    bgColor: "bg-status-error/10",
  },
  deferred: {
    icon: IconClock,
    label: "Deferred",
    color: "text-status-warning",
    bgColor: "bg-status-warning/10",
  },
  closed: {
    icon: IconCircleCheck,
    label: "Closed",
    color: "text-status-success",
    bgColor: "bg-status-success/10",
  },
}

// Available Statuses for Transition

const availableStatuses: TaskStatus[] = ["open", "in_progress", "blocked", "deferred", "closed"]

// Issue Type Configuration (only for non-task types)

interface TypeConfig {
  icon: TablerIcon
  label: string
  color: string
}

export const typeConfig: Record<string, TypeConfig> = {
  bug: {
    icon: IconBug,
    label: "Bug",
    color: "text-status-error",
  },
  feature: {
    icon: IconSparkles,
    label: "Feature",
    color: "text-primary",
  },
  epic: {
    icon: IconStack2,
    label: "Epic",
    color: "text-primary",
  },
}

// Priority Configuration (only for non-P2 priorities)

interface PriorityConfig {
  label: string
  color: string
  bgColor: string
}

const priorityConfig: Record<number, PriorityConfig> = {
  0: {
    label: "P0",
    color: "text-status-error",
    bgColor: "bg-status-error/20",
  },
  1: {
    label: "P1",
    color: "text-status-warning",
    bgColor: "bg-status-warning/15",
  },
  3: {
    label: "P3",
    color: "text-status-neutral",
    bgColor: "bg-status-neutral/10",
  },
  4: {
    label: "P4",
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
  },
}

// TaskCard Component

/**
 * Card component for displaying an individual task.
 * Shows task title and status indicator.
 * Clicking opens the task details dialog.
 * Supports inline status changes via dropdown.
 */
export const TaskCard = forwardRef<HTMLDivElement, TaskCardProps>(function TaskCard(
  { task, className, onStatusChange, onClick, ...props },
  ref,
) {
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false)

  const config = statusConfig[task.status]
  const StatusIcon = config.icon

  const handleClick = useCallback(() => {
    onClick?.(task.id)
  }, [onClick, task.id])

  const handleStatusClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (onStatusChange) {
        setIsStatusMenuOpen(prev => !prev)
      }
    },
    [onStatusChange],
  )

  const handleStatusSelect = useCallback(
    (status: TaskStatus) => {
      onStatusChange?.(task.id, status)
      setIsStatusMenuOpen(false)
    },
    [onStatusChange, task.id],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        handleClick()
      }
    },
    [handleClick],
  )

  return (
    <div
      ref={ref}
      className={cn(
        "border-border hover:bg-muted/50 group border-b transition-colors",
        task.status === "closed" && "opacity-60",
        className,
      )}
      {...props}
    >
      {/* Main row */}
      <div className="flex w-full items-center gap-2 px-3 py-2">
        {/* Status indicator button */}
        <button
          type="button"
          onClick={handleStatusClick}
          className={cn(
            "relative shrink-0 rounded p-0.5 transition-colors",
            onStatusChange && "hover:bg-muted cursor-pointer",
            !onStatusChange && "cursor-default",
          )}
          aria-label={`Status: ${config.label}${onStatusChange ? ". Click to change." : ""}`}
          aria-haspopup={onStatusChange ? "listbox" : undefined}
          aria-expanded={isStatusMenuOpen}
        >
          <StatusIcon className={cn("size-4", config.color)} />

          {/* Status dropdown menu */}
          {isStatusMenuOpen && (
            <div
              className="bg-popover border-border absolute top-full left-0 z-10 mt-1 min-w-32 rounded-md border py-1 shadow-lg"
              role="listbox"
              aria-label="Select status"
            >
              {availableStatuses.map(status => {
                const sc = statusConfig[status]
                const Icon = sc.icon
                return (
                  <div
                    key={status}
                    role="option"
                    tabIndex={0}
                    aria-selected={status === task.status}
                    onClick={e => {
                      e.stopPropagation()
                      handleStatusSelect(status)
                    }}
                    onKeyDown={e => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        e.stopPropagation()
                        handleStatusSelect(status)
                      }
                    }}
                    className={cn(
                      "hover:bg-muted flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-sm",
                      status === task.status && "bg-muted",
                    )}
                  >
                    <Icon className={cn("size-3.5", sc.color)} />
                    <span>{sc.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </button>

        {/* Clickable content area */}
        <div
          role="button"
          tabIndex={0}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2"
          aria-label={task.title}
        >
          {/* Title */}
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-sm",
              task.status === "closed" && "line-through",
            )}
          >
            {task.title}
          </span>

          {/* Type and Priority indicators (right side) */}
          <div className="flex shrink-0 items-center gap-1.5">
            {/* Issue type icon (only for non-task types) */}
            {task.issue_type && task.issue_type !== "task" && typeConfig[task.issue_type] && (
              <span
                className={cn("flex items-center", typeConfig[task.issue_type].color)}
                title={typeConfig[task.issue_type].label}
                aria-label={`Type: ${typeConfig[task.issue_type].label}`}
              >
                {(() => {
                  const TypeIcon = typeConfig[task.issue_type].icon
                  return <TypeIcon className="size-3.5" />
                })()}
              </span>
            )}

            {/* Priority badge (only for non-P2) */}
            {task.priority !== undefined &&
              task.priority !== 2 &&
              priorityConfig[task.priority] && (
                <span
                  className={cn(
                    "rounded px-1 py-0.5 text-[10px] leading-none font-medium",
                    priorityConfig[task.priority].color,
                    priorityConfig[task.priority].bgColor,
                  )}
                  title={`Priority: ${priorityConfig[task.priority].label}`}
                  aria-label={`Priority: ${priorityConfig[task.priority].label}`}
                >
                  {priorityConfig[task.priority].label}
                </span>
              )}
          </div>
        </div>
      </div>
    </div>
  )
})
