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
import { TaskGroupHeader } from "./TaskGroupHeader"
import { TaskSubtree } from "./TaskSubtree"
import { loadParentCollapsedState } from "@/lib/loadParentCollapsedState"
import { loadStatusCollapsedState } from "@/lib/loadStatusCollapsedState"
import { matchesSearchQuery } from "@/lib/matchesSearchQuery"
import { saveParentCollapsedState } from "@/lib/saveParentCollapsedState"
import { saveStatusCollapsedState } from "@/lib/saveStatusCollapsedState"
import {
  buildTaskTree,
  findRootAncestor,
  countAllNodes,
  type TaskTreeNode,
} from "@/lib/buildTaskTree"
import type { TaskCardTask, TaskGroup, TaskStatus } from "@/types"
import { TaskListSkeleton } from "./TaskListSkeleton"

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
  /** Whether tasks are currently loading */
  isLoading = false,
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
        deferred: defaultCollapsed.deferred ?? base.deferred,
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
    const isClosedStatus = (status: TaskStatus) => status === "closed" || status === "deferred"

    // Build the task tree for efficient hierarchy lookup
    const { roots, taskMap, childrenMap } = buildTaskTree(tasks)

    // Filter tasks by search query and time filter
    const filteredTasks = tasks.filter(task => {
      if (!matchesSearchQuery(task, searchQuery)) return false

      // For closed tasks, apply time filter (unless searching)
      if (isClosedStatus(task.status) && closedCutoff && !searchQuery.trim()) {
        const closedAt = task.closed_at ? new Date(task.closed_at) : null
        if (!closedAt || closedAt < closedCutoff) {
          return false
        }
      }

      return true
    })

    // Build a set of filtered task IDs for quick lookup
    const filteredTaskIds = new Set(filteredTasks.map(t => t.id))

    // Helper to determine which status group a task tree belongs to
    // Uses the root ancestor's status when it's open
    const getStatusGroupForTask = (task: TaskCardTask): TaskGroup | null => {
      const rootAncestor = findRootAncestor(task, taskMap)
      const rootIsOpen = !isClosedStatus(rootAncestor.status)

      if (rootIsOpen) {
        // Use root's status group
        const config = groupConfigs.find(g => g.taskFilter(rootAncestor))
        return config?.key ?? null
      } else {
        // Use task's own status
        const config = groupConfigs.find(g => g.taskFilter(task))
        return config?.key ?? null
      }
    }

    // Build filtered tree nodes from roots, only including visible tasks
    const buildFilteredTree = (task: TaskCardTask, includeTask: boolean): TaskTreeNode | null => {
      const children = childrenMap.get(task.id) ?? []
      const filteredChildren: TaskTreeNode[] = []

      for (const child of children) {
        const childIsVisible = filteredTaskIds.has(child.id)
        const childNode = buildFilteredTree(child, childIsVisible)
        if (childNode) {
          filteredChildren.push(childNode)
        }
      }

      // Include this node if it's visible OR has visible children
      if (includeTask || filteredChildren.length > 0) {
        return {
          task,
          children: filteredChildren,
        }
      }

      return null
    }

    // Sort tree nodes by priority/closed_at
    const sortTreeNodes = (nodes: TaskTreeNode[], groupKey: TaskGroup): TaskTreeNode[] => {
      const sortedNodes = [...nodes].sort((a, b) => {
        if (groupKey === "closed" || groupKey === "deferred") {
          const aTime = a.task.closed_at ? new Date(a.task.closed_at).getTime() : 0
          const bTime = b.task.closed_at ? new Date(b.task.closed_at).getTime() : 0
          return bTime - aTime // Most recent first
        }

        // Check for actively working tasks
        const aHasActive = treeHasActiveTask(a)
        const bHasActive = treeHasActiveTask(b)
        if (aHasActive && !bHasActive) return -1
        if (!aHasActive && bHasActive) return 1

        // Priority (ascending)
        const priorityDiff = (a.task.priority ?? 4) - (b.task.priority ?? 4)
        if (priorityDiff !== 0) return priorityDiff

        // Bugs first
        const aIsBug = a.task.issue_type === "bug"
        const bIsBug = b.task.issue_type === "bug"
        if (aIsBug && !bIsBug) return -1
        if (!aIsBug && bIsBug) return 1

        // Created_at (oldest first)
        const aTime = a.task.created_at ? new Date(a.task.created_at).getTime() : 0
        const bTime = b.task.created_at ? new Date(b.task.created_at).getTime() : 0
        return aTime - bTime
      })

      // Recursively sort children
      return sortedNodes.map(node => ({
        ...node,
        children: sortTreeNodes(node.children, groupKey),
      }))
    }

    // Helper to check if a tree contains an actively working task
    const treeHasActiveTask = (node: TaskTreeNode): boolean => {
      if (activelyWorkingTaskIds.has(node.task.id)) return true
      return node.children.some(child => treeHasActiveTask(child))
    }

    // Group tasks by status group
    const statusToTrees = new Map<TaskGroup, TaskTreeNode[]>()
    for (const config of groupConfigs) {
      statusToTrees.set(config.key, [])
    }

    // Process each root and assign to appropriate status group
    for (const root of roots) {
      const rootIsVisible = filteredTaskIds.has(root.task.id)
      const filteredRoot = buildFilteredTree(root.task, rootIsVisible)

      if (filteredRoot) {
        // Determine status group based on root task
        const groupKey = getStatusGroupForTask(root.task)
        if (groupKey) {
          statusToTrees.get(groupKey)!.push(filteredRoot)
        }
      }
    }

    // Also handle orphaned tasks (tasks whose parent is not in the list)
    for (const task of filteredTasks) {
      // If task has a parent that's not in taskMap, it's an orphan at this level
      if (task.parent && !taskMap.has(task.parent)) {
        // Check if this task is already included as a root
        const alreadyIncluded = roots.some(r => r.task.id === task.id)
        if (!alreadyIncluded) {
          const groupKey = getStatusGroupForTask(task)
          if (groupKey) {
            const orphanNode: TaskTreeNode = {
              task,
              children: [],
            }
            // Add children if they exist
            const children = childrenMap.get(task.id) ?? []
            for (const child of children) {
              if (filteredTaskIds.has(child.id)) {
                const childNode = buildFilteredTree(child, true)
                if (childNode) orphanNode.children.push(childNode)
              }
            }
            statusToTrees.get(groupKey)!.push(orphanNode)
          }
        }
      }
    }

    // Build result
    const result: StatusGroupData[] = []

    for (const config of groupConfigs) {
      const trees = statusToTrees.get(config.key)!
      const sortedTrees = sortTreeNodes(trees, config.key)

      // Count all tasks in the trees
      const totalCount = sortedTrees.reduce((sum, tree) => sum + countAllNodes(tree), 0)

      result.push({
        config,
        trees: sortedTrees,
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

    // Recursively collect visible task IDs from a tree node
    const collectVisibleIds = (node: TaskTreeNode) => {
      ids.push(node.task.id)
      const isCollapsed = parentCollapsedState[node.task.id] ?? false
      if (!isCollapsed) {
        for (const child of node.children) {
          collectVisibleIds(child)
        }
      }
    }

    for (const { config, trees } of visibleStatusGroups) {
      const isStatusCollapsed = statusCollapsedState[config.key]
      if (!isStatusCollapsed) {
        for (const tree of trees) {
          collectVisibleIds(tree)
        }
      }
    }
    return ids
  }, [visibleStatusGroups, statusCollapsedState, parentCollapsedState])

  useEffect(() => {
    setVisibleTaskIds(visibleTaskIds)
  }, [visibleTaskIds, setVisibleTaskIds])

  const hasTasks = statusGroups.some(g => g.totalCount > 0)

  // Show skeleton while loading
  if (isLoading) {
    return <TaskListSkeleton className={className} />
  }

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
      {visibleStatusGroups.map(({ config, trees, totalCount }) => {
        const isStatusCollapsed = statusCollapsedState[config.key]

        return (
          <div key={config.key} role="listitem" aria-label={`${config.label} group`}>
            <TaskGroupHeader
              label={config.label}
              count={totalCount}
              isCollapsed={isStatusCollapsed}
              onToggle={() => toggleStatusGroup(config.key)}
              timeFilter={
                config.key === "closed" || config.key === "deferred" ? closedTimeFilter : undefined
              }
              onTimeFilterChange={
                config.key === "closed" || config.key === "deferred" ?
                  setClosedTimeFilter
                : undefined
              }
            />
            {!isStatusCollapsed && (
              <div role="group" aria-label={`${config.label} tasks`}>
                {trees.length > 0 ?
                  trees.map(tree => (
                    <TaskSubtree
                      key={tree.task.id}
                      node={tree}
                      depth={0}
                      onStatusChange={onStatusChange}
                      onTaskClick={onTaskClick}
                      newTaskIds={newTaskIds}
                      activelyWorkingTaskIds={activelyWorkingTaskIds}
                      collapsedState={parentCollapsedState}
                      onToggleCollapse={toggleParentGroup}
                    />
                  ))
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
 * Default collapsed state for status groups (open is expanded, deferred and closed are collapsed).
 */
const DEFAULT_STATUS_COLLAPSED_STATE: Record<TaskGroup, boolean> = {
  open: false,
  deferred: true,
  closed: true,
}

/**
 * Configuration for the three status groups: open (ready/in progress/blocked), deferred, and closed.
 */
const groupConfigs: GroupConfig[] = [
  {
    key: "open",
    label: "Open",
    taskFilter: task =>
      task.status === "open" || task.status === "in_progress" || task.status === "blocked",
  },
  {
    key: "deferred",
    label: "Deferred",
    taskFilter: task => task.status === "deferred",
  },
  {
    key: "closed",
    label: "Closed",
    taskFilter: task => task.status === "closed",
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
  /** Whether tasks are currently loading */
  isLoading?: boolean
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
 * A complete status group with its task trees.
 */
type StatusGroupData = {
  /** Group configuration */
  config: GroupConfig
  /** Task trees (hierarchical structure) */
  trees: TaskTreeNode[]
  /** Total count of all tasks in this status group */
  totalCount: number
}
