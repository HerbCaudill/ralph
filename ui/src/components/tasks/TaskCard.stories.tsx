import type { Meta, StoryObj } from "@storybook/react-vite"
import { TaskCard, type TaskCardTask } from "./TaskCard"
import { fn } from "storybook/test"

const meta: Meta<typeof TaskCard> = {
  title: "Tasks/TaskCard",
  component: TaskCard,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  decorators: [
    Story => (
      <div className="border-border max-w-md overflow-hidden rounded-md border">
        <Story />
      </div>
    ),
  ],
  args: {
    onStatusChange: fn(),
    onClick: fn(),
  },
}

export default meta
type Story = StoryObj<typeof meta>

const baseTask: TaskCardTask = {
  id: "rui-4rt",
  title: "Implement user authentication",
  status: "open",
  priority: 2,
}

export const Open: Story = {
  args: {
    task: {
      ...baseTask,
      status: "open",
    },
  },
}

export const InProgress: Story = {
  args: {
    task: {
      ...baseTask,
      status: "in_progress",
    },
  },
}

export const Blocked: Story = {
  args: {
    task: {
      ...baseTask,
      status: "blocked",
    },
  },
}

export const Deferred: Story = {
  args: {
    task: {
      ...baseTask,
      status: "deferred",
    },
  },
}

export const Closed: Story = {
  args: {
    task: {
      ...baseTask,
      status: "closed",
    },
  },
}

export const WithDescription: Story = {
  args: {
    task: {
      ...baseTask,
      description:
        "This task involves setting up OAuth2 authentication with Google and GitHub providers. Need to configure callback URLs and store tokens securely.",
    },
  },
}

export const WithParent: Story = {
  args: {
    task: {
      ...baseTask,
      parent: "rui-1",
      issue_type: "task",
    },
  },
}

export const FullDetails: Story = {
  args: {
    task: {
      id: "rui-4rt.5",
      title: "Configure OAuth callback URLs",
      status: "in_progress",
      priority: 1,
      description:
        "Set up callback URLs for both development and production environments. Test with Google OAuth flow.",
      issue_type: "task",
      parent: "rui-4rt",
    },
  },
}

export const Priority0Critical: Story = {
  args: {
    task: {
      ...baseTask,
      priority: 0,
      title: "Critical security vulnerability fix",
    },
  },
}

export const Priority1High: Story = {
  args: {
    task: {
      ...baseTask,
      priority: 1,
    },
  },
}

export const Priority3Low: Story = {
  args: {
    task: {
      ...baseTask,
      priority: 3,
      title: "Nice to have feature",
    },
  },
}

export const Priority4Lowest: Story = {
  args: {
    task: {
      ...baseTask,
      priority: 4,
      title: "Backlog item",
    },
  },
}

export const NoPriority: Story = {
  args: {
    task: {
      id: "rui-xyz",
      title: "Task without priority",
      status: "open",
    },
  },
}

export const WithoutStatusChangeHandler: Story = {
  args: {
    task: baseTask,
    onStatusChange: undefined,
  },
}

export const LongTitle: Story = {
  args: {
    task: {
      ...baseTask,
      title:
        "This is a very long task title that should be truncated when it exceeds the available width of the card component",
    },
  },
}

export const AllStatuses: Story = {
  render: () => (
    <div className="space-y-0">
      <TaskCard task={{ id: "rui-1", title: "Open task", status: "open", priority: 2 }} />
      <TaskCard
        task={{ id: "rui-2", title: "In progress task", status: "in_progress", priority: 1 }}
      />
      <TaskCard task={{ id: "rui-3", title: "Blocked task", status: "blocked", priority: 0 }} />
      <TaskCard task={{ id: "rui-4", title: "Deferred task", status: "deferred", priority: 3 }} />
      <TaskCard task={{ id: "rui-5", title: "Closed task", status: "closed", priority: 4 }} />
    </div>
  ),
  decorators: [
    Story => (
      <div className="border-border max-w-md overflow-hidden rounded-md border">
        <Story />
      </div>
    ),
  ],
}
