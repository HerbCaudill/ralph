import type { Meta, StoryObj } from "@storybook/react-vite"
import { TaskLifecycleEvent } from ".././TaskLifecycleEvent"

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
        }}
      />
      <TaskLifecycleEvent
        event={{
          type: "task_lifecycle",
          timestamp: Date.now(),
          action: "completed",
          taskId: "rui-4rt",
        }}
      />
    </div>
  ),
}
