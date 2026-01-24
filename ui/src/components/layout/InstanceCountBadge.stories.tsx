import type { Meta, StoryObj } from "@storybook/react-vite"
import { InstanceCountBadge } from "./InstanceCountBadge"

const meta: Meta<typeof InstanceCountBadge> = {
  title: "Layout/InstanceCountBadge",
  component: InstanceCountBadge,
  parameters: {
    layout: "centered",
    backgrounds: {
      default: "accent",
      values: [
        { name: "accent", value: "#007ACC" },
        { name: "dark", value: "#1E1E1E" },
        { name: "light", value: "#F5F5F5" },
      ],
    },
  },
  argTypes: {
    count: {
      control: { type: "number", min: 1, max: 10 },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const TwoInstances: Story = {
  args: {
    count: 2,
  },
}

export const FiveInstances: Story = {
  args: {
    count: 5,
  },
}

export const ManyInstances: Story = {
  args: {
    count: 10,
  },
}

export const InHeader: Story = {
  render: () => (
    <div
      className="flex items-center gap-4 rounded-lg px-4 py-3"
      style={{ backgroundColor: "#007ACC", color: "white" }}
    >
      <span className="text-lg font-semibold">ralph</span>
      <span className="text-sm opacity-80">my-workspace</span>
      <InstanceCountBadge count={3} />
    </div>
  ),
  parameters: {
    backgrounds: { default: "dark" },
  },
}
