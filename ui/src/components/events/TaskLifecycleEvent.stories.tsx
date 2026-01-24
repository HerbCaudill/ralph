import type { Meta, StoryObj } from "@storybook/react-vite"
import { TaskLifecycleEvent } from "./TaskLifecycleEvent"

const meta: Meta<typeof TaskLifecycleEvent> = {
  title: "Feedback/TaskLifecycleEvent",
  component: TaskLifecycleEvent,
  parameters: {},
  decorators: [
    Story => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof meta>

export const Starting: Story = {
  args: {
    event: {
      type: "task_lifecycle",
      timestamp: Date.now(),
      action: "starting",
      taskId: "rui-4rt",
      taskTitle: "Implement user authentication",
    },
  },
}

export const Completed: Story = {
  args: {
    event: {
      type: "task_lifecycle",
      timestamp: Date.now(),
      action: "completed",
      taskId: "rui-4rt",
      taskTitle: "Implement user authentication",
    },
  },
}

export const StartingWithoutTitle: Story = {
  args: {
    event: {
      type: "task_lifecycle",
      timestamp: Date.now(),
      action: "starting",
      taskId: "rui-abc",
    },
  },
}

export const CompletedWithoutTitle: Story = {
  args: {
    event: {
      type: "task_lifecycle",
      timestamp: Date.now(),
      action: "completed",
      taskId: "rui-xyz",
    },
  },
}

export const StartingLongTitle: Story = {
  args: {
    event: {
      type: "task_lifecycle",
      timestamp: Date.now(),
      action: "starting",
      taskId: "rui-long",
      taskTitle:
        "This is a very long task title that might need to be truncated when displayed in the UI component",
    },
  },
}

export const CompletedLongTitle: Story = {
  args: {
    event: {
      type: "task_lifecycle",
      timestamp: Date.now(),
      action: "completed",
      taskId: "rui-long",
      taskTitle:
        "Refactor the authentication module to use OAuth2 with support for multiple providers including Google, GitHub, and Microsoft Azure AD",
    },
  },
}

export const SubtaskStarting: Story = {
  args: {
    event: {
      type: "task_lifecycle",
      timestamp: Date.now(),
      action: "starting",
      taskId: "rui-4rt.5",
      taskTitle: "Configure OAuth callback URLs",
    },
  },
}

export const SubtaskCompleted: Story = {
  args: {
    event: {
      type: "task_lifecycle",
      timestamp: Date.now(),
      action: "completed",
      taskId: "rui-4rt.5.2",
      taskTitle: "Test Google OAuth flow",
    },
  },
}

export const BothStates: Story = {
  render: () => (
    <div className="space-y-4">
      <TaskLifecycleEvent
        event={{
          type: "task_lifecycle",
          timestamp: Date.now() - 60000,
          action: "starting",
          taskId: "rui-4rt",
          taskTitle: "Implement user authentication",
        }}
      />
      <TaskLifecycleEvent
        event={{
          type: "task_lifecycle",
          timestamp: Date.now(),
          action: "completed",
          taskId: "rui-4rt",
          taskTitle: "Implement user authentication",
        }}
      />
    </div>
  ),
}
