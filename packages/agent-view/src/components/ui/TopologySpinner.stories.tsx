import type { Meta, StoryObj } from "@storybook/react-vite"
import { TopologySpinner } from "./TopologySpinner"

const meta: Meta<typeof TopologySpinner> = {
  title: "Primitives/TopologySpinner",
  component: TopologySpinner,
  argTypes: {
    className: {
      control: "text",
      description: "Additional CSS classes",
    },
    duration: {
      control: { type: "number", min: 100, max: 3000, step: 100 },
      description: "Duration of one full rotation in milliseconds",
    },
    stopped: {
      control: "boolean",
      description: "Whether to show a static (non-animated) icon",
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
    duration: 300,
  },
}

export const SlowSpin: Story = {
  args: {
    duration: 2000,
  },
}

export const CustomSize: Story = {
  args: {
    className: "size-10",
  },
}

export const LargeWithColor: Story = {
  args: {
    className: "size-12 text-blue-500",
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

export const Stopped: Story = {
  args: {
    stopped: true,
  },
}

export const StoppedComparison: Story = {
  render: () => (
    <div className="flex items-center gap-8">
      <div className="flex flex-col items-center gap-2">
        <TopologySpinner />
        <span className="text-muted-foreground text-sm">Running</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <TopologySpinner stopped />
        <span className="text-muted-foreground text-sm">Stopped</span>
      </div>
    </div>
  ),
}
