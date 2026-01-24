import type { Meta, StoryObj } from "@storybook/react-vite"
import { SearchInput } from "./SearchInput"
import { useAppStore } from "@/store"
import { useEffect } from "react"
import { fn } from "storybook/test"
import type { Task } from "@/types"

const meta: Meta<typeof SearchInput> = {
  title: "Inputs/SearchInput",
  component: SearchInput,
  parameters: {},
  decorators: [
    Story => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
  args: {
    onOpenTask: fn(),
    onHide: fn(),
  },
}

export default meta
type Story = StoryObj<typeof meta>

/** Helper to set up store state */
function StoreSetter({ tasks, query }: { tasks: Task[]; query?: string }) {
  useEffect(() => {
    const store = useAppStore.getState()
    store.setTasks(tasks)
    if (query) {
      store.setTaskSearchQuery(query)
    }
  }, [tasks, query])
  return null
}

const sampleTasks: Task[] = [
  { id: "rui-1", title: "Implement authentication", status: "open", priority: 1 },
  { id: "rui-2", title: "Add dark mode", status: "in_progress", priority: 2 },
  { id: "rui-3", title: "Fix navigation bug", status: "blocked", priority: 0 },
  { id: "rui-4", title: "Update documentation", status: "open", priority: 3 },
  { id: "rui-5", title: "Refactor database layer", status: "closed", priority: 2 },
]

export const Empty: Story = {
  render: args => (
    <>
      <StoreSetter tasks={sampleTasks} />
      <SearchInput {...args} />
    </>
  ),
}

export const WithQuery: Story = {
  render: args => (
    <>
      <StoreSetter tasks={sampleTasks} query="auth" />
      <SearchInput {...args} />
    </>
  ),
}

export const WithPlaceholder: Story = {
  args: {
    placeholder: "Filter tasks by name...",
  },
  render: args => (
    <>
      <StoreSetter tasks={sampleTasks} />
      <SearchInput {...args} />
    </>
  ),
}

export const Disabled: Story = {
  args: {
    disabled: true,
  },
  render: args => (
    <>
      <StoreSetter tasks={sampleTasks} />
      <SearchInput {...args} />
    </>
  ),
}

export const DisabledWithQuery: Story = {
  args: {
    disabled: true,
  },
  render: args => (
    <>
      <StoreSetter tasks={sampleTasks} query="search term" />
      <SearchInput {...args} />
    </>
  ),
}

export const WithCustomClassName: Story = {
  args: {
    className: "max-w-xs",
  },
  render: args => (
    <>
      <StoreSetter tasks={sampleTasks} />
      <SearchInput {...args} />
    </>
  ),
}

export const InContext: Story = {
  render: args => (
    <div className="border-border rounded-lg border p-4">
      <h3 className="mb-2 text-sm font-medium">Task Search</h3>
      <StoreSetter tasks={sampleTasks} />
      <SearchInput {...args} />
    </div>
  ),
}
