import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within, userEvent, fn } from "storybook/test"
import { TaskSidebar } from ".././TaskSidebar"
import type { Task } from "../../../types"
import { beadsViewStore } from "@herbcaudill/beads-view"
import { useEffect } from "react"

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
  args: {
    onOpenTask: fn(),
  },
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

export const Default: Story = {
  args: {
    taskList: <TaskListMock tasks={sampleTasks} />,
    progressBar: <MockProgressBar closed={1} total={5} />,
  },
}

export const EmptyState: Story = {
  args: {},
}

export const WithoutQuickInput: Story = {
  args: {
    taskList: <TaskListMock tasks={sampleTasks} />,
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
        taskList={
          <div className="h-full overflow-y-auto">
            <TaskListMock tasks={manyTasks} />
          </div>
        }
        progressBar={<MockProgressBar closed={closedCount} total={manyTasks.length} />}
      />
    )
  },
}

export const WhenStopped: Story = {
  args: {
    taskList: <TaskListMock tasks={sampleTasks} />,
    // No progress bar when stopped
  },
}

export const WithCustomClassName: Story = {
  args: {
    taskList: <TaskListMock tasks={sampleTasks} />,
    progressBar: <MockProgressBar closed={1} total={5} />,
    className: "bg-muted/20",
  },
}

/** Helper to set up store state for search tests */
function StoreSetter({ tasks, query }: { tasks: Task[]; query?: string }) {
  useEffect(() => {
    const store = beadsViewStore.getState()
    store.setTasks(tasks)
    if (query) {
      store.setTaskSearchQuery(query)
    } else {
      store.clearTaskSearchQuery()
    }
    return () => {
      // Clean up on unmount
      store.clearTaskSearchQuery()
    }
  }, [tasks, query])
  return null
}

/**
 * Verifies the sidebar renders with proper accessibility role.
 */
export const HasAccessibleRole: Story = {
  args: {
    taskList: <TaskListMock tasks={sampleTasks} />,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const sidebar = canvas.getByRole("complementary", { name: "Task sidebar" })
    await expect(sidebar).toBeInTheDocument()
  },
}

/**
 * Verifies the empty state is displayed when no taskList is provided.
 */
export const ShowsEmptyState: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("No tasks yet")).toBeInTheDocument()
  },
}

/**
 * Verifies the search input is always visible.
 */
export const SearchIsAlwaysVisible: Story = {
  render: args => (
    <>
      <StoreSetter tasks={sampleTasks} />
      <TaskSidebar {...args} />
    </>
  ),
  args: {
    taskList: <TaskListMock tasks={sampleTasks} />,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const searchInput = canvas.getByRole("textbox", { name: "Search tasks" })
    await expect(searchInput).toBeInTheDocument()
  },
}

/**
 * Verifies pressing Escape in the search input clears the query and blurs.
 */
export const EscapeClearsSearchAndBlurs: Story = {
  render: args => (
    <>
      <StoreSetter tasks={sampleTasks} query="test" />
      <TaskSidebar {...args} />
    </>
  ),
  args: {
    taskList: <TaskListMock tasks={sampleTasks} />,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Get the search input
    const searchInput = canvas.getByRole("textbox", { name: "Search tasks" })
    await expect(searchInput).toBeInTheDocument()

    // Should have the initial query
    await expect(searchInput).toHaveValue("test")

    // Focus the search input
    await userEvent.click(searchInput)
    await expect(searchInput).toHaveFocus()

    // Press Escape to clear
    await userEvent.keyboard("{Escape}")

    // Verify query was cleared and input blurred
    await expect(searchInput).toHaveValue("")
    await expect(searchInput).not.toHaveFocus()
  },
}

/**
 * Verifies typing in the search input and clear button functionality.
 */
export const SearchWithQueryAndClear: Story = {
  render: args => (
    <>
      <StoreSetter tasks={sampleTasks} />
      <TaskSidebar {...args} />
    </>
  ),
  args: {
    taskList: <TaskListMock tasks={sampleTasks} />,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Get the search input
    const searchInput = canvas.getByRole("textbox", { name: "Search tasks" })

    // Type a search query
    await userEvent.type(searchInput, "auth")

    // Verify the input has the value
    await expect(searchInput).toHaveValue("auth")

    // Clear button should now be visible
    const clearButton = await canvas.findByRole("button", { name: "Clear search" })
    await expect(clearButton).toBeInTheDocument()

    // Click clear button
    await userEvent.click(clearButton)

    // Verify query was cleared
    await expect(searchInput).toHaveValue("")
  },
}

/**
 * Verifies that the progress bar is rendered when provided.
 */
export const ProgressBarVisible: Story = {
  args: {
    taskList: <TaskListMock tasks={sampleTasks} />,
    progressBar: <MockProgressBar closed={2} total={5} />,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Progress bar should be visible with correct aria attributes
    const progressBar = canvas.getByRole("progressbar", { name: "Task completion progress" })
    await expect(progressBar).toBeInTheDocument()
    await expect(progressBar).toHaveAttribute("aria-valuenow", "2")
    await expect(progressBar).toHaveAttribute("aria-valuemax", "5")
  },
}

/**
 * Verifies that all slot elements are rendered in the correct order.
 */
export const AllSlotsRenderedInOrder: Story = {
  render: args => (
    <>
      <StoreSetter tasks={sampleTasks} />
      <TaskSidebar {...args} />
    </>
  ),
  args: {
    taskList: (
      <div data-testid="slot-task-list">
        <TaskListMock tasks={sampleTasks} />
      </div>
    ),
    progressBar: (
      <div data-testid="slot-progress-bar">
        <MockProgressBar closed={1} total={5} />
      </div>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Get all elements in DOM order
    const searchInput = canvas.getByRole("textbox", { name: "Search tasks" })
    const taskList = canvas.getByTestId("slot-task-list")
    const progressBar = canvas.getByTestId("slot-progress-bar")

    // All should be in the document
    await expect(searchInput).toBeInTheDocument()
    await expect(taskList).toBeInTheDocument()
    await expect(progressBar).toBeInTheDocument()

    // Check visual order by comparing positions
    const searchInputRect = searchInput.getBoundingClientRect()
    const taskListRect = taskList.getBoundingClientRect()
    const progressBarRect = progressBar.getBoundingClientRect()

    // Verify vertical order: search < taskList < progressBar
    await expect(searchInputRect.top).toBeLessThan(taskListRect.top)
    await expect(taskListRect.bottom).toBeLessThanOrEqual(progressBarRect.bottom)
  },
}
