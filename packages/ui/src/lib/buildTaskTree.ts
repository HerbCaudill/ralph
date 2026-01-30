import type { TaskCardTask } from "@/types"

/**
 * Represents a task node in the hierarchical tree structure.
 * Each node contains the task data and an array of child nodes.
 */
export interface TaskTreeNode {
  /** The task data */
  task: TaskCardTask
  /** Child nodes (subtasks) */
  children: TaskTreeNode[]
}

/**
 * Finds the root ancestor of a task by traversing up the parent chain.
 * Returns the topmost task in the hierarchy that exists in the task set.
 *
 * @param task - The task to find the root for
 * @param taskMap - Map of task ID to task for efficient lookup
 * @returns The root task, or the original task if it has no parent in the set
 */
export function findRootAncestor(
  task: TaskCardTask,
  taskMap: Map<string, TaskCardTask>,
): TaskCardTask {
  let current = task
  while (current.parent && taskMap.has(current.parent)) {
    current = taskMap.get(current.parent)!
  }
  return current
}

/**
 * Builds a hierarchical tree structure from a flat list of tasks.
 *
 * @param tasks - Flat array of tasks with parent references
 * @returns Object containing:
 *   - roots: Array of root TaskTreeNodes (tasks without parents or whose parents aren't in the list)
 *   - taskMap: Map of task ID to task for efficient lookup
 *   - childrenMap: Map of parent ID to array of children for efficient lookup
 */
export function buildTaskTree(tasks: TaskCardTask[]): {
  roots: TaskTreeNode[]
  taskMap: Map<string, TaskCardTask>
  childrenMap: Map<string, TaskCardTask[]>
} {
  // Build lookup maps
  const taskMap = new Map<string, TaskCardTask>()
  for (const task of tasks) {
    taskMap.set(task.id, task)
  }

  // Build parent -> children map
  const childrenMap = new Map<string, TaskCardTask[]>()
  for (const task of tasks) {
    if (task.parent && taskMap.has(task.parent)) {
      const siblings = childrenMap.get(task.parent) ?? []
      siblings.push(task)
      childrenMap.set(task.parent, siblings)
    }
  }

  // Find root tasks (those without parents in the task set)
  const rootTasks: TaskCardTask[] = []
  for (const task of tasks) {
    if (!task.parent || !taskMap.has(task.parent)) {
      rootTasks.push(task)
    }
  }

  // Recursively build tree nodes
  function buildNode(task: TaskCardTask): TaskTreeNode {
    const children = childrenMap.get(task.id) ?? []
    return {
      task,
      children: children.map(buildNode),
    }
  }

  const roots = rootTasks.map(buildNode)

  return { roots, taskMap, childrenMap }
}

/**
 * Counts all descendants of a task node (children, grandchildren, etc.)
 *
 * @param node - The task tree node
 * @returns Total count of all descendant tasks
 */
export function countDescendants(node: TaskTreeNode): number {
  let count = node.children.length
  for (const child of node.children) {
    count += countDescendants(child)
  }
  return count
}

/**
 * Counts all nodes in a tree (including the root)
 *
 * @param node - The task tree node
 * @returns Total count of this node plus all descendants
 */
export function countAllNodes(node: TaskTreeNode): number {
  return 1 + countDescendants(node)
}

/**
 * Flattens a tree into a list of all tasks
 *
 * @param node - The task tree node
 * @returns Array of all tasks in the tree (pre-order traversal)
 */
export function flattenTree(node: TaskTreeNode): TaskCardTask[] {
  const result: TaskCardTask[] = [node.task]
  for (const child of node.children) {
    result.push(...flattenTree(child))
  }
  return result
}
