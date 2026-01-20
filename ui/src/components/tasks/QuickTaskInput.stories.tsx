import type { Meta, StoryObj } from "@storybook/react-vite"
import { QuickTaskInput } from "./QuickTaskInput"
import { fn } from "storybook/test"

const meta: Meta<typeof QuickTaskInput> = {
  title: "Tasks/QuickTaskInput",
  component: QuickTaskInput,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  decorators: [
    Story => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
  args: {
    onTaskCreated: fn(),
    onError: fn(),
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const CustomPlaceholder: Story = {
  args: {
    placeholder: "What needs to be done?",
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
  },
}

export const WithLabel: Story = {
  render: args => (
    <div className="space-y-2">
      <label className="text-sm font-medium">Add New Task</label>
      <QuickTaskInput {...args} />
    </div>
  ),
}

export const InCard: Story = {
  render: args => (
    <div className="border-border bg-card rounded-lg border p-4">
      <h3 className="mb-3 text-lg font-semibold">Quick Add</h3>
      <QuickTaskInput {...args} />
    </div>
  ),
}
