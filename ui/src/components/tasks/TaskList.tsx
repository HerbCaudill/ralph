import { cn } from "@/lib/utils"
import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import { IconChevronDown } from "@tabler/icons-react"
import { TaskCard, type TaskCardTask, type TaskStatus } from "./TaskCard"
import {
  useAppStore,
  selectTaskSearchQuery,
  selectClosedTimeFilter,
  getTimeFilterCutoff,
  type ClosedTasksTimeFilter,
} from "@/store"

// Constants

const STATUS_STORAGE_KEY = "ralph-ui-task-list-collapsed-state"
const PARENT_STORAGE_KEY = "ralph-ui-task-list-parent-collapsed-state"

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
        "bg-muted/50 hover:bg-muted border-border flex cursor-pointer items-center gap-2 border-b px-2 py-1.5",
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
      <span className="text-xs font-medium">{label}</span>
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

// TaskList Component

/**
 * List component for displaying tasks grouped by status and parent.
 * - Primary grouping is by status (Ready, In Progress, Blocked, Closed)
 * - Within each status group, tasks are sub-grouped by their parent task (epic or regular task)
 * - Tasks without a parent are shown at the end of each status group
 * - Each status group is collapsible
 * - Each parent task sub-group is also collapsible independently
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

/** Load parent collapsed state from localStorage */
function loadParentCollapsedState(): Record<string, boolean> | null {
  if (typeof window === "undefined") return null
  try {
    const stored = localStorage.getItem(PARENT_STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored) as Record<string, boolean>
    }
  } catch {
    // Ignore parse errors
  }
  return null
}

/** Save parent collapsed state to localStorage */
function saveParentCollapsedState(state: Record<string, boolean>): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(PARENT_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage errors
  }
}

/** Structure for a parent task sub-group within a status group */
interface ParentSubGroup {
  parent: TaskCardTask | null // null for ungrouped tasks
  tasks: TaskCardTask[]
}

/** Structure for a status group with its parent task sub-groups */
interface StatusGroupData {
  config: GroupConfig
  parentSubGroups: ParentSubGroup[]
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

  // Track newly added task IDs to highlight them
  const [newTaskIds, setNewTaskIds] = useState<Set<string>>(new Set())
  const previousTaskIdsRef = useRef<Set<string> | null>(null)

  // Detect newly added tasks by comparing current tasks with previous tasks
  useEffect(() => {
    const currentTaskIds = new Set(tasks.map(t => t.id))
    const previousTaskIds = previousTaskIdsRef.current

    // On first render, just initialize the ref without marking anything as new
    if (previousTaskIds === null) {
      previousTaskIdsRef.current = currentTaskIds
      return
    }

    // Find tasks that are in current but not in previous (newly added)
    const addedTaskIds = new Set([...currentTaskIds].filter(id => !previousTaskIds.has(id)))

    if (addedTaskIds.size > 0) {
      setNewTaskIds(addedTaskIds)

      // Clear the new task IDs after animation duration (600ms for bounceIn)
      const timer = setTimeout(() => {
        setNewTaskIds(new Set())
      }, 600)

      // Update the previous task IDs reference
      previousTaskIdsRef.current = currentTaskIds

      return () => clearTimeout(timer)
    } else {
      // Update the previous task IDs reference even when no new tasks
      previousTaskIdsRef.current = currentTaskIds
    }
  }, [tasks])

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

  // Initialize parent collapsed state from localStorage
  const [parentCollapsedState, setParentCollapsedState] = useState<Record<string, boolean>>(() => {
    return persistCollapsedState ? (loadParentCollapsedState() ?? {}) : {}
  })

  // Persist status collapsed state to localStorage when it changes
  useEffect(() => {
    if (persistCollapsedState) {
      saveStatusCollapsedState(statusCollapsedState)
    }
  }, [statusCollapsedState, persistCollapsedState])

  // Persist parent collapsed state to localStorage when it changes
  useEffect(() => {
    if (persistCollapsedState) {
      saveParentCollapsedState(parentCollapsedState)
    }
  }, [parentCollapsedState, persistCollapsedState])

  const toggleStatusGroup = useCallback((group: TaskGroup) => {
    setStatusCollapsedState(prev => ({
      ...prev,
      [group]: !prev[group],
    }))
  }, [])

  const toggleParentGroup = useCallback((parentId: string) => {
    setParentCollapsedState(prev => ({
      ...prev,
      [parentId]: !prev[parentId],
    }))
  }, [])

  // Group tasks by status first, then by parent within each status
  const statusGroups = useMemo(() => {
    // Get the time cutoff for closed tasks filtering
    const closedCutoff = getTimeFilterCutoff(closedTimeFilter)

    // First, identify all parent tasks (tasks that have children)
    const parentTaskMap = new Map<string, TaskCardTask>()
    const childTaskIds = new Set<string>()

    // Identify parent-child relationships
    for (const task of tasks) {
      if (task.parent) {
        childTaskIds.add(task.id)
        // Find the parent task
        const parentTask = tasks.find(t => t.id === task.parent)
        if (parentTask && !parentTaskMap.has(parentTask.id)) {
          parentTaskMap.set(parentTask.id, parentTask)
        }
      }
    }

    // Group tasks by status, then by parent
    const statusToParentTasks = new Map<TaskGroup, Map<string | null, TaskCardTask[]>>()

    // Initialize status groups
    for (const config of groupConfigs) {
      statusToParentTasks.set(config.key, new Map())
    }

    for (const task of tasks) {
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

      const parentTasksMap = statusToParentTasks.get(config.key)!

      // For parent tasks, add them to their own group
      // For child tasks, group by their parent
      if (parentTaskMap.has(task.id)) {
        // This task is a parent - add it to its own group (using its own ID as the key)
        if (!parentTasksMap.has(task.id)) {
          parentTasksMap.set(task.id, [])
        }
        // Don't add the parent to the array - it will be rendered separately
      } else if (task.parent && parentTaskMap.has(task.parent)) {
        // This is a child task with a valid parent
        if (!parentTasksMap.has(task.parent)) {
          parentTasksMap.set(task.parent, [])
        }
        parentTasksMap.get(task.parent)!.push(task)
      } else {
        // This is a standalone task (no parent, not a parent)
        if (!parentTasksMap.has(null)) {
          parentTasksMap.set(null, [])
        }
        parentTasksMap.get(null)!.push(task)
      }
    }

    // Build status groups with parent-child sub-groups
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
      const parentTasksMap = statusToParentTasks.get(config.key)!
      const parentSubGroups: ParentSubGroup[] = []

      // Get all parent tasks that belong to this status group
      const parentsInStatus = Array.from(parentTasksMap.keys())
        .filter((id): id is string => id !== null)
        .map(id => parentTaskMap.get(id)!)
        .filter(Boolean)
        .filter(parent => config.statusFilter(parent.status))
        .sort((a, b) => {
          const priorityDiff = (a.priority ?? 4) - (b.priority ?? 4)
          if (priorityDiff !== 0) return priorityDiff
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
          return aTime - bTime
        })

      // Add parent task sub-groups with their children
      for (const parent of parentsInStatus) {
        const childTasks = sortTasks(parentTasksMap.get(parent.id) ?? [], config.key)
        parentSubGroups.push({ parent, tasks: childTasks })
      }

      // Add ungrouped tasks (no parent) at the end
      // Also include tasks whose parent is in a different status group
      const ungroupedTasks = sortTasks(parentTasksMap.get(null) ?? [], config.key)
      const orphanedTasks: TaskCardTask[] = []

      // Find tasks whose parent is not in this status group
      for (const [parentId, tasks] of parentTasksMap.entries()) {
        if (parentId !== null && !parentsInStatus.find(p => p.id === parentId)) {
          orphanedTasks.push(...tasks)
        }
      }

      const allUngroupedTasks = sortTasks([...ungroupedTasks, ...orphanedTasks], config.key)
      if (allUngroupedTasks.length > 0) {
        parentSubGroups.push({ parent: null, tasks: allUngroupedTasks })
      }

      const totalCount = parentSubGroups.reduce((sum, g) => {
        // Count the parent itself plus its child tasks
        return sum + (g.parent ? 1 : 0) + g.tasks.length
      }, 0)

      result.push({
        config,
        parentSubGroups,
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
    <div className={cn("h-full overflow-y-auto", className)} role="list" aria-label="Task list">
      {/* Status groups with parent task sub-groups - sections shrink to fit content */}
      {visibleStatusGroups.map(({ config, parentSubGroups, totalCount }) => {
        const isStatusCollapsed = statusCollapsedState[config.key]

        return (
          <div key={config.key} role="listitem" aria-label={`${config.label} group`}>
            <TaskGroupHeader
              label={config.label}
              count={totalCount}
              isCollapsed={isStatusCollapsed}
              onToggle={() => toggleStatusGroup(config.key)}
              timeFilter={config.key === "closed" ? closedTimeFilter : undefined}
              onTimeFilterChange={config.key === "closed" ? setClosedTimeFilter : undefined}
            />
            {!isStatusCollapsed && (
              <div role="group" aria-label={`${config.label} tasks`}>
                {parentSubGroups.length > 0 ?
                  parentSubGroups.map(({ parent, tasks: childTasks }) => {
                    if (parent) {
                      // Parent task with subtasks
                      const isParentCollapsed = parentCollapsedState[parent.id] ?? false
                      return (
                        <div key={parent.id} role="group" aria-label={`${parent.title} sub-group`}>
                          {/* Parent task card */}
                          <TaskCard
                            task={parent}
                            onStatusChange={onStatusChange}
                            onClick={onTaskClick}
                            isNew={newTaskIds.has(parent.id)}
                            isCollapsed={isParentCollapsed}
                            onToggleCollapse={() => toggleParentGroup(parent.id)}
                            subtaskCount={childTasks.length}
                          />
                          {/* Subtasks (indented) */}
                          {!isParentCollapsed && childTasks.length > 0 && (
                            <div role="group" aria-label={`${parent.title} tasks`}>
                              {childTasks.map(task => (
                                <TaskCard
                                  key={task.id}
                                  task={task}
                                  onStatusChange={onStatusChange}
                                  onClick={onTaskClick}
                                  isNew={newTaskIds.has(task.id)}
                                  className="pl-5"
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    } else {
                      // Ungrouped tasks (no parent)
                      return childTasks.map(task => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onStatusChange={onStatusChange}
                          onClick={onTaskClick}
                          isNew={newTaskIds.has(task.id)}
                        />
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
