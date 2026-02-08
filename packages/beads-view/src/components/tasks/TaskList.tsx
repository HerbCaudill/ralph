import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import { cn } from "../../lib/cn"
import { GroupedTaskList } from "./GroupedTaskList"
import { buildTaskTree } from "../../lib/buildTaskTree"
import { countAllNodes } from "../../lib/countAllNodes"
import { findRootAncestor } from "../../lib/findRootAncestor"
import { getTimeFilterCutoff } from "../../lib/getTimeFilterCutoff"
import { matchesSearchQuery } from "../../lib/matchesSearchQuery"
import {
  useBeadsViewStore,
  selectStatusCollapsedState,
  selectParentCollapsedState,
} from "../../store"
import type { Task, TaskGroup, TaskStatus, TaskTreeNode, ClosedTasksTimeFilter } from "../../types"
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
  /** Task IDs actively being worked on */
  activelyWorkingTaskIds: activelyWorkingTaskIdsList = [],
  /** Task IDs with saved sessions */
  taskIdsWithSessions: taskIdsWithSessionsList = [],
  /** Search query to filter tasks */
  searchQuery = "",
  /** Time filter for closed tasks */
  closedTimeFilter = "past_day",
  /** Callback when closed time filter changes */
  onClosedTimeFilterChange,
  /** Callback when visible task IDs change */
  onVisibleTaskIdsChange,
}: TaskListProps) {
  const activelyWorkingTaskIds = useMemo(
    () => new Set(activelyWorkingTaskIdsList),
    [activelyWorkingTaskIdsList],
  )
  const taskIdsWithSessions = useMemo(
    () => new Set(taskIdsWithSessionsList),
    [taskIdsWithSessionsList],
  )

  // Get collapsed states from store
  const storeStatusCollapsedState = useBeadsViewStore(selectStatusCollapsedState)
  const storeParentCollapsedState = useBeadsViewStore(selectParentCollapsedState)
  const toggleStatusGroup = useBeadsViewStore(state => state.toggleStatusGroup)
  const toggleParentGroup = useBeadsViewStore(state => state.toggleParentGroup)

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

  // Use local state for tests (when persistCollapsedState is false)
  // Use store state for production (when persistCollapsedState is true)
  const [localStatusCollapsed, setLocalStatusCollapsed] = useState<Record<TaskGroup, boolean>>(
    () => ({
      open: defaultCollapsed.open ?? DEFAULT_STATUS_COLLAPSED_STATE.open,
      deferred: defaultCollapsed.deferred ?? DEFAULT_STATUS_COLLAPSED_STATE.deferred,
      closed: defaultCollapsed.closed ?? DEFAULT_STATUS_COLLAPSED_STATE.closed,
    }),
  )
  const [localParentCollapsed, setLocalParentCollapsed] = useState<Record<string, boolean>>({})

  // Select between store state and local state based on persistCollapsedState
  const statusCollapsedState =
    persistCollapsedState ? storeStatusCollapsedState : localStatusCollapsed
  const parentCollapsedState =
    persistCollapsedState ? storeParentCollapsedState : localParentCollapsed

  // Create handlers that work with either store or local state
  const handleToggleStatusGroup = useCallback(
    (group: TaskGroup) => {
      if (persistCollapsedState) {
        toggleStatusGroup(group)
      } else {
        setLocalStatusCollapsed(prev => ({
          ...prev,
          [group]: !prev[group],
        }))
      }
    },
    [persistCollapsedState, toggleStatusGroup],
  )

  const handleToggleParentGroup = useCallback(
    (parentId: string) => {
      if (persistCollapsedState) {
        toggleParentGroup(parentId)
      } else {
        setLocalParentCollapsed(prev => ({
          ...prev,
          [parentId]: !prev[parentId],
        }))
      }
    },
    [persistCollapsedState, toggleParentGroup],
  )

  const statusGroups = useMemo(() => {
    const closedCutoff = getTimeFilterCutoff(closedTimeFilter)

    // Helper to check if a task status is "terminal" (closed or deferred) for grouping purposes.
    // Used to determine if a subtask should stay with its parent or use its own status group.
    const isTerminalStatus = (status: TaskStatus) => status === "closed" || status === "deferred"

    // Helper to check if a task should have time-based filtering applied.
    // Only applies to closed tasks (not deferred - those are intentionally postponed).
    const shouldApplyTimeFilter = (status: TaskStatus) => status === "closed"

    // Build the task tree for efficient hierarchy lookup
    const { roots, taskMap, childrenMap } = buildTaskTree(tasks)

    // Filter tasks by search query and time filter
    const filteredTasks = tasks.filter(task => {
      if (!matchesSearchQuery(task, searchQuery)) return false

      // For closed tasks, apply time filter (unless searching)
      if (shouldApplyTimeFilter(task.status) && closedCutoff && !searchQuery.trim()) {
        // Treat missing closed_at as "just now" so newly closed tasks are always shown
        const closedAt = task.closed_at ? new Date(task.closed_at) : new Date()
        if (closedAt < closedCutoff) {
          return false
        }
      }

      return true
    })

    // Build a set of filtered task IDs for quick lookup
    const filteredTaskIds = new Set(filteredTasks.map(t => t.id))

    // Helper to determine which status group a task tree belongs to
    // Uses the root ancestor's status when it's open (not closed/deferred)
    const getStatusGroupForTask = (task: Task): TaskGroup | null => {
      const rootAncestor = findRootAncestor(task, taskMap)
      const rootIsOpen = !isTerminalStatus(rootAncestor.status)

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
    const buildFilteredTree = (task: Task, includeTask: boolean): TaskTreeNode | null => {
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

    // Set to track tasks that have been added to a group (to avoid duplicates)
    const addedTaskIds = new Set<string>()

    // Helper to add a task (with its subtree) to the appropriate status group
    const addTaskToGroup = (task: Task, includeChildren: boolean): void => {
      if (addedTaskIds.has(task.id)) return
      if (!filteredTaskIds.has(task.id)) return

      const groupKey = getStatusGroupForTask(task)
      if (!groupKey) return

      // Build tree node - either with children or as a leaf
      let node: TaskTreeNode
      if (includeChildren) {
        const builtNode = buildFilteredTree(task, true)
        if (!builtNode) return
        node = builtNode
      } else {
        node = { task, children: [] }
      }

      statusToTrees.get(groupKey)!.push(node)
      addedTaskIds.add(task.id)

      // Mark all descendants as added to avoid processing them again
      const markDescendantsAdded = (n: TaskTreeNode) => {
        for (const child of n.children) {
          addedTaskIds.add(child.task.id)
          markDescendantsAdded(child)
        }
      }
      markDescendantsAdded(node)
    }

    // Process each root and assign to appropriate status group
    for (const root of roots) {
      const rootIsTerminal = isTerminalStatus(root.task.status)
      const rootGroupKey = getStatusGroupForTask(root.task)

      if (rootIsTerminal) {
        // For terminal roots (closed/deferred), check if children belong to the same group
        // If all children belong to the same group as the root, keep the tree together
        // If some children belong to different groups, split them out
        const children = childrenMap.get(root.task.id) ?? []
        const sameGroupChildren: Task[] = []
        const differentGroupChildren: Task[] = []

        for (const child of children) {
          if (!filteredTaskIds.has(child.id)) continue
          const childGroupKey = getStatusGroupForTask(child)
          if (childGroupKey === rootGroupKey) {
            sameGroupChildren.push(child)
          } else {
            differentGroupChildren.push(child)
          }
        }

        if (differentGroupChildren.length > 0) {
          // Some children belong to different groups - add root as leaf, process children separately
          if (filteredTaskIds.has(root.task.id)) {
            // Build root with only same-group children
            const nodeWithSameGroupChildren: TaskTreeNode = {
              task: root.task,
              children: sameGroupChildren
                .map(child => {
                  const builtChild = buildFilteredTree(child, true)
                  return builtChild!
                })
                .filter(Boolean),
            }
            if (rootGroupKey) {
              statusToTrees.get(rootGroupKey)!.push(nodeWithSameGroupChildren)
              addedTaskIds.add(root.task.id)
              // Mark same-group children as added
              const markAdded = (n: TaskTreeNode) => {
                addedTaskIds.add(n.task.id)
                for (const c of n.children) markAdded(c)
              }
              for (const c of nodeWithSameGroupChildren.children) markAdded(c)
            }
          }

          // Process different-group children as independent roots
          for (const child of differentGroupChildren) {
            addTaskToGroup(child, true)
          }
        } else {
          // All children belong to the same group as root - keep tree together
          addTaskToGroup(root.task, true)
        }
      } else {
        // For open roots, keep the entire tree together
        addTaskToGroup(root.task, true)
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
    return statusGroups.filter(group => {
      if (showEmptyGroups) return true
      // Always show "open" and "closed" groups, even when empty
      if (group.config.key === "open" || group.config.key === "closed") return true
      // Only show "deferred" group if it has tasks
      return group.totalCount > 0
    })
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
    onVisibleTaskIdsChange?.(visibleTaskIds)
  }, [visibleTaskIds, onVisibleTaskIdsChange])

  const hasTasks = statusGroups.some(g => g.totalCount > 0)

  const groupDescriptors = useMemo(
    () =>
      visibleStatusGroups.map(({ config, trees, totalCount }) => ({
        key: config.key,
        label: config.label,
        trees,
        count: totalCount,
        isCollapsed: statusCollapsedState[config.key],
        onToggle: () => handleToggleStatusGroup(config.key),
        timeFilter: config.key === "closed" ? closedTimeFilter : undefined,
        onTimeFilterChange: config.key === "closed" ? onClosedTimeFilterChange : undefined,
      })),
    [
      visibleStatusGroups,
      statusCollapsedState,
      handleToggleStatusGroup,
      closedTimeFilter,
      onClosedTimeFilterChange,
    ],
  )

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
    <GroupedTaskList
      groups={groupDescriptors}
      className={className}
      onTaskClick={onTaskClick}
      newTaskIds={newTaskIds}
      activelyWorkingTaskIds={activelyWorkingTaskIds}
      taskIdsWithSessions={taskIdsWithSessions}
      collapsedState={parentCollapsedState}
      onToggleCollapse={handleToggleParentGroup}
    />
  )
}

/**  Default collapsed state for status groups (open is expanded, deferred and closed are collapsed). */
const DEFAULT_STATUS_COLLAPSED_STATE: Record<TaskGroup, boolean> = {
  open: false,
  deferred: true,
  closed: true,
}

/**  Configuration for the three status groups: open (ready/in progress/blocked), deferred, and closed. */
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

/**  Props for the TaskList component. */
export type TaskListProps = {
  /** Array of tasks to display and organize */
  tasks: Task[]
  /** Additional CSS classes to apply */
  className?: string
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
  /** Task IDs actively being worked on */
  activelyWorkingTaskIds?: string[]
  /** Task IDs with saved sessions */
  taskIdsWithSessions?: string[]
  /** Search query to filter tasks */
  searchQuery?: string
  /** Time filter for closed tasks */
  closedTimeFilter?: ClosedTasksTimeFilter
  /** Callback when closed time filter changes */
  onClosedTimeFilterChange?: (filter: ClosedTasksTimeFilter) => void
  /** Callback when visible task IDs change */
  onVisibleTaskIdsChange?: (ids: string[]) => void
}

/**  Configuration for a task status group. */
type GroupConfig = {
  /** The status group key ("open" or "closed") */
  key: TaskGroup
  /** Human-readable label for the group */
  label: string
  /** Function to filter tasks into this group */
  taskFilter: (task: Task) => boolean
}

/**  A complete status group with its task trees. */
type StatusGroupData = {
  /** Group configuration */
  config: GroupConfig
  /** Task trees (hierarchical structure) */
  trees: TaskTreeNode[]
  /** Total count of all tasks in this status group */
  totalCount: number
}
