import type { Meta, StoryObj } from "@storybook/react-vite"
import { StatusBar } from "./StatusBar"
import { withStoreState } from "../../../.storybook/decorators"

const meta: Meta<typeof StatusBar> = {
  title: "Layout/StatusBar",
  component: StatusBar,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  decorators: [
    Story => (
      <div className="border-border bg-background w-full rounded-md border p-2">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [
    withStoreState({
      ralphStatus: "running",
      workspace: "/Users/dev/projects/my-app",
      branch: "main",
      tokenUsage: { input: 12500, output: 3200 },
      iteration: { current: 3, total: 10 },
    }),
  ],
}

export const Stopped: Story = {
  decorators: [
    withStoreState({
      ralphStatus: "stopped",
      workspace: "/Users/dev/projects/my-app",
      branch: "feature/new-feature",
      tokenUsage: { input: 0, output: 0 },
      iteration: { current: 0, total: 0 },
    }),
  ],
}

export const Starting: Story = {
  decorators: [
    withStoreState({
      ralphStatus: "starting",
      workspace: "/Users/dev/projects/my-app",
      branch: "main",
      tokenUsage: { input: 0, output: 0 },
      iteration: { current: 0, total: 5 },
    }),
  ],
}

export const Stopping: Story = {
  decorators: [
    withStoreState({
      ralphStatus: "stopping",
      workspace: "/Users/dev/projects/my-app",
      branch: "main",
      tokenUsage: { input: 45000, output: 12000 },
      iteration: { current: 5, total: 5 },
    }),
  ],
}

export const HighTokenUsage: Story = {
  decorators: [
    withStoreState({
      ralphStatus: "running",
      workspace: "/Users/dev/projects/enterprise-app",
      branch: "develop",
      tokenUsage: { input: 1_500_000, output: 450_000 },
      iteration: { current: 47, total: 100 },
    }),
  ],
}

export const NoWorkspace: Story = {
  decorators: [
    withStoreState({
      ralphStatus: "stopped",
      workspace: null,
      branch: null,
      tokenUsage: { input: 0, output: 0 },
      iteration: { current: 0, total: 0 },
    }),
  ],
}

export const NoIteration: Story = {
  decorators: [
    withStoreState({
      ralphStatus: "running",
      workspace: "/Users/dev/projects/my-app",
      branch: "main",
      tokenUsage: { input: 5000, output: 1500 },
      iteration: { current: 0, total: 0 },
    }),
  ],
}
