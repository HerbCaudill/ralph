import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import { useShallow } from "zustand/react/shallow"
import { cn } from "@/lib/utils"
import {
  useAppStore,
  selectTaskSearchQuery,
  selectClosedTimeFilter,
  selectActivelyWorkingTaskIds,
  getTimeFilterCutoff,
} from "@/store"
import { TaskCard } from "./TaskCard"
import { TaskGroupHeader } from "./TaskGroupHeader"
import { loadParentCollapsedState } from "@/lib/loadParentCollapsedState"
import { loadStatusCollapsedState } from "@/lib/loadStatusCollapsedState"
import { matchesSearchQuery } from "@/lib/matchesSearchQuery"
import { saveParentCollapsedState } from "@/lib/saveParentCollapsedState"
import { saveStatusCollapsedState } from "@/lib/saveStatusCollapsedState"
import type { TaskCardTask, TaskGroup, TaskStatus } from "@/types"

/**
 * List component for displaying tasks grouped by status and parent.
 * - Primary grouping is by status (Ready, In Progress, Blocked, Closed)
 * - Within each status group, tasks are sub-grouped by their parent task (epic or regular task)
 * - Tasks without a parent are shown at the end of each status group
 * - Each status group is collapsible
 * - Each parent task sub-group is also collapsible independently
 */
export function TaskList({
  /** Array of tasks to display and organize */
  tasks,
  /** Additional CSS classes to apply */
  className,
  /** Callback when task status is changed */
  onStatusChange,
  /** Callback when task is clicked */
  onTaskClick,
  /** Default collapsed state for status groups */
  defaultCollapsed = {},
  /** Whether to show empty status groups */
  showEmptyGroups = false,
  /** Whether to persist collapsed state to localStorage */
  persistCollapsedState = true,
}: TaskListProps) {
  const searchQuery = useAppStore(selectTaskSearchQuery)
  const closedTimeFilter = useAppStore(selectClosedTimeFilter)
  const setClosedTimeFilter = useAppStore(state => state.setClosedTimeFilter)
  const setVisibleTaskIds = useAppStore(state => state.setVisibleTaskIds)
  const activelyWorkingTaskIdsList = useAppStore(useShallow(selectActivelyWorkingTaskIds))
  const activelyWorkingTaskIds = useMemo(
    () => new Set(activelyWorkingTaskIdsList),
    [activelyWorkingTaskIdsList],
  )

  const [newTaskIds, setNewTaskIds] = useState<Set<string>>(new Set())
  const previousTaskIdsRef = useRef<Set<string> | null>(null)

  useEffect(() => {
    const currentTaskIds = new Set(tasks.map(t => t.id))
    const previousTaskIds = previousTaskIdsRef.current

    if (previousTaskIds === null) {
      previousTaskIdsRef.current = currentTaskIds
      return
    }

    const addedTaskIds = new Set([...currentTaskIds].filter(id => !previousTaskIds.has(id)))

    if (addedTaskIds.size > 0) {
      setNewTaskIds(addedTaskIds)

      const timer = setTimeout(() => {
        setNewTaskIds(new Set())
      }, 600)

      previousTaskIdsRef.current = currentTaskIds

      return () => clearTimeout(timer)
    } else {
      previousTaskIdsRef.current = currentTaskIds
    }
  }, [tasks])

  const [statusCollapsedState, setStatusCollapsedState] = useState<Record<TaskGroup, boolean>>(
    () => {
      const stored = persistCollapsedState ? loadStatusCollapsedState() : null
      const base = stored ?? DEFAULT_STATUS_COLLAPSED_STATE
      return {
        open: defaultCollapsed.open ?? base.open,
        closed: defaultCollapsed.closed ?? base.closed,
      }
    },
  )

  const [parentCollapsedState, setParentCollapsedState] = useState<Record<string, boolean>>(() => {
    return persistCollapsedState ? (loadParentCollapsedState() ?? {}) : {}
  })

  useEffect(() => {
    if (persistCollapsedState) {
      saveStatusCollapsedState(statusCollapsedState)
    }
  }, [statusCollapsedState, persistCollapsedState])

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

  const statusGroups = useMemo(() => {
    const closedCutoff = getTimeFilterCutoff(closedTimeFilter)

    const parentTaskMap = new Map<string, TaskCardTask>()
    const childTaskIds = new Set<string>()

    for (const task of tasks) {
      if (task.parent) {
        childTaskIds.add(task.id)
        const parentTask = tasks.find(t => t.id === task.parent)
        if (parentTask && !parentTaskMap.has(parentTask.id)) {
          parentTaskMap.set(parentTask.id, parentTask)
        }
      }
    }

    const statusToParentTasks = new Map<TaskGroup, Map<string | null, TaskCardTask[]>>()

    for (const config of groupConfigs) {
      statusToParentTasks.set(config.key, new Map())
    }

    for (const task of tasks) {
      if (!matchesSearchQuery(task, searchQuery)) continue

      const parentTask = task.parent ? parentTaskMap.get(task.parent) : null
      const isClosedStatus = (status: TaskStatus) => status === "closed" || status === "deferred"
      const parentIsOpen = parentTask && !isClosedStatus(parentTask.status)

      let config: GroupConfig | undefined
      if (parentIsOpen) {
        config = groupConfigs.find(g => g.taskFilter(parentTask))
      } else {
        config = groupConfigs.find(g => g.taskFilter(task))
      }
      if (!config) continue

      const isInClosedGroup = config.key === "closed"
      if (isInClosedGroup && closedCutoff && !searchQuery.trim()) {
        const closedAt = task.closed_at ? new Date(task.closed_at) : null
        if (!closedAt || closedAt < closedCutoff) {
          continue
        }
      }

      const parentTasksMap = statusToParentTasks.get(config.key)!

      if (parentTaskMap.has(task.id)) {
        if (!parentTasksMap.has(task.id)) {
          parentTasksMap.set(task.id, [])
        }
      } else if (task.parent && parentTaskMap.has(task.parent)) {
        if (!parentTasksMap.has(task.parent)) {
          parentTasksMap.set(task.parent, [])
        }
        parentTasksMap.get(task.parent)!.push(task)
      } else {
        if (!parentTasksMap.has(null)) {
          parentTasksMap.set(null, [])
        }
        parentTasksMap.get(null)!.push(task)
      }
    }

    const result: StatusGroupData[] = []

    /**
     * Sort tasks within a group by priority, bug status, and creation time.
     * Closed groups are sorted by closed_at date (most recent first).
     */
    const sortTasks = (
      /** Tasks to sort */
      tasks: TaskCardTask[],
      /** The status group key */
      groupKey: TaskGroup,
    ): TaskCardTask[] => {
      if (groupKey === "closed") {
        return [...tasks].sort((a, b) => {
          const aTime = a.closed_at ? new Date(a.closed_at).getTime() : 0
          const bTime = b.closed_at ? new Date(b.closed_at).getTime() : 0
          return bTime - aTime
        })
      }
      return [...tasks].sort((a, b) => {
        // Top priority: actively working tasks come first
        const aIsActive = activelyWorkingTaskIds.has(a.id)
        const bIsActive = activelyWorkingTaskIds.has(b.id)
        if (aIsActive && !bIsActive) return -1
        if (!aIsActive && bIsActive) return 1
        // Secondary: priority (ascending)
        const priorityDiff = (a.priority ?? 4) - (b.priority ?? 4)
        if (priorityDiff !== 0) return priorityDiff
        // Tertiary: bugs first within same priority
        const aIsBug = a.issue_type === "bug"
        const bIsBug = b.issue_type === "bug"
        if (aIsBug && !bIsBug) return -1
        if (!aIsBug && bIsBug) return 1
        // Quaternary: created_at (oldest first)
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
        return aTime - bTime
      })
    }

    for (const config of groupConfigs) {
      const parentTasksMap = statusToParentTasks.get(config.key)!
      const parentSubGroups: ParentSubGroup[] = []

      const parentsInStatus = Array.from(parentTasksMap.keys())
        .filter((id): id is string => id !== null)
        .map(id => parentTaskMap.get(id)!)
        .filter(Boolean)
        .filter(parent => config.taskFilter(parent))
        .sort((a, b) => {
          // Primary: priority (ascending)
          const priorityDiff = (a.priority ?? 4) - (b.priority ?? 4)
          if (priorityDiff !== 0) return priorityDiff
          // Secondary: bugs first within same priority
          const aIsBug = a.issue_type === "bug"
          const bIsBug = b.issue_type === "bug"
          if (aIsBug && !bIsBug) return -1
          if (!aIsBug && bIsBug) return 1
          // Tertiary: created_at (oldest first)
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
          return aTime - bTime
        })

      for (const parent of parentsInStatus) {
        const childTasks = sortTasks(parentTasksMap.get(parent.id) ?? [], config.key)
        parentSubGroups.push({ parent, tasks: childTasks })
      }

      const ungroupedTasks = sortTasks(parentTasksMap.get(null) ?? [], config.key)
      const orphanedTasks: TaskCardTask[] = []

      for (const [parentId, tasks] of parentTasksMap.entries()) {
        if (parentId !== null && !parentsInStatus.find(p => p.id === parentId)) {
          orphanedTasks.push(...tasks)
        }
      }

      const allUngroupedTasks = sortTasks([...ungroupedTasks, ...orphanedTasks], config.key)
      // Add each ungrouped task as its own group for proper priority interleaving
      for (const task of allUngroupedTasks) {
        parentSubGroups.push({ parent: null, tasks: [task] })
      }

      // Sort all groups (parent groups and ungrouped task groups) by priority or closed_at
      // For parent groups, use parent priority/closed_at; for ungrouped tasks, use first task
      if (config.key === "closed") {
        // For closed groups, sort by most recently closed first
        parentSubGroups.sort((a, b) => {
          // Helper to get the most recent closed_at from a group
          const getGroupClosedAt = (group: ParentSubGroup): number => {
            // For parent groups, use the parent's closed_at
            if (group.parent?.closed_at) {
              return new Date(group.parent.closed_at).getTime()
            }
            // For ungrouped tasks, use the first (only) task's closed_at
            if (group.tasks[0]?.closed_at) {
              return new Date(group.tasks[0].closed_at).getTime()
            }
            return 0
          }

          const aTime = getGroupClosedAt(a)
          const bTime = getGroupClosedAt(b)
          return bTime - aTime // Most recent first
        })
      } else {
        parentSubGroups.sort((a, b) => {
          // Helper to check if a group contains an actively working task
          const groupHasActiveTask = (group: ParentSubGroup): boolean => {
            if (group.parent && activelyWorkingTaskIds.has(group.parent.id)) return true
            return group.tasks.some(t => activelyWorkingTaskIds.has(t.id))
          }

          // Top priority: groups with actively working tasks come first
          const aHasActive = groupHasActiveTask(a)
          const bHasActive = groupHasActiveTask(b)
          if (aHasActive && !bHasActive) return -1
          if (!aHasActive && bHasActive) return 1

          // Secondary: priority (ascending)
          const aPriority = a.parent ? (a.parent.priority ?? 4) : (a.tasks[0]?.priority ?? 4)
          const bPriority = b.parent ? (b.parent.priority ?? 4) : (b.tasks[0]?.priority ?? 4)
          const priorityDiff = aPriority - bPriority
          if (priorityDiff !== 0) return priorityDiff
          // Tertiary: bugs first within same priority
          const aIsBug = a.parent ? a.parent.issue_type === "bug" : a.tasks[0]?.issue_type === "bug"
          const bIsBug = b.parent ? b.parent.issue_type === "bug" : b.tasks[0]?.issue_type === "bug"
          if (aIsBug && !bIsBug) return -1
          if (!aIsBug && bIsBug) return 1
          // Quaternary: created_at (oldest first)
          const aTime =
            a.parent ?
              a.parent.created_at ?
                new Date(a.parent.created_at).getTime()
              : 0
            : a.tasks[0]?.created_at ? new Date(a.tasks[0].created_at).getTime()
            : 0
          const bTime =
            b.parent ?
              b.parent.created_at ?
                new Date(b.parent.created_at).getTime()
              : 0
            : b.tasks[0]?.created_at ? new Date(b.tasks[0].created_at).getTime()
            : 0
          return aTime - bTime
        })
      }

      const totalCount = parentSubGroups.reduce((sum, g) => {
        return sum + (g.parent ? 1 : 0) + g.tasks.length
      }, 0)

      result.push({
        config,
        parentSubGroups,
        totalCount,
      })
    }

    return result
  }, [tasks, closedTimeFilter, searchQuery, activelyWorkingTaskIds])

  const visibleStatusGroups = useMemo(() => {
    return statusGroups.filter(group => showEmptyGroups || group.totalCount > 0)
  }, [statusGroups, showEmptyGroups])

  const visibleTaskIds = useMemo(() => {
    const ids: string[] = []
    for (const { config, parentSubGroups } of visibleStatusGroups) {
      const isStatusCollapsed = statusCollapsedState[config.key]
      if (!isStatusCollapsed) {
        for (const { parent, tasks: childTasks } of parentSubGroups) {
          if (parent) {
            ids.push(parent.id)
            const isParentCollapsed = parentCollapsedState[parent.id] ?? false
            if (!isParentCollapsed) {
              ids.push(...childTasks.map(t => t.id))
            }
          } else {
            ids.push(...childTasks.map(t => t.id))
          }
        }
      }
    }
    return ids
  }, [visibleStatusGroups, statusCollapsedState, parentCollapsedState])

  useEffect(() => {
    setVisibleTaskIds(visibleTaskIds)
  }, [visibleTaskIds, setVisibleTaskIds])

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
                      const isParentCollapsed = parentCollapsedState[parent.id] ?? false
                      return (
                        <div key={parent.id} role="group" aria-label={`${parent.title} sub-group`}>
                          <TaskCard
                            task={parent}
                            onStatusChange={onStatusChange}
                            onClick={onTaskClick}
                            isNew={newTaskIds.has(parent.id)}
                            isCollapsed={isParentCollapsed}
                            onToggleCollapse={() => toggleParentGroup(parent.id)}
                            subtaskCount={childTasks.length}
                            isActivelyWorking={activelyWorkingTaskIds.has(parent.id)}
                          />
                          {!isParentCollapsed && childTasks.length > 0 && (
                            <div role="group" aria-label={`${parent.title} tasks`}>
                              {childTasks.map(task => (
                                <TaskCard
                                  key={task.id}
                                  task={task}
                                  onStatusChange={onStatusChange}
                                  onClick={onTaskClick}
                                  isNew={newTaskIds.has(task.id)}
                                  isActivelyWorking={activelyWorkingTaskIds.has(task.id)}
                                  className="pl-6"
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    }

                    return childTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onStatusChange={onStatusChange}
                        onClick={onTaskClick}
                        isNew={newTaskIds.has(task.id)}
                        isActivelyWorking={activelyWorkingTaskIds.has(task.id)}
                      />
                    ))
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

/**
 * Default collapsed state for status groups (open is expanded, closed is collapsed).
 */
const DEFAULT_STATUS_COLLAPSED_STATE: Record<TaskGroup, boolean> = {
  open: false,
  closed: true,
}

/**
 * Configuration for the two status groups: open (ready/in progress/blocked) and closed.
 */
const groupConfigs: GroupConfig[] = [
  {
    key: "open",
    label: "Open",
    taskFilter: task =>
      task.status === "open" || task.status === "in_progress" || task.status === "blocked",
  },
  {
    key: "closed",
    label: "Closed",
    taskFilter: task => task.status === "deferred" || task.status === "closed",
  },
]

/**
 * Props for the TaskList component.
 */
export type TaskListProps = {
  /** Array of tasks to display and organize */
  tasks: TaskCardTask[]
  /** Additional CSS classes to apply */
  className?: string
  /** Callback when task status is changed */
  onStatusChange?: (id: string, status: TaskStatus) => void
  /** Callback when task is clicked */
  onTaskClick?: (id: string) => void
  /** Initial collapsed state for status groups */
  defaultCollapsed?: Partial<Record<TaskGroup, boolean>>
  /** Whether to show empty status groups */
  showEmptyGroups?: boolean
  /** Whether to persist collapsed state to localStorage */
  persistCollapsedState?: boolean
}

/**
 * Configuration for a task status group.
 */
type GroupConfig = {
  /** The status group key ("open" or "closed") */
  key: TaskGroup
  /** Human-readable label for the group */
  label: string
  /** Function to filter tasks into this group */
  taskFilter: (task: TaskCardTask) => boolean
}

/**
 * A sub-group of tasks under a parent task within a status group.
 */
type ParentSubGroup = {
  /** The parent task (null if tasks are ungrouped) */
  parent: TaskCardTask | null
  /** Child tasks in this sub-group */
  tasks: TaskCardTask[]
}

/**
 * A complete status group with all its parent sub-groups.
 */
type StatusGroupData = {
  /** Group configuration */
  config: GroupConfig
  /** Sub-groups organized by parent task */
  parentSubGroups: ParentSubGroup[]
  /** Total count of all tasks in this status group */
  totalCount: number
}
