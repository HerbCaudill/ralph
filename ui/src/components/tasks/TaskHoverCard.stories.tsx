import type { Meta, StoryObj } from "@storybook/react"
import { TaskHoverCard } from "./TaskHoverCard"
import { TaskCard } from "./TaskCard"
import type { TaskCardTask } from "./TaskCard"

const meta: Meta<typeof TaskHoverCard> = {
  title: "Tasks/TaskHoverCard",
  component: TaskHoverCard,
  parameters: {
    layout: "centered",
  },
}

export default meta
type Story = StoryObj<typeof TaskHoverCard>

// Task fixtures

const basicTask: TaskCardTask = {
  id: "rui-abc.1",
  title: "Implement hover card for tasks",
  status: "open",
}

const fullTask: TaskCardTask = {
  id: "rui-def.2",
  title: "Add user authentication flow",
  description:
    "Implement login, logout, and session management. Should support OAuth providers and email/password authentication.",
  status: "in_progress",
  priority: 1,
  issue_type: "task",
  parent: "rui-def",
}

const closedTask: TaskCardTask = {
  id: "rui-ghi.3",
  title: "Fix navigation bug",
  description: "Navigation was broken on mobile devices",
  status: "closed",
  priority: 2,
  issue_type: "bug",
}

const blockedTask: TaskCardTask = {
  id: "rui-jkl.4",
  title: "Add integration tests",
  description: "Waiting for API endpoints to be finalized",
  status: "blocked",
  priority: 3,
  parent: "rui-jkl",
}

// Stories

export const Basic: Story = {
  args: {
    task: basicTask,
    children: <TaskCard task={basicTask} />,
  },
}

export const WithFullDetails: Story = {
  args: {
    task: fullTask,
    children: <TaskCard task={fullTask} />,
    onOpenDetails: id => alert(`Open details for ${id}`),
  },
}

export const ClosedTask: Story = {
  args: {
    task: closedTask,
    children: <TaskCard task={closedTask} />,
    onOpenDetails: id => alert(`Open details for ${id}`),
  },
}

export const BlockedTask: Story = {
  args: {
    task: blockedTask,
    children: <TaskCard task={blockedTask} />,
    onOpenDetails: id => alert(`Open details for ${id}`),
  },
}

export const Disabled: Story = {
  args: {
    task: fullTask,
    children: <TaskCard task={fullTask} />,
    disabled: true,
  },
}

export const WithoutOpenDetails: Story = {
  args: {
    task: fullTask,
    children: <TaskCard task={fullTask} />,
  },
}

// Different priorities
const p0Task: TaskCardTask = { ...basicTask, id: "rui-p0", priority: 0, title: "Critical P0 task" }
const p1Task: TaskCardTask = {
  ...basicTask,
  id: "rui-p1",
  priority: 1,
  title: "High priority P1 task",
}
const p2Task: TaskCardTask = {
  ...basicTask,
  id: "rui-p2",
  priority: 2,
  title: "Medium priority P2 task",
}
const p3Task: TaskCardTask = {
  ...basicTask,
  id: "rui-p3",
  priority: 3,
  title: "Low priority P3 task",
}
const p4Task: TaskCardTask = {
  ...basicTask,
  id: "rui-p4",
  priority: 4,
  title: "Lowest priority P4 task",
}

export const AllPriorities: Story = {
  render: () => (
    <div className="flex flex-col gap-1">
      {[p0Task, p1Task, p2Task, p3Task, p4Task].map(task => (
        <TaskHoverCard key={task.id} task={task} onOpenDetails={id => alert(`Open ${id}`)}>
          <TaskCard task={task} />
        </TaskHoverCard>
      ))}
    </div>
  ),
}
