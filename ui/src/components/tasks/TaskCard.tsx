import { cn, stripTaskPrefix } from "@/lib/utils"
import { forwardRef, useCallback, useState, useEffect, useMemo } from "react"
import { useAppStore, selectIssuePrefix, selectSelectedTaskId, selectAccentColor } from "@/store"
import { DEFAULT_ACCENT_COLOR } from "@/constants"
import {
  IconCircle,
  IconCircleCheck,
  IconBan,
  IconClock,
  IconBug,
  IconSparkles,
  IconStack2,
  IconCheckbox,
  IconChevronDown,
  IconLoader2,
  type TablerIcon,
} from "@tabler/icons-react"
import type { TaskCardTask, TaskStatus } from "@/types"

export const TaskCard = forwardRef<HTMLDivElement, TaskCardProps>(function TaskCard(
  {
    task,
    className,
    onStatusChange,
    onClick,
    isNew = false,
    isCollapsed,
    onToggleCollapse,
    subtaskCount = 0,
    isActivelyWorking = false,
    ...props
  },
  ref,
) {
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false)
  const [shouldAnimate, setShouldAnimate] = useState(isNew)
  const issuePrefix = useAppStore(selectIssuePrefix)
  const selectedTaskId = useAppStore(selectSelectedTaskId)
  const accentColor = useAppStore(selectAccentColor)
  const isSelected = selectedTaskId === task.id

  // Compute the selection color based on accent color
  const selectionColor = accentColor ?? DEFAULT_ACCENT_COLOR

  // Remove animation class after animation completes
  useEffect(() => {
    if (isNew) {
      setShouldAnimate(true)
      // Remove animation after 600ms (bounceIn animation duration)
      const timer = setTimeout(() => {
        setShouldAnimate(false)
      }, 600)
      return () => clearTimeout(timer)
    }
  }, [isNew])

  const config = statusConfig[task.status]
  const StatusIcon = config.icon
  const displayId = stripTaskPrefix(task.id, issuePrefix)

  // Show spinning animation for all in_progress tasks
  const shouldSpin = !!config.animate

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

  const handleChevronClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onToggleCollapse?.()
    },
    [onToggleCollapse],
  )

  const handleChevronKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        e.stopPropagation()
        onToggleCollapse?.()
      }
    },
    [onToggleCollapse],
  )

  const hasSubtasks = subtaskCount > 0
  const showChevron = hasSubtasks && onToggleCollapse

  // Compute the selection style with dynamic accent color
  const selectionStyle = useMemo(
    () =>
      isSelected ?
        {
          backgroundColor: `${selectionColor}1A`, // 10% opacity (1A in hex = 10%)
          boxShadow: `inset 0 0 0 2px ${selectionColor}80`, // 50% opacity ring (80 in hex = 50%)
        }
      : undefined,
    [isSelected, selectionColor],
  )

  return (
    <div
      ref={ref}
      className={cn(
        "border-border hover:bg-muted/50 group border-b transition-colors",
        task.status === "closed" && "opacity-60",
        shouldAnimate && "animate-bounceIn",
        className,
      )}
      style={selectionStyle}
      data-selected={isSelected}
      data-task-id={task.id}
      {...props}
    >
      {/* Main row */}
      <div className="flex w-full items-center gap-2 px-2 py-1.5">
        {/* Chevron column - always present for consistent alignment */}
        <div className="flex w-4 shrink-0 items-center justify-center">
          {showChevron && (
            <button
              type="button"
              onClick={handleChevronClick}
              onKeyDown={handleChevronKeyDown}
              className={cn(
                "hover:bg-muted shrink-0 cursor-pointer rounded p-0.5 transition-colors",
              )}
              aria-label={isCollapsed ? "Expand subtasks" : "Collapse subtasks"}
              aria-expanded={!isCollapsed}
            >
              <IconChevronDown
                className={cn(
                  "text-muted-foreground size-3.5 transition-transform",
                  isCollapsed && "-rotate-90",
                )}
              />
            </button>
          )}
        </div>

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
          <StatusIcon className={cn("size-3.5", config.color, shouldSpin && config.animate)} />

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
                    <Icon
                      className={cn("size-3.5", sc.color, status === "in_progress" && sc.animate)}
                    />
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
          {/* Task ID */}
          <span className="text-muted-foreground shrink-0 font-mono text-xs">{displayId}</span>

          {/* Title */}
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-xs",
              task.status === "closed" && "line-through",
            )}
          >
            {task.title}
          </span>

          {/* Type and Priority indicators (right side) */}
          <div className="flex shrink-0 items-center gap-1.5">
            {/* Subtask count for epics */}
            {hasSubtasks && (
              <span
                className="text-muted-foreground bg-muted rounded px-1.5 py-0.5 text-[10px] leading-none"
                title={`${subtaskCount} subtask${subtaskCount === 1 ? "" : "s"}`}
                aria-label={`${subtaskCount} subtask${subtaskCount === 1 ? "" : "s"}`}
              >
                {subtaskCount}
              </span>
            )}

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

const statusConfig: Record<TaskStatus, StatusConfig> = {
  open: {
    icon: IconCircle,
    label: "Open",
    color: "text-status-neutral",
    bgColor: "bg-status-neutral/10",
  },
  in_progress: {
    icon: IconLoader2,
    label: "In Progress",
    color: "text-status-info",
    bgColor: "bg-status-info/10",
    animate: "animate-spin",
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

const availableStatuses: TaskStatus[] = ["open", "in_progress", "blocked", "deferred", "closed"]

const typeConfig: Record<string, TypeConfig> = {
  task: {
    icon: IconCheckbox,
    label: "Task",
    color: "text-status-success",
  },
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

const priorityConfig: Record<number, PriorityConfig> = {
  0: {
    label: "P0",
    color: "text-white",
    bgColor: "bg-red-600",
  },
  1: {
    label: "P1",
    color: "text-white",
    bgColor: "bg-orange-600",
  },
  3: {
    label: "P3",
    color: "text-white",
    bgColor: "bg-yellow-500",
  },
  4: {
    label: "P4",
    color: "text-white",
    bgColor: "bg-yellow-400",
  },
}

export type TaskCardProps = Omit<React.HTMLAttributes<HTMLDivElement>, "onClick"> & {
  task: TaskCardTask
  onStatusChange?: (id: string, status: TaskStatus) => void
  onClick?: (id: string) => void
  isNew?: boolean
  isCollapsed?: boolean
  onToggleCollapse?: () => void
  subtaskCount?: number
  /** Whether this task is actively being worked on by a running instance */
  isActivelyWorking?: boolean
}

type StatusConfig = {
  icon: TablerIcon
  label: string
  color: string
  bgColor: string
  animate?: string
}

type TypeConfig = {
  icon: TablerIcon
  label: string
  color: string
}

type PriorityConfig = {
  label: string
  color: string
  bgColor: string
}
