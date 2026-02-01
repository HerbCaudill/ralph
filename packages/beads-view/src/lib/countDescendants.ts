import type { TaskTreeNode } from "../types"

/** Count all descendant nodes for a task tree node. */
export function countDescendants(
  /** Node to count descendants for. */
  node: TaskTreeNode,
): number {
  let count = node.children.length
  for (const child of node.children) {
    count += countDescendants(child)
  }
  return count
}
