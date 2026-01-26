import type { Meta, StoryObj } from "@storybook/react-vite"
import { IterationHistoryDropdown } from "./IterationHistoryDropdown"
import type { IterationSummary } from "@/hooks"
import { fn } from "storybook/test"

// Helper to create event log summaries
function createIteration(
  id: string,
  taskId: string | null,
  title: string | null,
  createdAt: string,
  eventCount: number,
): IterationSummary {
  return {
    id,
    createdAt,
    eventCount,
    metadata: taskId ? { taskId, title: title ?? undefined } : undefined,
  }
}

// Time helpers - using ISO strings
const now = new Date()
const oneHourAgo = new Date(now.getTime() - 3600000).toISOString()
const twoHoursAgo = new Date(now.getTime() - 7200000).toISOString()
const yesterday = new Date(now.getTime() - 86400000).toISOString()
const twoDaysAgo = new Date(now.getTime() - 172800000).toISOString()
const threeDaysAgo = new Date(now.getTime() - 259200000).toISOString()

const meta: Meta<typeof IterationHistoryDropdown> = {
  title: "Selectors/IterationHistoryDropdown",
  component: IterationHistoryDropdown,
  parameters: {},
  tags: ["autodocs"],
  decorators: [
    Story => (
      <div className="p-8">
        <Story />
      </div>
    ),
  ],
  args: {
    currentTask: null,
    iterations: [],
    isLoadingIterations: false,
    issuePrefix: "PROJ-",
    onIterationHistorySelect: fn(),
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    currentTask: { id: "PROJ-123", title: "Fix authentication bug" },
    iterations: [
      createIteration("log-1", "PROJ-120", "Previous task A", oneHourAgo, 45),
      createIteration("log-2", "PROJ-119", "Previous task B", yesterday, 32),
      createIteration("log-3", "PROJ-118", "Older task", twoDaysAgo, 28),
    ],
  },
}

export const NoCurrentTask: Story = {
  args: {
    currentTask: null,
    iterations: [
      createIteration("log-1", "PROJ-120", "Previous task A", oneHourAgo, 45),
      createIteration("log-2", "PROJ-119", "Previous task B", yesterday, 32),
    ],
  },
}

export const WithCurrentTaskOnly: Story = {
  args: {
    currentTask: { id: "PROJ-123", title: "Fix authentication bug" },
    iterations: [],
  },
}

export const LoadingIterations: Story = {
  args: {
    currentTask: { id: "PROJ-123", title: "Fix authentication bug" },
    isLoadingIterations: true,
    iterations: [],
  },
}

export const EmptyHistory: Story = {
  args: {
    currentTask: null,
    iterations: [],
    isLoadingIterations: false,
  },
}

export const ManyIterations: Story = {
  args: {
    currentTask: { id: "PROJ-123", title: "Current task" },
    iterations: [
      // Today
      createIteration("today-1", "PROJ-120", "Task from today", oneHourAgo, 45),
      createIteration("today-2", "PROJ-119", "Earlier today", twoHoursAgo, 32),
      // Yesterday
      createIteration("yesterday-1", "PROJ-118", "Yesterday task 1", yesterday, 28),
      createIteration(
        "yesterday-2",
        "PROJ-117",
        `${new Date(yesterday).toISOString().slice(0, 10)} task 2`,
        yesterday,
        22,
      ),
      // Older
      createIteration("old-1", "PROJ-116", "Two days ago", twoDaysAgo, 15),
      createIteration("old-2", "PROJ-115", "Three days ago", threeDaysAgo, 12),
    ],
  },
}

export const WithLongTaskTitles: Story = {
  args: {
    currentTask: {
      id: "PROJ-123",
      title:
        "This is a very long task title that should truncate properly in the dropdown trigger and menu",
    },
    iterations: [
      createIteration(
        "log-1",
        "PROJ-120",
        "Another extremely long title to test the truncation behavior of the iteration history dropdown component",
        oneHourAgo,
        45,
      ),
    ],
  },
}

export const TaskWithoutId: Story = {
  args: {
    currentTask: { id: null, title: "Untitled task" },
    iterations: [],
  },
}

export const IterationsWithoutTaskInfo: Story = {
  args: {
    currentTask: null,
    iterations: [
      createIteration("log-1", null, null, oneHourAgo, 45),
      createIteration("log-2", "PROJ-119", null, yesterday, 32),
      createIteration("log-3", null, "Task with title only", twoDaysAgo, 28),
    ],
  },
}

export const NoIssuePrefix: Story = {
  args: {
    currentTask: { id: "fix-auth-bug", title: "Fix authentication bug" },
    issuePrefix: null,
    iterations: [
      createIteration("log-1", "add-dark-mode", "Add dark mode support", oneHourAgo, 45),
    ],
  },
}
