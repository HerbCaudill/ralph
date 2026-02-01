import type { Meta, StoryObj } from "@storybook/react-vite"
import { RelatedTasks } from "./RelatedTasks"
import { beadsViewStore } from "@herbcaudill/beads-view"
import { useEffect } from "react"
import type { Task, TaskCardTask } from "../../types"

const meta: Meta<typeof RelatedTasks> = {
  title: "Collections/RelatedTasks",
  component: RelatedTasks,
  parameters: {},
  decorators: [
    Story => (
      <div className="max-w-md">
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
    const store = beadsViewStore.getState()
    store.setTasks(tasks)
    store.setIssuePrefix(prefix)
  }, [tasks, prefix])
  return null
}

const currentTask: TaskCardTask = {
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
]

export const WithChildren: Story = {
  render: () => (
    <>
      <StoreSetter tasks={[currentTask, ...childTasks]} prefix="rui" />
      <RelatedTasks taskId="rui-current" task={currentTask} />
    </>
  ),
}

export const ReadOnly: Story = {
  render: () => (
    <>
      <StoreSetter tasks={[currentTask, ...childTasks]} prefix="rui" />
      <RelatedTasks taskId="rui-current" task={currentTask} readOnly />
    </>
  ),
}

export const NoRelationships: Story = {
  render: () => {
    const standaloneTask: TaskCardTask = {
      id: "rui-standalone",
      title: "Standalone Task",
      status: "open",
      priority: 2,
    }
    return (
      <>
        <StoreSetter tasks={[standaloneTask]} prefix="rui" />
        <RelatedTasks taskId="rui-standalone" task={standaloneTask} />
      </>
    )
  },
}

export const ManyChildren: Story = {
  render: () => {
    const manyChildren: Task[] = Array.from({ length: 6 }, (_, i) => ({
      id: `rui-child-${i + 1}`,
      title: `Child Task ${i + 1}: ${["Implement", "Test", "Review", "Deploy", "Document", "Monitor"][i]}`,
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
        <RelatedTasks taskId="rui-current" task={currentTask} />
      </>
    )
  },
}

export const DifferentStatuses: Story = {
  render: () => {
    const statusVariety: Task[] = [
      { id: "rui-open", title: "Open child", status: "open", priority: 2, parent: "rui-current" },
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
        <RelatedTasks taskId="rui-current" task={currentTask} />
      </>
    )
  },
}

export const WithoutTask: Story = {
  render: () => (
    <>
      <StoreSetter tasks={[currentTask, ...childTasks]} prefix="rui" />
      <RelatedTasks taskId="rui-current" />
    </>
  ),
}
