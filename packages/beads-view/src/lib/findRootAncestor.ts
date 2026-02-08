import type { Task } from "../types"

/** Find the root ancestor of a task within a task map. */
export function findRootAncestor(
  /** Task to resolve. */
  task: Task,
  /** Lookup of task ID to task. */
  taskMap: Map<string, Task>,
): Task {
  let current = task
  while (current.parent && taskMap.has(current.parent)) {
    current = taskMap.get(current.parent) ?? current
  }
  return current
}
