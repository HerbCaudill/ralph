import type { Meta, StoryObj } from "@storybook/react-vite"
import { ControlBar } from "./ControlBar"
import { withStoreState } from "../../../.storybook/decorators"

const meta: Meta<typeof ControlBar> = {
  title: "Controls/ControlBar",
  component: ControlBar,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
}

export default meta
type Story = StoryObj<typeof meta>

export const Stopped: Story = {
  decorators: [
    withStoreState({
      connectionStatus: "connected",
      ralphStatus: "stopped",
    }),
  ],
}

export const Starting: Story = {
  decorators: [
    withStoreState({
      connectionStatus: "connected",
      ralphStatus: "starting",
    }),
  ],
}

export const Running: Story = {
  decorators: [
    withStoreState({
      connectionStatus: "connected",
      ralphStatus: "running",
    }),
  ],
}

export const Stopping: Story = {
  decorators: [
    withStoreState({
      connectionStatus: "connected",
      ralphStatus: "stopping",
    }),
  ],
}

export const Disconnected: Story = {
  decorators: [
    withStoreState({
      connectionStatus: "disconnected",
      ralphStatus: "stopped",
    }),
  ],
}

export const Connecting: Story = {
  decorators: [
    withStoreState({
      connectionStatus: "connecting",
      ralphStatus: "stopped",
    }),
  ],
}

export const InCard: Story = {
  decorators: [
    withStoreState({
      connectionStatus: "connected",
      ralphStatus: "stopped",
    }),
  ],
  render: args => (
    <div className="border-border bg-card flex items-center gap-4 rounded-lg border p-4">
      <span className="text-muted-foreground text-sm">Agent Controls:</span>
      <ControlBar {...args} />
    </div>
  ),
}

export const AllStates: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <span className="w-24 text-sm">Stopped:</span>
        <ControlBar />
      </div>
    </div>
  ),
  decorators: [
    withStoreState({
      connectionStatus: "connected",
      ralphStatus: "stopped",
    }),
  ],
}
