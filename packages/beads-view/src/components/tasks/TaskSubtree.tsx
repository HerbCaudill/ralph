import { cn } from "../../lib/cn"
import { TaskCard } from "./TaskCard"
import { countDescendants } from "../../lib/countDescendants"
import type { TaskTreeNode } from "../../types"
import type { TaskStatus } from "../../types"

/**
 * Recursively renders a task tree node and its children with proper indentation.
 * Handles collapse/expand state at each level of the hierarchy.
 */
export function TaskSubtree({
  /** The task tree node to render */
  node,
  /** Current nesting depth (0 = root, 1 = child, 2 = grandchild, etc.) */
  depth = 0,
  /** Callback when task status is changed */
  onStatusChange,
  /** Callback when task is clicked */
  onTaskClick,
  /** Set of task IDs that are newly added (for animation) */
  newTaskIds,
  /** Set of task IDs that are actively being worked on */
  activelyWorkingTaskIds,
  /** Set of task IDs that have saved sessions */
  taskIdsWithSessions,
  /** Record of collapsed state by task ID */
  collapsedState,
  /** Callback to toggle collapse state for a task */
  onToggleCollapse,
}: TaskSubtreeProps) {
  const { task, children } = node
  const hasChildren = children.length > 0
  const isCollapsed = collapsedState[task.id] ?? false

  // Count all descendants (not just direct children)
  const descendantCount = countDescendants(node)

  // Generate padding class based on depth level
  // pl-6 = 24px per level of nesting
  const paddingClass = getPaddingClass(depth)

  return (
    <div role="group" aria-label={`${task.title} sub-group`}>
      <TaskCard
        task={task}
        onStatusChange={onStatusChange}
        onClick={onTaskClick}
        isNew={newTaskIds.has(task.id)}
        isCollapsed={hasChildren ? isCollapsed : undefined}
        onToggleCollapse={hasChildren ? () => onToggleCollapse(task.id) : undefined}
        subtaskCount={descendantCount}
        isActivelyWorking={activelyWorkingTaskIds.has(task.id)}
        hasSessions={taskIdsWithSessions?.has(task.id) ?? false}
        className={cn(paddingClass)}
      />
      {hasChildren && !isCollapsed && (
        <div role="group" aria-label={`${task.title} children`}>
          {children.map(childNode => (
            <TaskSubtree
              key={childNode.task.id}
              node={childNode}
              depth={depth + 1}
              onStatusChange={onStatusChange}
              onTaskClick={onTaskClick}
              newTaskIds={newTaskIds}
              activelyWorkingTaskIds={activelyWorkingTaskIds}
              taskIdsWithSessions={taskIdsWithSessions}
              collapsedState={collapsedState}
              onToggleCollapse={onToggleCollapse}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Mapping of depth levels to Tailwind padding classes.
 * Supports up to 6 levels of nesting (after that, uses max depth).
 * pl-6 = 24px per level of nesting.
 */
const DEPTH_PADDING_CLASSES: Record<number, string | undefined> = {
  0: undefined,
  1: "pl-6", // 24px
  2: "pl-12", // 48px
  3: "pl-[72px]", // 72px
  4: "pl-24", // 96px
  5: "pl-[120px]", // 120px
  6: "pl-36", // 144px
}

/**  Returns a Tailwind padding class based on depth level. */
function getPaddingClass(depth: number): string | undefined {
  // Cap at max depth to prevent excessive nesting
  const cappedDepth = Math.min(depth, 6)
  return DEPTH_PADDING_CLASSES[cappedDepth]
}

/**  Props for the TaskSubtree component. */
export interface TaskSubtreeProps {
  /** The task tree node to render */
  node: TaskTreeNode
  /** Current nesting depth */
  depth?: number
  /** Callback when task status is changed */
  onStatusChange?: (id: string, status: TaskStatus) => void
  /** Callback when task is clicked */
  onTaskClick?: (id: string) => void
  /** Set of task IDs that are newly added */
  newTaskIds: Set<string>
  /** Set of task IDs that are actively being worked on */
  activelyWorkingTaskIds: Set<string>
  /** Set of task IDs that have saved sessions */
  taskIdsWithSessions?: Set<string>
  /** Record of collapsed state by task ID */
  collapsedState: Record<string, boolean>
  /** Callback to toggle collapse state */
  onToggleCollapse: (taskId: string) => void
}
