import type { Meta, StoryObj } from "@storybook/react-vite"
import { TaskProgressBar } from "./TaskProgressBar"
import { useAppStore } from "@/store"
import { useEffect } from "react"
import type { Task } from "@/types"

const meta: Meta<typeof TaskProgressBar> = {
  title: "Indicators/TaskProgressBar",
  component: TaskProgressBar,
  parameters: {
    layout: "padded",
  },
  decorators: [
    Story => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof meta>

/** Helper to set up store state for TaskProgressBar */
function TaskProgressSetter({
  tasks,
  status,
  children,
}: {
  tasks: Task[]
  status: "running" | "paused" | "stopped"
  children: React.ReactNode
}) {
  useEffect(() => {
    const store = useAppStore.getState()
    // Set tasks first, then status - status change calculates initialTaskCount
    store.setTasks(tasks)
    store.setRalphStatus(status)
  }, [tasks, status])
  return <>{children}</>
}

const createTasks = (open: number, closed: number): Task[] => {
  const tasks: Task[] = []
  for (let i = 0; i < open; i++) {
    tasks.push({
      id: `task-open-${i}`,
      title: `Open Task ${i + 1}`,
      status: "open",
      priority: 2,
    })
  }
  for (let i = 0; i < closed; i++) {
    tasks.push({
      id: `task-closed-${i}`,
      title: `Closed Task ${i + 1}`,
      status: "closed",
      priority: 2,
      closed_at: new Date().toISOString(),
    })
  }
  return tasks
}

export const NoProgress: Story = {
  decorators: [
    Story => (
      <TaskProgressSetter tasks={createTasks(10, 0)} status="running">
        <Story />
      </TaskProgressSetter>
    ),
  ],
}

export const QuarterProgress: Story = {
  decorators: [
    Story => (
      <TaskProgressSetter tasks={createTasks(9, 3)} status="running">
        <Story />
      </TaskProgressSetter>
    ),
  ],
}

export const HalfProgress: Story = {
  decorators: [
    Story => (
      <TaskProgressSetter tasks={createTasks(5, 5)} status="running">
        <Story />
      </TaskProgressSetter>
    ),
  ],
}

export const ThreeQuarterProgress: Story = {
  decorators: [
    Story => (
      <TaskProgressSetter tasks={createTasks(3, 9)} status="running">
        <Story />
      </TaskProgressSetter>
    ),
  ],
}

export const NearlyComplete: Story = {
  decorators: [
    Story => (
      <TaskProgressSetter tasks={createTasks(1, 9)} status="running">
        <Story />
      </TaskProgressSetter>
    ),
  ],
}

export const FullProgress: Story = {
  decorators: [
    Story => (
      <TaskProgressSetter tasks={createTasks(0, 10)} status="running">
        <Story />
      </TaskProgressSetter>
    ),
  ],
}

export const WhenPaused: Story = {
  decorators: [
    Story => (
      <TaskProgressSetter tasks={createTasks(5, 5)} status="paused">
        <Story />
      </TaskProgressSetter>
    ),
  ],
}

export const WhenStopped: Story = {
  decorators: [
    Story => (
      <TaskProgressSetter tasks={createTasks(5, 5)} status="stopped">
        <Story />
      </TaskProgressSetter>
    ),
  ],
}

export const SingleTask: Story = {
  decorators: [
    Story => (
      <TaskProgressSetter tasks={createTasks(0, 1)} status="running">
        <Story />
      </TaskProgressSetter>
    ),
  ],
}

export const ManyTasks: Story = {
  decorators: [
    Story => (
      <TaskProgressSetter tasks={createTasks(25, 75)} status="running">
        <Story />
      </TaskProgressSetter>
    ),
  ],
}

export const NoTasks: Story = {
  decorators: [
    Story => (
      <TaskProgressSetter tasks={[]} status="running">
        <Story />
      </TaskProgressSetter>
    ),
  ],
}
