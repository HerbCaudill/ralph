import type { Meta, StoryObj } from "@storybook/react-vite"
import { TopologySpinner } from "./TopologySpinner"

const meta: Meta<typeof TopologySpinner> = {
  title: "UI/TopologySpinner",
  component: TopologySpinner,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    interval: {
      control: { type: "number", min: 50, max: 1000, step: 50 },
      description: "Interval between icon changes in milliseconds",
    },
    className: {
      control: "text",
      description: "Additional CSS classes",
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}

export const FastSpin: Story = {
  args: {
    interval: 100,
  },
}

export const SlowSpin: Story = {
  args: {
    interval: 500,
  },
}

export const CustomSize: Story = {
  args: {
    className: "size-10",
  },
}

export const LargeWithColor: Story = {
  args: {
    className: "size-12 text-primary",
  },
}

export const MultipleSpinners: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <TopologySpinner className="size-4" />
      <TopologySpinner className="size-5" />
      <TopologySpinner className="size-8" />
      <TopologySpinner className="size-12" />
    </div>
  ),
}
