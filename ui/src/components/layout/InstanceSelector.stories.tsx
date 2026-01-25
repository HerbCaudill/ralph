import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { InstanceSelectorView } from "./InstanceSelectorView"
import type { RalphInstance, RalphStatus } from "@/types"

/**
 * Helper to create a test instance with minimal boilerplate.
 */
function createInstance(id: string, name: string, status: RalphStatus = "stopped"): RalphInstance {
  return {
    id,
    name,
    agentName: `Ralph-${id}`,
    status,
    events: [],
    tokenUsage: { input: 0, output: 0 },
    contextWindow: { used: 0, max: 200000 },
    iteration: { current: 0, total: 0 },
    worktreePath: null,
    branch: null,
    currentTaskId: null,
    currentTaskTitle: null,
    createdAt: Date.now(),
    runStartedAt: null,
    mergeConflict: null,
  }
}

/**
 * Default instances for stories.
 */
const defaultInstances = new Map<string, RalphInstance>([
  ["default", createInstance("default", "Main", "stopped")],
])

const meta: Meta<typeof InstanceSelectorView> = {
  title: "Selectors/InstanceSelector",
  component: InstanceSelectorView,
  parameters: {},
  args: {
    instances: defaultInstances,
    activeInstanceId: "default",
    onSelectInstance: fn(),
  },
  argTypes: {
    instances: {
      control: false,
      description: "Map of instance ID to instance data",
    },
    activeInstanceId: {
      control: "text",
      description: "ID of the currently active instance",
    },
    textColor: {
      control: "color",
      description: "Text color for header variant",
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithTextColor: Story = {
  args: {
    textColor: "#ffffff",
  },
  decorators: [
    Story => (
      <div className="bg-status-success rounded-lg p-4">
        <Story />
      </div>
    ),
  ],
}

export const SingleInstanceStopped: Story = {
  args: {
    instances: new Map([["default", createInstance("default", "Main", "stopped")]]),
    activeInstanceId: "default",
  },
}

export const SingleInstanceRunning: Story = {
  args: {
    instances: new Map([["default", createInstance("default", "Main", "running")]]),
    activeInstanceId: "default",
  },
}

export const MultipleInstances: Story = {
  args: {
    instances: new Map<string, RalphInstance>([
      ["default", createInstance("default", "Main", "running")],
      ["worktree-1", createInstance("worktree-1", "Worktree 1", "paused")],
      ["worktree-2", createInstance("worktree-2", "Worktree 2", "running")],
    ]),
    activeInstanceId: "default",
  },
}

export const VariousStatuses: Story = {
  args: {
    instances: new Map<string, RalphInstance>([
      ["default", createInstance("default", "Main", "running")],
      ["starting-1", createInstance("starting-1", "Starting Instance", "starting")],
      ["paused-1", createInstance("paused-1", "Paused Instance", "paused")],
      ["stopping-1", createInstance("stopping-1", "Stopping Instance", "stopping")],
      ["stopped-1", createInstance("stopped-1", "Stopped Instance", "stopped")],
    ]),
    activeInstanceId: "default",
  },
}

export const InHeader: Story = {
  args: {
    textColor: "#ffffff",
    instances: new Map<string, RalphInstance>([
      ["default", createInstance("default", "Main", "running")],
      ["worktree-1", createInstance("worktree-1", "Feature Branch", "running")],
    ]),
    activeInstanceId: "default",
  },
  decorators: [
    Story => (
      <div className="flex h-14 w-96 items-center rounded-lg bg-blue-600 px-4">
        <Story />
      </div>
    ),
  ],
}
