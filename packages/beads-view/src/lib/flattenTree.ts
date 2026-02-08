import type { Task, TaskTreeNode } from "../types"

/** Flatten a task tree into a pre-order list. */
export function flattenTree(
  /** Node to flatten. */
  node: TaskTreeNode,
): Task[] {
  const result: Task[] = [node.task]
  for (const child of node.children) {
    result.push(...flattenTree(child))
  }
  return result
}
