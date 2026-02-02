import type { Meta, StoryObj } from "@storybook/react-vite"
import { TaskProgressBar } from ".././TaskProgressBar"
import type { TaskCardTask } from "../../../types"

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

const createTasks = (open: number, closed: number): TaskCardTask[] => {
  const tasks: TaskCardTask[] = []
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

/** Helper to create story args with consistent task/initialTaskCount pairing. */
const progressArgs = (open: number, closed: number) => {
  const tasks = createTasks(open, closed)
  return { isRunning: true, tasks, initialTaskCount: tasks.length }
}

export const NoProgress: Story = {
  args: progressArgs(10, 0),
}

export const QuarterProgress: Story = {
  args: progressArgs(9, 3),
}

export const HalfProgress: Story = {
  args: progressArgs(5, 5),
}

export const ThreeQuarterProgress: Story = {
  args: progressArgs(3, 9),
}

export const NearlyComplete: Story = {
  args: progressArgs(1, 9),
}

export const FullProgress: Story = {
  args: progressArgs(0, 10),
}

export const WhenPaused: Story = {
  args: progressArgs(5, 5),
}

export const WhenStopped: Story = {
  args: { ...progressArgs(5, 5), isRunning: false },
}

export const SingleTask: Story = {
  args: progressArgs(0, 1),
}

export const ManyTasks: Story = {
  args: progressArgs(25, 75),
}

export const NoTasks: Story = {
  args: { isRunning: true, tasks: [], initialTaskCount: 0 },
}
