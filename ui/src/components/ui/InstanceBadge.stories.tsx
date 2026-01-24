import type { Meta, StoryObj } from "@storybook/react-vite"
import { InstanceBadge } from "./InstanceBadge"

const meta: Meta<typeof InstanceBadge> = {
  title: "Content/InstanceBadge",
  component: InstanceBadge,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    status: {
      control: "select",
      options: [
        "stopped",
        "starting",
        "running",
        "pausing",
        "paused",
        "stopping",
        "stopping_after_current",
      ],
    },
    name: {
      control: "text",
    },
    showLabel: {
      control: "boolean",
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Running: Story = {
  args: {
    status: "running",
    name: "Ralph",
  },
}

export const Paused: Story = {
  args: {
    status: "paused",
    name: "Ralph",
  },
}

export const Stopped: Story = {
  args: {
    status: "stopped",
    name: "Ralph",
  },
}

export const Starting: Story = {
  args: {
    status: "starting",
    name: "Ralph",
  },
}

export const Stopping: Story = {
  args: {
    status: "stopping",
    name: "Marge",
  },
}

export const StoppingAfterCurrent: Story = {
  args: {
    status: "stopping_after_current",
    name: "Homer",
  },
}

export const WithoutName: Story = {
  args: {
    status: "running",
  },
}

export const IndicatorOnly: Story = {
  args: {
    status: "running",
    name: "Ralph",
    showLabel: false,
  },
}

export const AllStatuses: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <InstanceBadge status="stopped" name="Ralph" />
      <InstanceBadge status="starting" name="Ralph" />
      <InstanceBadge status="running" name="Ralph" />
      <InstanceBadge status="pausing" name="Ralph" />
      <InstanceBadge status="paused" name="Ralph" />
      <InstanceBadge status="stopping" name="Ralph" />
      <InstanceBadge status="stopping_after_current" name="Ralph" />
    </div>
  ),
}

export const MultipleInstances: Story = {
  render: () => (
    <div className="bg-background flex flex-col gap-2 rounded-lg border p-4">
      <div className="mb-2 text-sm font-medium">Active Instances</div>
      <InstanceBadge status="running" name="Ralph" />
      <InstanceBadge status="paused" name="Marge" />
      <InstanceBadge status="running" name="Homer" />
      <InstanceBadge status="stopped" name="Ned" />
    </div>
  ),
}
