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
    name: "Main",
  },
}

export const Paused: Story = {
  args: {
    status: "paused",
    name: "Main",
  },
}

export const Stopped: Story = {
  args: {
    status: "stopped",
    name: "Main",
  },
}

export const Starting: Story = {
  args: {
    status: "starting",
    name: "Main",
  },
}

export const Stopping: Story = {
  args: {
    status: "stopping",
    name: "Worktree 1",
  },
}

export const StoppingAfterCurrent: Story = {
  args: {
    status: "stopping_after_current",
    name: "Worktree 2",
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
    name: "Main",
    showLabel: false,
  },
}

export const AllStatuses: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <InstanceBadge status="stopped" name="Stopped Instance" />
      <InstanceBadge status="starting" name="Starting Instance" />
      <InstanceBadge status="running" name="Running Instance" />
      <InstanceBadge status="pausing" name="Pausing Instance" />
      <InstanceBadge status="paused" name="Paused Instance" />
      <InstanceBadge status="stopping" name="Stopping Instance" />
      <InstanceBadge status="stopping_after_current" name="Stopping After Task" />
    </div>
  ),
}

export const MultipleInstances: Story = {
  render: () => (
    <div className="bg-background flex flex-col gap-2 rounded-lg border p-4">
      <div className="mb-2 text-sm font-medium">Active Instances</div>
      <InstanceBadge status="running" name="Main" />
      <InstanceBadge status="paused" name="Worktree 1" />
      <InstanceBadge status="running" name="Worktree 2" />
      <InstanceBadge status="stopped" name="Worktree 3" />
    </div>
  ),
}
