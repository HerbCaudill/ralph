import type { Meta, StoryObj } from "@storybook/react-vite"
import { TaskSidebar } from "./TaskSidebar"
import type { Task } from "@/types"

const meta: Meta<typeof TaskSidebar> = {
  title: "Panels/TaskSidebar",
  component: TaskSidebar,
  parameters: {},
  decorators: [
    Story => (
      <div className="border-border h-[600px] w-80 border-r">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof meta>

const sampleTasks: Task[] = [
  { id: "rui-1", title: "Implement authentication", status: "in_progress", priority: 1 },
  { id: "rui-2", title: "Add dark mode support", status: "open", priority: 2 },
  { id: "rui-3", title: "Fix navigation bug", status: "blocked", priority: 0 },
  { id: "rui-4", title: "Update documentation", status: "open", priority: 3 },
  { id: "rui-5", title: "Refactor database layer", status: "closed", priority: 2 },
]

/** Sample quick input component */
function QuickInput() {
  return (
    <input
      type="text"
      placeholder="Quick add task..."
      className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
    />
  )
}

/** Sample task list component */
function TaskListMock({ tasks }: { tasks: Task[] }) {
  return (
    <div className="divide-border divide-y">
      {tasks.map(task => (
        <div key={task.id} className="hover:bg-muted/50 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">{task.id}</span>
            <span className="text-sm">{task.title}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Mock progress bar for stories */
function MockProgressBar({ closed, total }: { closed: number; total: number }) {
  const progress = total > 0 ? (closed / total) * 100 : 0
  return (
    <div
      className="border-border border-t px-4 py-3"
      role="progressbar"
      aria-valuenow={closed}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label="Task completion progress"
    >
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/30">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <span className="text-muted-foreground shrink-0 text-xs">
          {closed}/{total}
        </span>
      </div>
    </div>
  )
}

/** Mock iteration history button for stories */
function MockIterationHistory() {
  return (
    <button className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs transition-colors">
      <span>History</span>
    </button>
  )
}

export const Default: Story = {
  args: {
    quickInput: <QuickInput />,
    taskList: <TaskListMock tasks={sampleTasks} />,
    iterationHistory: <MockIterationHistory />,
    progressBar: <MockProgressBar closed={1} total={5} />,
  },
}

export const WithSearchVisible: Story = {
  args: {
    quickInput: <QuickInput />,
    taskList: <TaskListMock tasks={sampleTasks} />,
    iterationHistory: <MockIterationHistory />,
    progressBar: <MockProgressBar closed={1} total={5} />,
    isSearchVisible: true,
    onHideSearch: () => {},
  },
}

export const EmptyState: Story = {
  args: {
    quickInput: <QuickInput />,
    iterationHistory: <MockIterationHistory />,
  },
}

export const WithoutQuickInput: Story = {
  args: {
    taskList: <TaskListMock tasks={sampleTasks} />,
    iterationHistory: <MockIterationHistory />,
    progressBar: <MockProgressBar closed={1} total={5} />,
  },
}

export const WithManyTasks: Story = {
  render: () => {
    const manyTasks: Task[] = Array.from({ length: 20 }, (_, i) => ({
      id: `rui-${i + 1}`,
      title: `Task number ${i + 1} with a longer description`,
      status:
        i % 4 === 0 ? "closed"
        : i % 3 === 0 ? "in_progress"
        : "open",
      priority: i % 5,
    }))
    const closedCount = manyTasks.filter(t => t.status === "closed").length
    return (
      <TaskSidebar
        quickInput={<QuickInput />}
        taskList={
          <div className="h-full overflow-y-auto">
            <TaskListMock tasks={manyTasks} />
          </div>
        }
        iterationHistory={<MockIterationHistory />}
        progressBar={<MockProgressBar closed={closedCount} total={manyTasks.length} />}
      />
    )
  },
}

export const WhenStopped: Story = {
  args: {
    quickInput: <QuickInput />,
    taskList: <TaskListMock tasks={sampleTasks} />,
    iterationHistory: <MockIterationHistory />,
    // No progress bar when stopped
  },
}

export const WithCustomClassName: Story = {
  args: {
    quickInput: <QuickInput />,
    taskList: <TaskListMock tasks={sampleTasks} />,
    iterationHistory: <MockIterationHistory />,
    progressBar: <MockProgressBar closed={1} total={5} />,
    className: "bg-muted/20",
  },
}
