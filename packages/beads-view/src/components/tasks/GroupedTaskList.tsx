import { cn } from "../../lib/cn"
import { TaskGroupHeader } from "./TaskGroupHeader"
import { TaskSubtree } from "./TaskSubtree"
import type { TaskTreeNode, ClosedTasksTimeFilter } from "../../types"

/**
 * Renders pre-grouped task trees using TaskGroupHeader + TaskSubtree.
 * Callers provide their own groups (e.g. by status, by relationship type).
 */
export function GroupedTaskList({
  groups,
  className,
  onTaskClick,
  newTaskIds = EMPTY_SET,
  activelyWorkingTaskIds = EMPTY_SET,
  taskIdsWithSessions = EMPTY_SET,
  collapsedState = {},
  onToggleCollapse = noop,
  emptyMessage = "No tasks in this group",
}: GroupedTaskListProps) {
  return (
    <div className={cn("h-full overflow-y-auto", className)} role="list" aria-label="Task list">
      {groups.map(group => (
        <div key={group.key} role="listitem" aria-label={`${group.label} group`}>
          <TaskGroupHeader
            label={group.label}
            count={group.count}
            isCollapsed={group.isCollapsed}
            onToggle={group.onToggle}
            timeFilter={group.timeFilter}
            onTimeFilterChange={group.onTimeFilterChange}
          />
          {!group.isCollapsed && (
            <div role="group" aria-label={`${group.label} tasks`}>
              {group.trees.length > 0 ?
                group.trees.map(tree => (
                  <TaskSubtree
                    key={tree.task.id}
                    node={tree}
                    depth={0}
                    onTaskClick={onTaskClick}
                    newTaskIds={newTaskIds}
                    activelyWorkingTaskIds={activelyWorkingTaskIds}
                    taskIdsWithSessions={taskIdsWithSessions}
                    collapsedState={collapsedState}
                    onToggleCollapse={onToggleCollapse}
                  />
                ))
              : <div className="text-muted-foreground px-3 py-3 text-center text-xs italic">
                  {emptyMessage}
                </div>
              }
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

const EMPTY_SET = new Set<string>()

/** No-op function for optional callbacks. */
function noop() {}

/** A group of tasks to render in the GroupedTaskList. */
export type TaskGroupDescriptor = {
  /** Unique identifier for this group. */
  key: string
  /** Display label (e.g. "Open", "Children", "Blocked by"). */
  label: string
  /** Task trees to render in this group. */
  trees: TaskTreeNode[]
  /** Total count of tasks (including nested). */
  count: number
  /** Whether this group is collapsed. */
  isCollapsed: boolean
  /** Callback to toggle collapsed state. */
  onToggle: () => void
  /** Time filter (only for groups that support it, e.g. Closed). */
  timeFilter?: ClosedTasksTimeFilter
  /** Callback when time filter changes. */
  onTimeFilterChange?: (filter: ClosedTasksTimeFilter) => void
}

/** Props for the GroupedTaskList component. */
export type GroupedTaskListProps = {
  /** Groups to render. */
  groups: TaskGroupDescriptor[]
  /** Additional CSS classes. */
  className?: string
  /** Callback when task is clicked. */
  onTaskClick?: (id: string) => void
  /** Set of task IDs that are newly added (for animation). */
  newTaskIds?: Set<string>
  /** Set of task IDs actively being worked on. */
  activelyWorkingTaskIds?: Set<string>
  /** Set of task IDs with saved sessions. */
  taskIdsWithSessions?: Set<string>
  /** Record of collapsed state by task ID (for parent groups within trees). */
  collapsedState?: Record<string, boolean>
  /** Callback to toggle collapse state for a parent task. */
  onToggleCollapse?: (taskId: string) => void
  /** Message shown when a group has no tasks. */
  emptyMessage?: string
}
