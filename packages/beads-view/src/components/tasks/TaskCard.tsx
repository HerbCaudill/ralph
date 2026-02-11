import { cn } from "../../lib/cn"
import { forwardRef, useCallback, useState, useEffect, useMemo } from "react"
import { useBeadsViewStore, selectSelectedTaskId, selectAccentColor } from "../../store"
import { DEFAULT_ACCENT_COLOR } from "../../constants"
import { IconChevronDown, IconHistory, IconTrash } from "@tabler/icons-react"
import { TaskCardCompact, statusConfig } from "./TaskCardCompact"
import type { Task } from "../../types"

/**
 * Card component for displaying an individual task with status indicator, title, and metadata.
 * Supports collapsible subtasks, priority badges, and type indicators.
 * Composes TaskCardCompact for the core row layout.
 */
export const TaskCard = forwardRef<HTMLDivElement, TaskCardProps>(function TaskCard(
  {
    /** The task data to display */
    task,
    /** Additional CSS classes to apply */
    className,
    /** Callback when task is clicked */
    onClick,
    /** Whether to show new task animation */
    isNew = false,
    /** Whether subtasks are collapsed */
    isCollapsed,
    /** Callback to toggle subtask collapse state */
    onToggleCollapse,
    /** Number of subtasks for this task */
    subtaskCount = 0,
    /** Whether this task is actively being worked on */
    isActivelyWorking = false,
    /** Whether this task has saved session event logs */
    hasSessions = false,
    /** Callback to remove this task (e.g., from a relationship) */
    onRemove,
    ...props
  },
  ref,
) {
  const [shouldAnimate, setShouldAnimate] = useState(isNew)
  const selectedTaskId = useBeadsViewStore(selectSelectedTaskId)
  const accentColor = useBeadsViewStore(selectAccentColor)
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

  // Show spinning animation for all in_progress tasks
  const shouldSpin = !!config.animate

  const handleClick = useCallback(() => {
    // Copy task ID to clipboard when card is clicked
    navigator.clipboard.writeText(task.id)
    onClick?.(task.id)
  }, [onClick, task.id])

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

  const handleRemoveClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onRemove?.(task.id)
    },
    [onRemove, task.id],
  )

  const handleRemoveKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        e.stopPropagation()
        onRemove?.(task.id)
      }
    },
    [onRemove, task.id],
  )

  const hasSubtasks = subtaskCount > 0
  const showChevron = hasSubtasks && onToggleCollapse

  // Compute the selection style with dynamic accent color
  const selectionStyle = useMemo(
    () =>
      isSelected ?
        {
          backgroundColor: `${selectionColor}33`, // 20% opacity (33 in hex ≈ 20%)
          boxShadow: `inset 0 0 0 2px ${selectionColor}b3`, // 70% opacity ring (b3 in hex ≈ 70%)
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

        {/* Status indicator */}
        <div className="shrink-0 rounded p-0.5" aria-label={`Status: ${config.label}`}>
          <StatusIcon className={cn("size-3.5", config.color, shouldSpin && config.animate)} />
        </div>

        {/* Clickable content area - delegates layout to TaskCardCompact */}
        <div
          role="button"
          tabIndex={0}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 cursor-pointer"
          aria-label={task.title}
        >
          <TaskCardCompact task={task} showStatusIcon={false}>
            {/* Subtask count - flush against title */}
            {hasSubtasks && (
              <span
                className="text-muted-foreground bg-muted shrink-0 rounded px-1.5 py-0.5 text-xs"
                title={`${subtaskCount} subtask${subtaskCount === 1 ? "" : "s"}`}
                aria-label={`${subtaskCount} subtask${subtaskCount === 1 ? "" : "s"}`}
              >
                {subtaskCount}
              </span>
            )}

            {/* Session indicator - shows when task has saved event logs */}
            {hasSessions && (
              <IconHistory
                className="text-muted-foreground size-3.5 shrink-0"
                title="Has session history"
                aria-label="Has session history"
              />
            )}
          </TaskCardCompact>
        </div>

        {/* Remove button - appears on hover */}
        {onRemove && (
          <button
            type="button"
            onClick={handleRemoveClick}
            onKeyDown={handleRemoveKeyDown}
            className={cn(
              "text-muted-foreground hover:text-destructive hover:bg-destructive/10",
              "shrink-0 cursor-pointer rounded p-1 opacity-0 transition-all",
              "group-hover:opacity-100 focus:opacity-100",
            )}
            aria-label="Remove"
            title="Remove"
          >
            <IconTrash className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  )
})

/**  Props for the TaskCard component. */
export type TaskCardProps = Omit<React.HTMLAttributes<HTMLDivElement>, "onClick"> & {
  /** The task data to display */
  task: Task
  /** Callback when task is clicked for selection */
  onClick?: (id: string) => void
  /** Whether to show new task animation */
  isNew?: boolean
  /** Whether subtasks are collapsed */
  isCollapsed?: boolean
  /** Callback to toggle subtask collapse state */
  onToggleCollapse?: () => void
  /** Number of subtasks for epic tasks */
  subtaskCount?: number
  /** Whether this task is actively being worked on by a running instance */
  isActivelyWorking?: boolean
  /** Whether this task has saved session event logs */
  hasSessions?: boolean
  /** Callback to remove this task (e.g., from a relationship). Shows trash icon on hover when set. */
  onRemove?: (id: string) => void
}
