import type { TaskTreeNode } from "../types"
import { countDescendants } from "./countDescendants"

/** Count the node itself plus all descendants. */
export function countAllNodes(
  /** Node to count. */
  node: TaskTreeNode,
): number {
  return 1 + countDescendants(node)
}
