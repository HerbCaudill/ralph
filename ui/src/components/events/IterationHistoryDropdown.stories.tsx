import type { Meta, StoryObj } from "@storybook/react-vite"
import { IterationHistoryDropdown } from "./IterationHistoryDropdown"
import type { EventLogSummary } from "@/hooks"
import { fn } from "storybook/test"

// Helper to create event log summaries
function createEventLog(
  id: string,
  taskId: string | null,
  title: string | null,
  createdAt: string,
  eventCount: number,
): EventLogSummary {
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
  title: "Events/IterationHistoryDropdown",
  component: IterationHistoryDropdown,
  parameters: {
    layout: "centered",
  },
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
    iterationCount: 0,
    displayedIteration: 0,
    isViewingLatest: true,
    viewingIterationIndex: null,
    eventLogs: [],
    isLoadingEventLogs: false,
    issuePrefix: "PROJ-",
    onIterationSelect: fn(),
    onEventLogSelect: fn(),
    onLatest: fn(),
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    currentTask: { id: "PROJ-123", title: "Fix authentication bug" },
    iterationCount: 3,
    displayedIteration: 3,
    isViewingLatest: true,
    eventLogs: [
      createEventLog("log-1", "PROJ-120", "Previous task A", oneHourAgo, 45),
      createEventLog("log-2", "PROJ-119", "Previous task B", yesterday, 32),
      createEventLog("log-3", "PROJ-118", "Older task", twoDaysAgo, 28),
    ],
  },
}

export const NoCurrentTask: Story = {
  args: {
    currentTask: null,
    iterationCount: 0,
    displayedIteration: 0,
    isViewingLatest: true,
    eventLogs: [
      createEventLog("log-1", "PROJ-120", "Previous task A", oneHourAgo, 45),
      createEventLog("log-2", "PROJ-119", "Previous task B", yesterday, 32),
    ],
  },
}

export const SingleIteration: Story = {
  args: {
    currentTask: { id: "PROJ-123", title: "Fix authentication bug" },
    iterationCount: 1,
    displayedIteration: 1,
    isViewingLatest: true,
    eventLogs: [],
  },
}

export const MultipleIterations: Story = {
  args: {
    currentTask: { id: "PROJ-123", title: "Fix authentication bug" },
    iterationCount: 5,
    displayedIteration: 5,
    isViewingLatest: true,
    eventLogs: [],
  },
}

export const ViewingOlderIteration: Story = {
  args: {
    currentTask: { id: "PROJ-123", title: "Fix authentication bug" },
    iterationCount: 5,
    displayedIteration: 3,
    isViewingLatest: false,
    viewingIterationIndex: 2,
    eventLogs: [],
  },
}

export const LoadingEventLogs: Story = {
  args: {
    currentTask: { id: "PROJ-123", title: "Fix authentication bug" },
    iterationCount: 2,
    displayedIteration: 2,
    isViewingLatest: true,
    isLoadingEventLogs: true,
    eventLogs: [],
  },
}

export const EmptyHistory: Story = {
  args: {
    currentTask: null,
    iterationCount: 0,
    displayedIteration: 0,
    isViewingLatest: true,
    eventLogs: [],
    isLoadingEventLogs: false,
  },
}

export const ManyEventLogs: Story = {
  args: {
    currentTask: { id: "PROJ-123", title: "Current task" },
    iterationCount: 2,
    displayedIteration: 2,
    isViewingLatest: true,
    eventLogs: [
      // Today
      createEventLog("today-1", "PROJ-120", "Task from today", oneHourAgo, 45),
      createEventLog("today-2", "PROJ-119", "Earlier today", twoHoursAgo, 32),
      // Yesterday
      createEventLog("yesterday-1", "PROJ-118", "Yesterday task 1", yesterday, 28),
      createEventLog(
        "yesterday-2",
        "PROJ-117",
        `${new Date(yesterday).toISOString().slice(0, 10)} task 2`,
        yesterday,
        22,
      ),
      // Older
      createEventLog("old-1", "PROJ-116", "Two days ago", twoDaysAgo, 15),
      createEventLog("old-2", "PROJ-115", "Three days ago", threeDaysAgo, 12),
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
    iterationCount: 2,
    displayedIteration: 2,
    isViewingLatest: true,
    eventLogs: [
      createEventLog(
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
    iterationCount: 2,
    displayedIteration: 2,
    isViewingLatest: true,
    eventLogs: [],
  },
}

export const EventLogsWithoutTaskInfo: Story = {
  args: {
    currentTask: null,
    iterationCount: 0,
    displayedIteration: 0,
    isViewingLatest: true,
    eventLogs: [
      createEventLog("log-1", null, null, oneHourAgo, 45),
      createEventLog("log-2", "PROJ-119", null, yesterday, 32),
      createEventLog("log-3", null, "Task with title only", twoDaysAgo, 28),
    ],
  },
}

export const NoIssuePrefix: Story = {
  args: {
    currentTask: { id: "fix-auth-bug", title: "Fix authentication bug" },
    iterationCount: 2,
    displayedIteration: 2,
    isViewingLatest: true,
    issuePrefix: null,
    eventLogs: [createEventLog("log-1", "add-dark-mode", "Add dark mode support", oneHourAgo, 45)],
  },
}

export const BothCurrentAndPastIterations: Story = {
  args: {
    currentTask: { id: "PROJ-123", title: "Current feature work" },
    iterationCount: 4,
    displayedIteration: 4,
    isViewingLatest: true,
    eventLogs: [
      createEventLog("log-1", "PROJ-122", "Yesterday's bug fix", yesterday, 38),
      createEventLog("log-2", "PROJ-121", "Previous feature", twoDaysAgo, 52),
      createEventLog("log-3", "PROJ-120", "Refactoring work", threeDaysAgo, 25),
    ],
  },
}
