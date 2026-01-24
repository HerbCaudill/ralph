import type { Meta, StoryObj } from "@storybook/react-vite"
import { RelationshipGraph } from "./RelationshipGraph"
import { useAppStore } from "@/store"
import { useEffect } from "react"
import type { Task } from "@/types"

const meta: Meta<typeof RelationshipGraph> = {
  title: "Collections/RelationshipGraph",
  component: RelationshipGraph,
  parameters: {
    
  },
  decorators: [
    Story => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof meta>

/** Helper to set up store state */
function StoreSetter({ tasks, prefix }: { tasks: Task[]; prefix: string }) {
  useEffect(() => {
    const store = useAppStore.getState()
    store.setTasks(tasks)
    store.setIssuePrefix(prefix)
  }, [tasks, prefix])
  return null
}

const parentTask: Task = {
  id: "rui-parent",
  title: "Parent Epic",
  status: "in_progress",
  priority: 1,
  issue_type: "epic",
}

const currentTask: Task = {
  id: "rui-current",
  title: "Current Task",
  status: "open",
  priority: 2,
  parent: "rui-parent",
}

const childTasks: Task[] = [
  { id: "rui-child-1", title: "Child Task 1", status: "open", priority: 2, parent: "rui-current" },
  {
    id: "rui-child-2",
    title: "Child Task 2",
    status: "in_progress",
    priority: 1,
    parent: "rui-current",
  },
  {
    id: "rui-child-3",
    title: "Child Task 3",
    status: "closed",
    priority: 3,
    parent: "rui-current",
  },
]

export const WithParent: Story = {
  render: () => (
    <>
      <StoreSetter tasks={[parentTask, currentTask]} prefix="rui" />
      <RelationshipGraph
        taskId="rui-current"
        parent={{ id: parentTask.id, title: parentTask.title, status: parentTask.status }}
      />
    </>
  ),
}

export const WithChildren: Story = {
  render: () => (
    <>
      <StoreSetter tasks={[currentTask, ...childTasks]} prefix="rui" />
      <RelationshipGraph taskId="rui-current" />
    </>
  ),
}

export const WithParentAndChildren: Story = {
  render: () => (
    <>
      <StoreSetter tasks={[parentTask, currentTask, ...childTasks]} prefix="rui" />
      <RelationshipGraph
        taskId="rui-current"
        parent={{ id: parentTask.id, title: parentTask.title, status: parentTask.status }}
      />
    </>
  ),
}

export const NoRelationships: Story = {
  render: () => {
    const standaloneTask: Task = {
      id: "rui-standalone",
      title: "Standalone Task",
      status: "open",
      priority: 2,
    }
    return (
      <>
        <StoreSetter tasks={[standaloneTask]} prefix="rui" />
        <RelationshipGraph taskId="rui-standalone" />
      </>
    )
  },
}

export const OnlyParent: Story = {
  render: () => {
    const taskWithParent: Task = {
      id: "rui-task",
      title: "Task with parent only",
      status: "open",
      priority: 2,
      parent: "rui-parent",
    }
    return (
      <>
        <StoreSetter tasks={[parentTask, taskWithParent]} prefix="rui" />
        <RelationshipGraph
          taskId="rui-task"
          parent={{ id: parentTask.id, title: parentTask.title, status: parentTask.status }}
        />
      </>
    )
  },
}

export const ManyChildren: Story = {
  render: () => {
    const manyChildren: Task[] = Array.from({ length: 8 }, (_, i) => ({
      id: `rui-child-${i + 1}`,
      title: `Child Task ${i + 1}`,
      status:
        i % 3 === 0 ? "closed"
        : i % 2 === 0 ? "in_progress"
        : "open",
      priority: i % 4,
      parent: "rui-current",
    }))
    return (
      <>
        <StoreSetter tasks={[currentTask, ...manyChildren]} prefix="rui" />
        <RelationshipGraph taskId="rui-current" />
      </>
    )
  },
}

export const DifferentStatuses: Story = {
  render: () => {
    const statusVariety: Task[] = [
      {
        id: "rui-open",
        title: "Open child",
        status: "open",
        priority: 2,
        parent: "rui-current",
      },
      {
        id: "rui-progress",
        title: "In progress child",
        status: "in_progress",
        priority: 1,
        parent: "rui-current",
      },
      {
        id: "rui-blocked",
        title: "Blocked child",
        status: "blocked",
        priority: 0,
        parent: "rui-current",
      },
      {
        id: "rui-deferred",
        title: "Deferred child",
        status: "deferred",
        priority: 3,
        parent: "rui-current",
      },
      {
        id: "rui-closed",
        title: "Closed child",
        status: "closed",
        priority: 2,
        parent: "rui-current",
      },
    ]
    return (
      <>
        <StoreSetter tasks={[currentTask, ...statusVariety]} prefix="rui" />
        <RelationshipGraph taskId="rui-current" />
      </>
    )
  },
}

export const Loading: Story = {
  render: () => (
    <>
      <StoreSetter tasks={[]} prefix="rui" />
      <RelationshipGraph taskId="rui-nonexistent" />
    </>
  ),
}
