import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import {
  useAppStore,
  selectTaskSearchQuery,
  selectClosedTimeFilter,
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
  tasks,
  className,
  onStatusChange,
  onTaskClick,
  defaultCollapsed = {},
  showEmptyGroups = false,
  persistCollapsedState = true,
}: TaskListProps) {
  const searchQuery = useAppStore(selectTaskSearchQuery)
  const closedTimeFilter = useAppStore(selectClosedTimeFilter)
  const setClosedTimeFilter = useAppStore(state => state.setClosedTimeFilter)
  const setVisibleTaskIds = useAppStore(state => state.setVisibleTaskIds)

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
        blocked: defaultCollapsed.blocked ?? base.blocked,
        ready: defaultCollapsed.ready ?? base.ready,
        in_progress: defaultCollapsed.in_progress ?? base.in_progress,
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

    const sortTasks = (tasks: TaskCardTask[], groupKey: TaskGroup): TaskCardTask[] => {
      if (groupKey === "closed") {
        return [...tasks].sort((a, b) => {
          const aTime = a.closed_at ? new Date(a.closed_at).getTime() : 0
          const bTime = b.closed_at ? new Date(b.closed_at).getTime() : 0
          return bTime - aTime
        })
      }
      return [...tasks].sort((a, b) => {
        const priorityDiff = (a.priority ?? 4) - (b.priority ?? 4)
        if (priorityDiff !== 0) return priorityDiff
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
          const priorityDiff = (a.priority ?? 4) - (b.priority ?? 4)
          if (priorityDiff !== 0) return priorityDiff
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
      if (allUngroupedTasks.length > 0) {
        parentSubGroups.push({ parent: null, tasks: allUngroupedTasks })
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
  }, [tasks, closedTimeFilter, searchQuery])

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
                                  className="pl-5"
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

const DEFAULT_STATUS_COLLAPSED_STATE: Record<TaskGroup, boolean> = {
  blocked: true,
  ready: false,
  in_progress: false,
  closed: true,
}

/**
 * Check if a task has unsatisfied blocking dependencies (not closed/deferred)
 */
function hasUnsatisfiedBlockingDependencies(task: TaskCardTask): boolean {
  if (!task.dependencies) return false
  return task.dependencies.some(
    dep => dep.dependency_type === "blocks" && dep.status !== "closed" && dep.status !== "deferred",
  )
}

const groupConfigs: GroupConfig[] = [
  {
    key: "blocked",
    label: "Blocked",
    taskFilter: task =>
      task.status === "blocked" ||
      (task.status === "open" && hasUnsatisfiedBlockingDependencies(task)),
  },
  {
    key: "ready",
    label: "Ready",
    taskFilter: task => task.status === "open" && !hasUnsatisfiedBlockingDependencies(task),
  },
  {
    key: "in_progress",
    label: "In progress",
    taskFilter: task => task.status === "in_progress",
  },
  {
    key: "closed",
    label: "Closed",
    taskFilter: task => task.status === "deferred" || task.status === "closed",
  },
]

export type TaskListProps = {
  tasks: TaskCardTask[]
  className?: string
  onStatusChange?: (id: string, status: TaskStatus) => void
  onTaskClick?: (id: string) => void
  defaultCollapsed?: Partial<Record<TaskGroup, boolean>>
  showEmptyGroups?: boolean
  persistCollapsedState?: boolean
}

type GroupConfig = {
  key: TaskGroup
  label: string
  taskFilter: (task: TaskCardTask) => boolean
}

type ParentSubGroup = {
  parent: TaskCardTask | null
  tasks: TaskCardTask[]
}

type StatusGroupData = {
  config: GroupConfig
  parentSubGroups: ParentSubGroup[]
  totalCount: number
}
