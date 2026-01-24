import type { Meta, StoryObj } from "@storybook/react-vite"
import { TaskSidebar } from "./TaskSidebar"
import { useAppStore } from "@/store"
import { useEffect } from "react"
import type { Task } from "@/types"

const meta: Meta<typeof TaskSidebar> = {
  title: "Panels/TaskSidebar",
  component: TaskSidebar,
  parameters: {
    layout: "fullscreen",
  },
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

/** Helper to set up store state */
function StoreSetter({ tasks, status }: { tasks: Task[]; status?: "running" | "stopped" }) {
  useEffect(() => {
    const store = useAppStore.getState()
    // Set tasks first, then status - status change calculates initialTaskCount
    store.setTasks(tasks)
    if (status) {
      store.setRalphStatus(status)
    }
  }, [tasks, status])
  return null
}

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

export const Default: Story = {
  render: () => (
    <>
      <StoreSetter tasks={sampleTasks} status="running" />
      <TaskSidebar quickInput={<QuickInput />} taskList={<TaskListMock tasks={sampleTasks} />} />
    </>
  ),
}

export const WithSearchVisible: Story = {
  render: () => (
    <>
      <StoreSetter tasks={sampleTasks} status="running" />
      <TaskSidebar
        quickInput={<QuickInput />}
        taskList={<TaskListMock tasks={sampleTasks} />}
        isSearchVisible={true}
        onHideSearch={() => {}}
      />
    </>
  ),
}

export const EmptyState: Story = {
  render: () => (
    <>
      <StoreSetter tasks={[]} status="stopped" />
      <TaskSidebar quickInput={<QuickInput />} />
    </>
  ),
}

export const WithoutQuickInput: Story = {
  render: () => (
    <>
      <StoreSetter tasks={sampleTasks} status="running" />
      <TaskSidebar taskList={<TaskListMock tasks={sampleTasks} />} />
    </>
  ),
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
    return (
      <>
        <StoreSetter tasks={manyTasks} status="running" />
        <TaskSidebar
          quickInput={<QuickInput />}
          taskList={
            <div className="h-full overflow-y-auto">
              <TaskListMock tasks={manyTasks} />
            </div>
          }
        />
      </>
    )
  },
}

export const WhenStopped: Story = {
  render: () => (
    <>
      <StoreSetter tasks={sampleTasks} status="stopped" />
      <TaskSidebar quickInput={<QuickInput />} taskList={<TaskListMock tasks={sampleTasks} />} />
    </>
  ),
}

export const WithCustomClassName: Story = {
  args: {
    className: "bg-muted/20",
  },
  render: args => (
    <>
      <StoreSetter tasks={sampleTasks} status="running" />
      <TaskSidebar
        {...args}
        quickInput={<QuickInput />}
        taskList={<TaskListMock tasks={sampleTasks} />}
      />
    </>
  ),
}
