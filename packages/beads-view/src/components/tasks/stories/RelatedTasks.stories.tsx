import type { Meta, StoryObj } from "@storybook/react-vite"
import { RelatedTasks } from ".././RelatedTasks"
import type { TaskCardTask } from "../../../types"

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

const currentTask: TaskCardTask = {
  id: "rui-current",
  title: "Current Task",
  status: "open",
  priority: 2,
  parent: "rui-parent",
}

const childTasks: TaskCardTask[] = [
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
  args: {
    taskId: "rui-current",
    task: currentTask,
    allTasks: [currentTask, ...childTasks],
    issuePrefix: "rui",
  },
}

export const ReadOnly: Story = {
  args: {
    taskId: "rui-current",
    task: currentTask,
    allTasks: [currentTask, ...childTasks],
    issuePrefix: "rui",
    readOnly: true,
  },
}

export const NoRelationships: Story = {
  args: {
    taskId: "rui-standalone",
    task: {
      id: "rui-standalone",
      title: "Standalone Task",
      status: "open",
      priority: 2,
    },
    allTasks: [
      {
        id: "rui-standalone",
        title: "Standalone Task",
        status: "open",
        priority: 2,
      },
    ],
    issuePrefix: "rui",
  },
}

export const ManyChildren: Story = {
  render: () => {
    const manyChildren: TaskCardTask[] = Array.from({ length: 6 }, (_, i) => ({
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
      <RelatedTasks
        taskId="rui-current"
        task={currentTask}
        allTasks={[currentTask, ...manyChildren]}
        issuePrefix="rui"
      />
    )
  },
}

export const DifferentStatuses: Story = {
  render: () => {
    const statusVariety: TaskCardTask[] = [
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
      <RelatedTasks
        taskId="rui-current"
        task={currentTask}
        allTasks={[currentTask, ...statusVariety]}
        issuePrefix="rui"
      />
    )
  },
}

export const WithoutTask: Story = {
  args: {
    taskId: "rui-current",
    allTasks: [currentTask, ...childTasks],
    issuePrefix: "rui",
  },
}
