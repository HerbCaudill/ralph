import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within, userEvent, fn } from "storybook/test"
import { TaskPanel } from "../TaskPanel"
import type { TaskCardTask } from "../../../types"
import { beadsViewStore } from "@herbcaudill/beads-view"
import { useEffect } from "react"

const meta: Meta<typeof TaskPanel> = {
  title: "Panels/TaskPanel",
  component: TaskPanel,
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

const sampleTasks: TaskCardTask[] = [
  { id: "rui-1", title: "Implement authentication", status: "in_progress", priority: 1 },
  { id: "rui-2", title: "Add dark mode support", status: "open", priority: 2 },
  { id: "rui-3", title: "Fix navigation bug", status: "blocked", priority: 0 },
  { id: "rui-4", title: "Update documentation", status: "open", priority: 3 },
  { id: "rui-5", title: "Refactor database layer", status: "closed", priority: 2 },
]

export const Default: Story = {
  args: {
    tasks: sampleTasks,
  },
}

export const EmptyState: Story = {
  args: {},
}

export const WithQuickInput: Story = {
  args: {
    tasks: sampleTasks,
    showQuickInput: true,
  },
}

export const WithManyTasks: Story = {
  args: {
    tasks: Array.from({ length: 20 }, (_, i) => ({
      id: `rui-${i + 1}`,
      title: `Task number ${i + 1} with a longer description`,
      status:
        i % 4 === 0 ? ("closed" as const)
        : i % 3 === 0 ? ("in_progress" as const)
        : ("open" as const),
      priority: i % 5,
    })),
  },
}

export const WhenStopped: Story = {
  args: {
    tasks: sampleTasks,
    isRunning: false,
  },
}

export const WithProgressBar: Story = {
  args: {
    tasks: sampleTasks,
    isRunning: true,
    initialTaskCount: 5,
    accentColor: "#3b82f6",
  },
}

export const WithCustomClassName: Story = {
  args: {
    tasks: sampleTasks,
    className: "bg-muted/20",
  },
}

/** Helper to set up store state for search tests */
function StoreSetter({ tasks, query }: { tasks: TaskCardTask[]; query?: string }) {
  useEffect(() => {
    const store = beadsViewStore.getState()
    store.setTasks(tasks)
    if (query) {
      store.setTaskSearchQuery(query)
    } else {
      store.clearTaskSearchQuery()
    }
    return () => {
      store.clearTaskSearchQuery()
    }
  }, [tasks, query])
  return null
}

/** Verifies the panel renders with proper accessibility role. */
export const HasAccessibleRole: Story = {
  args: {
    tasks: sampleTasks,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const sidebar = canvas.getByRole("complementary", { name: "Task sidebar" })
    await expect(sidebar).toBeInTheDocument()
  },
}

/** Verifies the empty state is displayed when no tasks are provided. */
export const ShowsEmptyState: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("No tasks")).toBeInTheDocument()
  },
}

/** Verifies the search input is always visible. */
export const SearchIsAlwaysVisible: Story = {
  render: args => (
    <>
      <StoreSetter tasks={sampleTasks} />
      <TaskPanel {...args} />
    </>
  ),
  args: {
    tasks: sampleTasks,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const searchInput = canvas.getByRole("textbox", { name: "Search tasks" })
    await expect(searchInput).toBeInTheDocument()
  },
}

/** Verifies pressing Escape in the search input clears the query and blurs. */
export const EscapeClearsSearchAndBlurs: Story = {
  render: args => (
    <>
      <StoreSetter tasks={sampleTasks} query="test" />
      <TaskPanel {...args} />
    </>
  ),
  args: {
    tasks: sampleTasks,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const searchInput = canvas.getByRole("textbox", { name: "Search tasks" })
    await expect(searchInput).toBeInTheDocument()
    await expect(searchInput).toHaveValue("test")

    await userEvent.click(searchInput)
    await expect(searchInput).toHaveFocus()

    await userEvent.keyboard("{Escape}")

    await expect(searchInput).toHaveValue("")
    await expect(searchInput).not.toHaveFocus()
  },
}

/** Verifies typing in the search input and clear button functionality. */
export const SearchWithQueryAndClear: Story = {
  render: args => (
    <>
      <StoreSetter tasks={sampleTasks} />
      <TaskPanel {...args} />
    </>
  ),
  args: {
    tasks: sampleTasks,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const searchInput = canvas.getByRole("textbox", { name: "Search tasks" })

    await userEvent.type(searchInput, "auth")
    await expect(searchInput).toHaveValue("auth")

    const clearButton = await canvas.findByRole("button", { name: "Clear search" })
    await expect(clearButton).toBeInTheDocument()

    await userEvent.click(clearButton)
    await expect(searchInput).toHaveValue("")
  },
}

/** Verifies that the progress bar is rendered when isRunning and initialTaskCount are set. */
export const ProgressBarVisible: Story = {
  args: {
    tasks: sampleTasks,
    isRunning: true,
    initialTaskCount: 5,
    accentColor: "#3b82f6",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const progressBar = canvas.getByRole("progressbar", { name: "Task completion progress" })
    await expect(progressBar).toBeInTheDocument()
  },
}

/** Verifies that all sections are rendered in the correct order. */
export const AllSectionsRenderedInOrder: Story = {
  render: args => (
    <>
      <StoreSetter tasks={sampleTasks} />
      <TaskPanel {...args} />
    </>
  ),
  args: {
    tasks: sampleTasks,
    isRunning: true,
    initialTaskCount: 5,
    accentColor: "#3b82f6",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const searchInput = canvas.getByRole("textbox", { name: "Search tasks" })
    const taskList = canvas.getByRole("list", { name: "Task list" })
    const progressBar = canvas.getByRole("progressbar", { name: "Task completion progress" })

    await expect(searchInput).toBeInTheDocument()
    await expect(taskList).toBeInTheDocument()
    await expect(progressBar).toBeInTheDocument()

    const searchInputRect = searchInput.getBoundingClientRect()
    const taskListRect = taskList.getBoundingClientRect()
    const progressBarRect = progressBar.getBoundingClientRect()

    await expect(searchInputRect.top).toBeLessThan(taskListRect.top)
    await expect(taskListRect.bottom).toBeLessThanOrEqual(progressBarRect.bottom)
  },
}
