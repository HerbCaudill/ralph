import { describe, it, expect } from "vitest"
import { buildTaskTree } from "./buildTaskTree"
import { countAllNodes } from "./countAllNodes"
import { countDescendants } from "./countDescendants"
import { findRootAncestor } from "./findRootAncestor"
import { flattenTree } from "./flattenTree"
import type { TaskCardTask } from "../types"

describe("buildTaskTree", () => {
  describe("findRootAncestor", () => {
    it("returns the task itself when it has no parent", () => {
      const task: TaskCardTask = { id: "task-1", title: "Root", status: "open" }
      const taskMap = new Map<string, TaskCardTask>([["task-1", task]])

      expect(findRootAncestor(task, taskMap)).toBe(task)
    })

    it("returns the task itself when parent is not in the map", () => {
      const task: TaskCardTask = {
        id: "task-1",
        title: "Orphan",
        status: "open",
        parent: "missing-parent",
      }
      const taskMap = new Map<string, TaskCardTask>([["task-1", task]])

      expect(findRootAncestor(task, taskMap)).toBe(task)
    })

    it("returns immediate parent when it exists and has no parent", () => {
      const parent: TaskCardTask = { id: "parent", title: "Parent", status: "open" }
      const child: TaskCardTask = {
        id: "child",
        title: "Child",
        status: "open",
        parent: "parent",
      }
      const taskMap = new Map<string, TaskCardTask>([
        ["parent", parent],
        ["child", child],
      ])

      expect(findRootAncestor(child, taskMap)).toBe(parent)
    })

    it("returns grandparent for deeply nested task", () => {
      const grandparent: TaskCardTask = { id: "gp", title: "Grandparent", status: "open" }
      const parent: TaskCardTask = {
        id: "parent",
        title: "Parent",
        status: "open",
        parent: "gp",
      }
      const child: TaskCardTask = {
        id: "child",
        title: "Child",
        status: "open",
        parent: "parent",
      }
      const taskMap = new Map<string, TaskCardTask>([
        ["gp", grandparent],
        ["parent", parent],
        ["child", child],
      ])

      expect(findRootAncestor(child, taskMap)).toBe(grandparent)
      expect(findRootAncestor(parent, taskMap)).toBe(grandparent)
    })

    it("handles very deep nesting", () => {
      const tasks: TaskCardTask[] = [
        { id: "level-0", title: "Level 0", status: "open" },
        { id: "level-1", title: "Level 1", status: "open", parent: "level-0" },
        { id: "level-2", title: "Level 2", status: "open", parent: "level-1" },
        { id: "level-3", title: "Level 3", status: "open", parent: "level-2" },
        { id: "level-4", title: "Level 4", status: "open", parent: "level-3" },
      ]
      const taskMap = new Map(tasks.map(t => [t.id, t]))

      expect(findRootAncestor(tasks[4], taskMap)).toBe(tasks[0])
    })
  })

  describe("buildTaskTree", () => {
    it("returns empty array for empty input", () => {
      const { roots } = buildTaskTree([])
      expect(roots).toHaveLength(0)
    })

    it("returns all tasks as roots when none have parents", () => {
      const tasks: TaskCardTask[] = [
        { id: "task-1", title: "Task 1", status: "open" },
        { id: "task-2", title: "Task 2", status: "open" },
      ]
      const { roots } = buildTaskTree(tasks)

      expect(roots).toHaveLength(2)
      expect(roots[0].task.id).toBe("task-1")
      expect(roots[1].task.id).toBe("task-2")
      expect(roots[0].children).toHaveLength(0)
      expect(roots[1].children).toHaveLength(0)
    })

    it("builds single parent-child relationship", () => {
      const tasks: TaskCardTask[] = [
        { id: "parent", title: "Parent", status: "open" },
        { id: "child", title: "Child", status: "open", parent: "parent" },
      ]
      const { roots } = buildTaskTree(tasks)

      expect(roots).toHaveLength(1)
      expect(roots[0].task.id).toBe("parent")
      expect(roots[0].children).toHaveLength(1)
      expect(roots[0].children[0].task.id).toBe("child")
    })

    it("builds multiple children under one parent", () => {
      const tasks: TaskCardTask[] = [
        { id: "parent", title: "Parent", status: "open" },
        { id: "child-1", title: "Child 1", status: "open", parent: "parent" },
        { id: "child-2", title: "Child 2", status: "open", parent: "parent" },
        { id: "child-3", title: "Child 3", status: "open", parent: "parent" },
      ]
      const { roots } = buildTaskTree(tasks)

      expect(roots).toHaveLength(1)
      expect(roots[0].children).toHaveLength(3)
    })

    it("builds grandparent-parent-child hierarchy", () => {
      const tasks: TaskCardTask[] = [
        { id: "grandparent", title: "Grandparent", status: "open" },
        { id: "parent", title: "Parent", status: "open", parent: "grandparent" },
        { id: "child", title: "Child", status: "open", parent: "parent" },
      ]
      const { roots } = buildTaskTree(tasks)

      expect(roots).toHaveLength(1)
      expect(roots[0].task.id).toBe("grandparent")
      expect(roots[0].children).toHaveLength(1)
      expect(roots[0].children[0].task.id).toBe("parent")
      expect(roots[0].children[0].children).toHaveLength(1)
      expect(roots[0].children[0].children[0].task.id).toBe("child")
    })

    it("treats task as root when parent not in list", () => {
      const tasks: TaskCardTask[] = [
        { id: "orphan", title: "Orphan", status: "open", parent: "missing" },
      ]
      const { roots } = buildTaskTree(tasks)

      expect(roots).toHaveLength(1)
      expect(roots[0].task.id).toBe("orphan")
    })

    it("handles complex multi-branch tree", () => {
      const tasks: TaskCardTask[] = [
        { id: "root-1", title: "Root 1", status: "open" },
        { id: "root-2", title: "Root 2", status: "open" },
        { id: "r1-child-1", title: "R1 Child 1", status: "open", parent: "root-1" },
        { id: "r1-child-2", title: "R1 Child 2", status: "open", parent: "root-1" },
        { id: "r2-child-1", title: "R2 Child 1", status: "open", parent: "root-2" },
        {
          id: "r1-c1-grandchild",
          title: "R1 C1 Grandchild",
          status: "open",
          parent: "r1-child-1",
        },
      ]
      const { roots } = buildTaskTree(tasks)

      expect(roots).toHaveLength(2)

      // Root 1 has 2 children
      const root1 = roots.find(r => r.task.id === "root-1")!
      expect(root1.children).toHaveLength(2)

      // Root 2 has 1 child
      const root2 = roots.find(r => r.task.id === "root-2")!
      expect(root2.children).toHaveLength(1)

      // R1 Child 1 has 1 grandchild
      const r1Child1 = root1.children.find(c => c.task.id === "r1-child-1")!
      expect(r1Child1.children).toHaveLength(1)
      expect(r1Child1.children[0].task.id).toBe("r1-c1-grandchild")
    })

    it("provides correct childrenMap", () => {
      const tasks: TaskCardTask[] = [
        { id: "parent", title: "Parent", status: "open" },
        { id: "child-1", title: "Child 1", status: "open", parent: "parent" },
        { id: "child-2", title: "Child 2", status: "open", parent: "parent" },
      ]
      const { childrenMap } = buildTaskTree(tasks)

      expect(childrenMap.get("parent")).toHaveLength(2)
      expect(childrenMap.get("child-1")).toBeUndefined()
    })
  })

  describe("countDescendants", () => {
    it("returns 0 for leaf node", () => {
      const node = {
        task: { id: "leaf", title: "Leaf", status: "open" as const },
        children: [],
      }
      expect(countDescendants(node)).toBe(0)
    })

    it("returns 1 for node with one child", () => {
      const node = {
        task: { id: "parent", title: "Parent", status: "open" as const },
        children: [
          {
            task: { id: "child", title: "Child", status: "open" as const },
            children: [],
          },
        ],
      }
      expect(countDescendants(node)).toBe(1)
    })

    it("counts grandchildren", () => {
      const node = {
        task: { id: "grandparent", title: "Grandparent", status: "open" as const },
        children: [
          {
            task: { id: "parent", title: "Parent", status: "open" as const },
            children: [
              {
                task: { id: "child", title: "Child", status: "open" as const },
                children: [],
              },
            ],
          },
        ],
      }
      // 1 child (parent) + 1 grandchild = 2
      expect(countDescendants(node)).toBe(2)
    })

    it("counts all descendants in complex tree", () => {
      const node = {
        task: { id: "root", title: "Root", status: "open" as const },
        children: [
          {
            task: { id: "p1", title: "P1", status: "open" as const },
            children: [
              { task: { id: "c1", title: "C1", status: "open" as const }, children: [] },
              { task: { id: "c2", title: "C2", status: "open" as const }, children: [] },
            ],
          },
          {
            task: { id: "p2", title: "P2", status: "open" as const },
            children: [],
          },
        ],
      }
      // 2 parents + 2 grandchildren = 4
      expect(countDescendants(node)).toBe(4)
    })
  })

  describe("countAllNodes", () => {
    it("returns 1 for leaf node", () => {
      const node = {
        task: { id: "leaf", title: "Leaf", status: "open" as const },
        children: [],
      }
      expect(countAllNodes(node)).toBe(1)
    })

    it("returns correct count including root", () => {
      const node = {
        task: { id: "root", title: "Root", status: "open" as const },
        children: [
          {
            task: { id: "child", title: "Child", status: "open" as const },
            children: [],
          },
        ],
      }
      expect(countAllNodes(node)).toBe(2)
    })
  })

  describe("flattenTree", () => {
    it("returns single item for leaf node", () => {
      const node = {
        task: { id: "leaf", title: "Leaf", status: "open" as const },
        children: [],
      }
      const result = flattenTree(node)

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe("leaf")
    })

    it("returns tasks in pre-order", () => {
      const node = {
        task: { id: "root", title: "Root", status: "open" as const },
        children: [
          {
            task: { id: "child-1", title: "Child 1", status: "open" as const },
            children: [
              {
                task: { id: "grandchild", title: "Grandchild", status: "open" as const },
                children: [],
              },
            ],
          },
          {
            task: { id: "child-2", title: "Child 2", status: "open" as const },
            children: [],
          },
        ],
      }
      const result = flattenTree(node)

      expect(result.map(t => t.id)).toEqual(["root", "child-1", "grandchild", "child-2"])
    })
  })
})
