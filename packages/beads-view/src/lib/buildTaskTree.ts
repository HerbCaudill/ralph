import type { Task, TaskTreeNode } from "../types"

/** Build a tree structure and lookup maps from a flat list of tasks. */
export function buildTaskTree(
  /** Flat array of tasks with parent references. */
  tasks: Task[],
): BuildTaskTreeResult {
  const taskMap = new Map<string, Task>()
  const childrenMap = new Map<string, Task[]>()
  const nodeMap = new Map<string, TaskTreeNode>()

  for (const task of tasks) {
    taskMap.set(task.id, task)
    nodeMap.set(task.id, { task, children: [] })
  }

  for (const task of tasks) {
    if (!task.parent || !taskMap.has(task.parent)) continue
    const siblings = childrenMap.get(task.parent) ?? []
    siblings.push(task)
    childrenMap.set(task.parent, siblings)
    const parentNode = nodeMap.get(task.parent)
    const childNode = nodeMap.get(task.id)
    if (parentNode && childNode) {
      parentNode.children.push(childNode)
    }
  }

  const roots: TaskTreeNode[] = []
  for (const task of tasks) {
    if (!task.parent || !taskMap.has(task.parent)) {
      const node = nodeMap.get(task.id)
      if (node) {
        roots.push(node)
      }
    }
  }

  return { roots, taskMap, childrenMap }
}

/** Result of building a task tree. */
type BuildTaskTreeResult = {
  /** Root task nodes. */
  roots: TaskTreeNode[]
  /** Lookup of task ID to task. */
  taskMap: Map<string, Task>
  /** Lookup of parent ID to child tasks. */
  childrenMap: Map<string, Task[]>
}
