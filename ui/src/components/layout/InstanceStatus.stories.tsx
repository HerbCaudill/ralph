import type { Meta, StoryObj } from "@storybook/react-vite"
import { InstanceStatus } from "./InstanceStatus"
import { withStoreState } from "../../../.storybook/decorators"

const meta: Meta<typeof InstanceStatus> = {
  title: "Layout/InstanceStatus",
  component: InstanceStatus,
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
  tags: ["autodocs"],
}

export default meta
type Story = StoryObj<typeof meta>

export const Running: Story = {
  args: {
    textColor: "white",
  },
  decorators: [
    withStoreState({
      ralphStatus: "running",
    }),
  ],
}

export const RunningWithTask: Story = {
  args: {
    textColor: "white",
  },
  decorators: [
    withStoreState({
      ralphStatus: "running",
      instances: new Map([
        [
          "default",
          {
            id: "default",
            name: "Main",
            agentName: "Ralph",
            status: "running",
            events: [],
            tokenUsage: { input: 0, output: 0 },
            contextWindow: { used: 0, max: 200000 },
            iteration: { current: 0, total: 0 },
            worktreePath: null,
            branch: null,
            currentTaskId: "task-123",
            currentTaskTitle: "Fix login bug",
            createdAt: Date.now(),
            runStartedAt: Date.now(),
            mergeConflict: null,
          },
        ],
      ]),
      activeInstanceId: "default",
    }),
  ],
}

export const Paused: Story = {
  args: {
    textColor: "white",
  },
  decorators: [
    withStoreState({
      ralphStatus: "paused",
      instances: new Map([
        [
          "default",
          {
            id: "default",
            name: "Main",
            agentName: "Ralph",
            status: "paused",
            events: [],
            tokenUsage: { input: 0, output: 0 },
            contextWindow: { used: 0, max: 200000 },
            iteration: { current: 0, total: 0 },
            worktreePath: null,
            branch: null,
            currentTaskId: "task-123",
            currentTaskTitle: "Add authentication",
            createdAt: Date.now(),
            runStartedAt: Date.now(),
            mergeConflict: null,
          },
        ],
      ]),
      activeInstanceId: "default",
    }),
  ],
}

export const WorktreeInstance: Story = {
  args: {
    textColor: "white",
  },
  decorators: [
    withStoreState({
      ralphStatus: "running",
      instances: new Map([
        [
          "alice",
          {
            id: "alice",
            name: "Worktree 1",
            agentName: "Alice",
            status: "running",
            events: [],
            tokenUsage: { input: 0, output: 0 },
            contextWindow: { used: 0, max: 200000 },
            iteration: { current: 0, total: 0 },
            worktreePath: "/path/to/worktree",
            branch: "feature/auth",
            currentTaskId: "task-456",
            currentTaskTitle: "Implement OAuth2",
            createdAt: Date.now(),
            runStartedAt: Date.now(),
            mergeConflict: null,
          },
        ],
      ]),
      activeInstanceId: "alice",
    }),
  ],
}

export const LongTaskTitle: Story = {
  args: {
    textColor: "white",
  },
  decorators: [
    withStoreState({
      ralphStatus: "running",
      instances: new Map([
        [
          "default",
          {
            id: "default",
            name: "Main",
            agentName: "Ralph",
            status: "running",
            events: [],
            tokenUsage: { input: 0, output: 0 },
            contextWindow: { used: 0, max: 200000 },
            iteration: { current: 0, total: 0 },
            worktreePath: null,
            branch: null,
            currentTaskId: "task-123",
            currentTaskTitle:
              "Refactor the authentication system to use JWT tokens with refresh token rotation and secure cookie storage",
            createdAt: Date.now(),
            runStartedAt: Date.now(),
            mergeConflict: null,
          },
        ],
      ]),
      activeInstanceId: "default",
    }),
  ],
}

export const InHeader: Story = {
  render: () => (
    <div
      className="flex items-center gap-4 rounded-lg px-4 py-3"
      style={{ backgroundColor: "#007ACC", color: "white" }}
    >
      <span className="text-lg font-semibold">ralph</span>
      <span className="text-sm opacity-80">my-workspace</span>
      <InstanceStatus textColor="white" />
    </div>
  ),
  decorators: [
    withStoreState({
      ralphStatus: "running",
      instances: new Map([
        [
          "default",
          {
            id: "default",
            name: "Main",
            agentName: "Ralph",
            status: "running",
            events: [],
            tokenUsage: { input: 0, output: 0 },
            contextWindow: { used: 0, max: 200000 },
            iteration: { current: 0, total: 0 },
            worktreePath: null,
            branch: null,
            currentTaskId: "task-123",
            currentTaskTitle: "Fix login bug",
            createdAt: Date.now(),
            runStartedAt: Date.now(),
            mergeConflict: null,
          },
        ],
      ]),
      activeInstanceId: "default",
    }),
  ],
  parameters: {
    backgrounds: { default: "dark" },
  },
}
