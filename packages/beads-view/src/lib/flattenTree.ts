import type { TaskCardTask, TaskTreeNode } from "../types"

/** Flatten a task tree into a pre-order list. */
export function flattenTree(
  /** Node to flatten. */
  node: TaskTreeNode,
): TaskCardTask[] {
  const result: TaskCardTask[] = [node.task]
  for (const child of node.children) {
    result.push(...flattenTree(child))
  }
  return result
}
