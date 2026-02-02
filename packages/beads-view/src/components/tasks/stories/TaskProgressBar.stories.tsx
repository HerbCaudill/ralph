import type { Meta, StoryObj } from "@storybook/react-vite"
import { TaskProgressBar } from ".././TaskProgressBar"
import { beadsViewStore } from "@herbcaudill/beads-view"
import { useEffect, type ReactNode } from "react"
import type { Task } from "../../../types"

const meta: Meta<typeof TaskProgressBar> = {
  title: "Indicators/TaskProgressBar",
  component: TaskProgressBar,
  parameters: {},
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
function TaskProgressSetter({ tasks, children }: { tasks: Task[]; children: ReactNode }) {
  useEffect(() => {
    const store = beadsViewStore.getState()
    store.setTasks(tasks)
    store.setInitialTaskCount(tasks.length)
  }, [tasks])
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
  args: { isRunning: true },
  decorators: [
    Story => (
      <TaskProgressSetter tasks={createTasks(10, 0)}>
        <Story />
      </TaskProgressSetter>
    ),
  ],
}

export const QuarterProgress: Story = {
  args: { isRunning: true },
  decorators: [
    Story => (
      <TaskProgressSetter tasks={createTasks(9, 3)}>
        <Story />
      </TaskProgressSetter>
    ),
  ],
}

export const HalfProgress: Story = {
  args: { isRunning: true },
  decorators: [
    Story => (
      <TaskProgressSetter tasks={createTasks(5, 5)}>
        <Story />
      </TaskProgressSetter>
    ),
  ],
}

export const ThreeQuarterProgress: Story = {
  args: { isRunning: true },
  decorators: [
    Story => (
      <TaskProgressSetter tasks={createTasks(3, 9)}>
        <Story />
      </TaskProgressSetter>
    ),
  ],
}

export const NearlyComplete: Story = {
  args: { isRunning: true },
  decorators: [
    Story => (
      <TaskProgressSetter tasks={createTasks(1, 9)}>
        <Story />
      </TaskProgressSetter>
    ),
  ],
}

export const FullProgress: Story = {
  args: { isRunning: true },
  decorators: [
    Story => (
      <TaskProgressSetter tasks={createTasks(0, 10)}>
        <Story />
      </TaskProgressSetter>
    ),
  ],
}

export const WhenPaused: Story = {
  args: { isRunning: true },
  decorators: [
    Story => (
      <TaskProgressSetter tasks={createTasks(5, 5)}>
        <Story />
      </TaskProgressSetter>
    ),
  ],
}

export const WhenStopped: Story = {
  args: { isRunning: false },
  decorators: [
    Story => (
      <TaskProgressSetter tasks={createTasks(5, 5)}>
        <Story />
      </TaskProgressSetter>
    ),
  ],
}

export const SingleTask: Story = {
  args: { isRunning: true },
  decorators: [
    Story => (
      <TaskProgressSetter tasks={createTasks(0, 1)}>
        <Story />
      </TaskProgressSetter>
    ),
  ],
}

export const ManyTasks: Story = {
  args: { isRunning: true },
  decorators: [
    Story => (
      <TaskProgressSetter tasks={createTasks(25, 75)}>
        <Story />
      </TaskProgressSetter>
    ),
  ],
}

export const NoTasks: Story = {
  args: { isRunning: true },
  decorators: [
    Story => (
      <TaskProgressSetter tasks={[]}>
        <Story />
      </TaskProgressSetter>
    ),
  ],
}
