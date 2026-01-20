import { cn } from "@/lib/utils"
import { useState, useCallback, useMemo, useEffect } from "react"
import { IconChevronDown, IconStack2 } from "@tabler/icons-react"
import { TaskCard, type TaskCardTask, type TaskStatus } from "./TaskCard"
import { TaskHoverCard } from "./TaskHoverCard"
import {
  useAppStore,
  selectTaskSearchQuery,
  selectClosedTimeFilter,
  getTimeFilterCutoff,
  type ClosedTasksTimeFilter,
} from "@/store"

// Constants

const STATUS_STORAGE_KEY = "ralph-ui-task-list-collapsed-state"
const EPIC_STORAGE_KEY = "ralph-ui-task-list-epic-collapsed-state"

/** Human-readable labels for time filter options */
const closedTimeFilterLabels: Record<ClosedTasksTimeFilter, string> = {
  past_hour: "Past hour",
  past_day: "Past day",
  past_week: "Past week",
  all_time: "All time",
}

// Types

/** Task status groups for display in the task list. */
export type TaskGroup = "blocked" | "ready" | "in_progress" | "closed"

export interface TaskListProps {
  /** Tasks to display in the list */
  tasks: TaskCardTask[]
  /** Additional CSS classes */
  className?: string
  /** Callback when a task's status is changed */
  onStatusChange?: (id: string, status: TaskStatus) => void
  /** Callback when a task is clicked */
  onTaskClick?: (id: string) => void
  /** Initial collapsed state for groups (overrides localStorage and defaults) */
  defaultCollapsed?: Partial<Record<TaskGroup, boolean>>
  /** Whether to show empty groups (default: false) */
  showEmptyGroups?: boolean
  /** Whether to persist collapsed state to localStorage (default: true) */
  persistCollapsedState?: boolean
}

// Group Configuration

interface GroupConfig {
  key: TaskGroup
  label: string
  statusFilter: (status: TaskStatus) => boolean
}

const groupConfigs: GroupConfig[] = [
  {
    key: "blocked",
    label: "Blocked",
    statusFilter: status => status === "blocked",
  },
  {
    key: "ready",
    label: "Ready",
    statusFilter: status => status === "open",
  },
  {
    key: "in_progress",
    label: "In progress",
    statusFilter: status => status === "in_progress",
  },
  {
    key: "closed",
    label: "Closed",
    statusFilter: status => status === "deferred" || status === "closed",
  },
]

// TaskGroupHeader Component

interface TaskGroupHeaderProps {
  label: string
  count: number
  isCollapsed: boolean
  onToggle: () => void
  /** Optional time filter for closed tasks */
  timeFilter?: ClosedTasksTimeFilter
  /** Callback when time filter changes */
  onTimeFilterChange?: (filter: ClosedTasksTimeFilter) => void
}

function TaskGroupHeader({
  label,
  count,
  isCollapsed,
  onToggle,
  timeFilter,
  onTimeFilterChange,
}: TaskGroupHeaderProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        onToggle()
      }
    },
    [onToggle],
  )

  const handleFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      e.stopPropagation()
      onTimeFilterChange?.(e.target.value as ClosedTasksTimeFilter)
    },
    [onTimeFilterChange],
  )

  const handleFilterClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation() // Prevent toggle when clicking dropdown
  }, [])

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={handleKeyDown}
      className={cn(
        "bg-muted/50 hover:bg-muted border-border flex cursor-pointer items-center gap-2 border-b px-3 py-2",
        "transition-colors",
      )}
      aria-expanded={!isCollapsed}
      aria-label={`${label} section, ${count} task${count === 1 ? "" : "s"}`}
    >
      <IconChevronDown
        className={cn(
          "text-muted-foreground size-3.5 shrink-0 transition-transform",
          isCollapsed && "-rotate-90",
        )}
      />
      <span className="text-sm font-medium">{label}</span>
      {timeFilter && onTimeFilterChange && (
        <select
          value={timeFilter}
          onChange={handleFilterChange}
          onClick={handleFilterClick}
          onKeyDown={e => e.stopPropagation()}
          className={cn(
            "text-muted-foreground bg-muted hover:bg-muted/80 cursor-pointer rounded px-1.5 py-0.5 text-xs",
            "focus:ring-ring border-0 outline-none focus:ring-1",
          )}
          aria-label="Filter closed tasks by time"
        >
          {(Object.keys(closedTimeFilterLabels) as ClosedTasksTimeFilter[]).map(filter => (
            <option key={filter} value={filter}>
              {closedTimeFilterLabels[filter]}
            </option>
          ))}
        </select>
      )}
      <span className="text-muted-foreground bg-muted rounded px-1.5 py-0.5 text-xs">{count}</span>
    </div>
  )
}

// EpicGroupHeader Component

interface EpicGroupHeaderProps {
  epicId: string
  epicTitle: string
  taskCount: number
  isCollapsed: boolean
  onToggle: () => void
}

function EpicGroupHeader({
  epicId,
  epicTitle,
  taskCount,
  isCollapsed,
  onToggle,
}: EpicGroupHeaderProps) {
  const hasSubtasks = taskCount > 0

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!hasSubtasks) return
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        onToggle()
      }
    },
    [onToggle, hasSubtasks],
  )

  const handleClick = useCallback(() => {
    if (hasSubtasks) {
      onToggle()
    }
  }, [hasSubtasks, onToggle])

  return (
    <div
      role={hasSubtasks ? "button" : undefined}
      tabIndex={hasSubtasks ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "bg-muted/30 border-border flex items-center gap-2 border-b px-3 py-2",
        "transition-colors",
        hasSubtasks && "hover:bg-muted/50 cursor-pointer",
      )}
      aria-expanded={hasSubtasks ? !isCollapsed : undefined}
      aria-label={
        hasSubtasks ?
          `${epicTitle} epic, ${taskCount} task${taskCount === 1 ? "" : "s"}`
        : `${epicTitle} epic`
      }
    >
      {hasSubtasks && (
        <IconChevronDown
          className={cn(
            "text-muted-foreground size-3.5 shrink-0 transition-transform",
            isCollapsed && "-rotate-90",
          )}
        />
      )}
      <IconStack2 className="text-primary size-3.5 shrink-0" />
      <span className="text-muted-foreground shrink-0 font-mono text-xs">{epicId}</span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{epicTitle}</span>
      {hasSubtasks && (
        <span className="text-muted-foreground bg-muted shrink-0 rounded px-1.5 py-0.5 text-xs">
          {taskCount}
        </span>
      )}
    </div>
  )
}

// TaskList Component

/**
 * List component for displaying tasks grouped by status and epic.
 * - Primary grouping is by status (Ready, In Progress, Blocked, Closed)
 * - Within each status group, tasks are sub-grouped by their parent epic
 * - Tasks without an epic are shown at the end of each status group
 * - Each status group is collapsible
 * - Each epic sub-group is also collapsible independently
 */

// Default collapsed state: Ready + In Progress expanded, Blocked + Closed collapsed
const DEFAULT_STATUS_COLLAPSED_STATE: Record<TaskGroup, boolean> = {
  blocked: true, // Collapsed by default
  ready: false,
  in_progress: false,
  closed: true, // Collapsed by default
}

/** Load status collapsed state from localStorage */
function loadStatusCollapsedState(): Record<TaskGroup, boolean> | null {
  if (typeof window === "undefined") return null
  try {
    const stored = localStorage.getItem(STATUS_STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored) as Record<TaskGroup, boolean>
    }
  } catch {
    // Ignore parse errors
  }
  return null
}

/** Save status collapsed state to localStorage */
function saveStatusCollapsedState(state: Record<TaskGroup, boolean>): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage errors
  }
}

/** Load epic collapsed state from localStorage */
function loadEpicCollapsedState(): Record<string, boolean> | null {
  if (typeof window === "undefined") return null
  try {
    const stored = localStorage.getItem(EPIC_STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored) as Record<string, boolean>
    }
  } catch {
    // Ignore parse errors
  }
  return null
}

/** Save epic collapsed state to localStorage */
function saveEpicCollapsedState(state: Record<string, boolean>): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(EPIC_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage errors
  }
}

/** Structure for an epic sub-group within a status group */
interface EpicSubGroup {
  epic: TaskCardTask | null // null for ungrouped tasks
  tasks: TaskCardTask[]
}

/** Structure for a status group with its epic sub-groups */
interface StatusGroupData {
  config: GroupConfig
  epicSubGroups: EpicSubGroup[]
  totalCount: number
}

/** Check if a task matches the search query */
function matchesSearchQuery(task: TaskCardTask, query: string): boolean {
  if (!query.trim()) return true
  const lowerQuery = query.toLowerCase()
  // Search in task id, title, and description
  return (
    task.id.toLowerCase().includes(lowerQuery) ||
    task.title.toLowerCase().includes(lowerQuery) ||
    (task.description?.toLowerCase().includes(lowerQuery) ?? false)
  )
}

export function TaskList({
  tasks,
  className,
  onStatusChange,
  onTaskClick,
  defaultCollapsed = {},
  showEmptyGroups = false,
  persistCollapsedState = true,
}: TaskListProps) {
  // Get search query and closed time filter from store
  const searchQuery = useAppStore(selectTaskSearchQuery)
  const closedTimeFilter = useAppStore(selectClosedTimeFilter)
  const setClosedTimeFilter = useAppStore(state => state.setClosedTimeFilter)

  // Initialize status collapsed state: props override -> localStorage -> defaults
  const [statusCollapsedState, setStatusCollapsedState] = useState<Record<TaskGroup, boolean>>(
    () => {
      const stored = persistCollapsedState ? loadStatusCollapsedState() : null
      const base = stored ?? DEFAULT_STATUS_COLLAPSED_STATE
      return {
        blocked: defaultCollapsed.blocked ?? base.blocked,
        ready: defaultCollapsed.ready ?? base.ready,
        in_progress: defaultCollapsed.in_progress ?? base.in_progress,
        closed: defaultCollapsed.closed ?? base.closed,
      }
    },
  )

  // Initialize epic collapsed state from localStorage
  const [epicCollapsedState, setEpicCollapsedState] = useState<Record<string, boolean>>(() => {
    return persistCollapsedState ? (loadEpicCollapsedState() ?? {}) : {}
  })

  // Persist status collapsed state to localStorage when it changes
  useEffect(() => {
    if (persistCollapsedState) {
      saveStatusCollapsedState(statusCollapsedState)
    }
  }, [statusCollapsedState, persistCollapsedState])

  // Persist epic collapsed state to localStorage when it changes
  useEffect(() => {
    if (persistCollapsedState) {
      saveEpicCollapsedState(epicCollapsedState)
    }
  }, [epicCollapsedState, persistCollapsedState])

  const toggleStatusGroup = useCallback((group: TaskGroup) => {
    setStatusCollapsedState(prev => ({
      ...prev,
      [group]: !prev[group],
    }))
  }, [])

  const toggleEpicGroup = useCallback((epicId: string) => {
    setEpicCollapsedState(prev => ({
      ...prev,
      [epicId]: !prev[epicId],
    }))
  }, [])

  // Group tasks by status first, then by epic within each status
  const statusGroups = useMemo(() => {
    // Get the time cutoff for closed tasks filtering
    const closedCutoff = getTimeFilterCutoff(closedTimeFilter)

    // First, identify all epics and create a map
    const epicMap = new Map<string, TaskCardTask>()
    for (const task of tasks) {
      if (task.issue_type === "epic") {
        epicMap.set(task.id, task)
      }
    }

    // Group non-epic tasks by status, then by parent epic
    const statusToEpicTasks = new Map<TaskGroup, Map<string | null, TaskCardTask[]>>()

    // Initialize status groups
    for (const config of groupConfigs) {
      statusToEpicTasks.set(config.key, new Map())
    }

    for (const task of tasks) {
      if (task.issue_type === "epic") continue // Don't show epics as tasks

      // Apply search filter
      if (!matchesSearchQuery(task, searchQuery)) continue

      // Find which status group this task belongs to
      const config = groupConfigs.find(g => g.statusFilter(task.status))
      if (!config) continue

      // Apply time filter for closed tasks
      if (config.key === "closed" && closedCutoff) {
        const closedAt = task.closed_at ? new Date(task.closed_at) : null
        if (!closedAt || closedAt < closedCutoff) {
          continue // Skip tasks closed before the cutoff
        }
      }

      const epicTasksMap = statusToEpicTasks.get(config.key)!
      const epicId = task.parent && epicMap.has(task.parent) ? task.parent : null

      if (!epicTasksMap.has(epicId)) {
        epicTasksMap.set(epicId, [])
      }
      epicTasksMap.get(epicId)!.push(task)
    }

    // Build status groups with epic sub-groups
    const result: StatusGroupData[] = []

    // Sort function for tasks: closed tasks by closed_at (most recent first), others by priority then created_at
    const sortTasks = (tasks: TaskCardTask[], groupKey: TaskGroup): TaskCardTask[] => {
      if (groupKey === "closed") {
        // Sort closed tasks by closed_at timestamp, most recently closed first
        return [...tasks].sort((a, b) => {
          const aTime = a.closed_at ? new Date(a.closed_at).getTime() : 0
          const bTime = b.closed_at ? new Date(b.closed_at).getTime() : 0
          return bTime - aTime // Descending order (most recent first)
        })
      }
      // Sort other tasks by priority, then by created_at (oldest first within same priority)
      return [...tasks].sort((a, b) => {
        const priorityDiff = (a.priority ?? 4) - (b.priority ?? 4)
        if (priorityDiff !== 0) return priorityDiff
        // Secondary sort by created_at (oldest first)
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
        return aTime - bTime
      })
    }

    for (const config of groupConfigs) {
      const epicTasksMap = statusToEpicTasks.get(config.key)!
      const epicSubGroups: EpicSubGroup[] = []

      // Get all epics that have tasks in this status, sorted by epic priority then created_at
      const epicsInStatus = Array.from(epicTasksMap.keys())
        .filter((id): id is string => id !== null)
        .map(id => epicMap.get(id)!)
        .filter(Boolean)
        .sort((a, b) => {
          const priorityDiff = (a.priority ?? 4) - (b.priority ?? 4)
          if (priorityDiff !== 0) return priorityDiff
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
          return aTime - bTime
        })

      // Add epic sub-groups
      for (const epic of epicsInStatus) {
        const epicTasks = sortTasks(epicTasksMap.get(epic.id) ?? [], config.key)
        if (epicTasks.length > 0) {
          epicSubGroups.push({ epic, tasks: epicTasks })
        }
      }

      // Add ungrouped tasks (null epic) at the end
      const ungroupedTasks = sortTasks(epicTasksMap.get(null) ?? [], config.key)
      if (ungroupedTasks.length > 0) {
        epicSubGroups.push({ epic: null, tasks: ungroupedTasks })
      }

      const totalCount = epicSubGroups.reduce((sum, g) => sum + g.tasks.length, 0)

      result.push({
        config,
        epicSubGroups,
        totalCount,
      })
    }

    return result
  }, [tasks, closedTimeFilter, searchQuery])

  // Filter to only non-empty status groups (or all if showEmptyGroups is true)
  const visibleStatusGroups = useMemo(() => {
    return statusGroups.filter(group => showEmptyGroups || group.totalCount > 0)
  }, [statusGroups, showEmptyGroups])

  // Check if we have any content to show
  const hasTasks = statusGroups.some(g => g.totalCount > 0)

  if (!hasTasks && !showEmptyGroups) {
    return (
      <div
        className={cn(
          "text-muted-foreground flex h-full items-center justify-center p-4 text-center text-sm",
          className,
        )}
        role="status"
        aria-label={searchQuery ? "No matching tasks" : "No tasks"}
      >
        {searchQuery ? "No matching tasks" : "No tasks"}
      </div>
    )
  }

  return (
    <div className={cn("flex h-full flex-col", className)} role="list" aria-label="Task list">
      {/* Status groups with epic sub-groups - each group is a flex item with scrollable content */}
      {visibleStatusGroups.map(({ config, epicSubGroups, totalCount }) => {
        const isStatusCollapsed = statusCollapsedState[config.key]

        return (
          <div
            key={config.key}
            role="listitem"
            aria-label={`${config.label} group`}
            className={cn(
              "flex min-h-0 flex-col",
              // When collapsed, only show the header (shrink-0)
              // When expanded, flex-1 to share space with other expanded groups
              isStatusCollapsed ? "shrink-0" : "flex-1",
            )}
          >
            <TaskGroupHeader
              label={config.label}
              count={totalCount}
              isCollapsed={isStatusCollapsed}
              onToggle={() => toggleStatusGroup(config.key)}
              timeFilter={config.key === "closed" ? closedTimeFilter : undefined}
              onTimeFilterChange={config.key === "closed" ? setClosedTimeFilter : undefined}
            />
            {!isStatusCollapsed && (
              <div
                role="group"
                aria-label={`${config.label} tasks`}
                className="min-h-0 flex-1 overflow-y-auto"
              >
                {epicSubGroups.length > 0 ?
                  epicSubGroups.map(({ epic, tasks: epicTasks }) => {
                    if (epic) {
                      // Epic sub-group
                      const isEpicCollapsed = epicCollapsedState[epic.id] ?? false
                      return (
                        <div key={epic.id} role="group" aria-label={`${epic.title} epic sub-group`}>
                          <EpicGroupHeader
                            epicId={epic.id}
                            epicTitle={epic.title}
                            taskCount={epicTasks.length}
                            isCollapsed={isEpicCollapsed}
                            onToggle={() => toggleEpicGroup(epic.id)}
                          />
                          {!isEpicCollapsed && (
                            <div role="group" aria-label={`${epic.title} tasks`}>
                              {epicTasks.map(task => (
                                <TaskHoverCard
                                  key={task.id}
                                  task={task}
                                  onOpenDetails={onTaskClick}
                                >
                                  <TaskCard
                                    task={task}
                                    onStatusChange={onStatusChange}
                                    onClick={onTaskClick}
                                    className="pl-6"
                                  />
                                </TaskHoverCard>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    } else {
                      // Ungrouped tasks (no epic parent)
                      return epicTasks.map(task => (
                        <TaskHoverCard key={task.id} task={task} onOpenDetails={onTaskClick}>
                          <TaskCard
                            task={task}
                            onStatusChange={onStatusChange}
                            onClick={onTaskClick}
                          />
                        </TaskHoverCard>
                      ))
                    }
                  })
                : <div className="text-muted-foreground px-3 py-3 text-center text-xs italic">
                    No tasks in this group
                  </div>
                }
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
