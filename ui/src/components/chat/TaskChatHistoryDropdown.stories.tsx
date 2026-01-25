import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within, userEvent, fn } from "storybook/test"
import { TaskChatHistoryDropdownView } from "./TaskChatHistoryDropdown"
import type { TaskChatSessionMetadata } from "@/lib/persistence"

/** Helper to create session metadata */
function createSession(
  id: string,
  taskId: string,
  taskTitle: string | null,
  updatedAt: number,
  messageCount: number,
): TaskChatSessionMetadata {
  return {
    id,
    taskId,
    taskTitle,
    instanceId: "default",
    createdAt: updatedAt - 3600000,
    updatedAt,
    messageCount,
    eventCount: messageCount * 2,
    lastEventSequence: messageCount * 2,
  }
}

// Time helpers
const now = Date.now()
const oneHourAgo = now - 3600000
const twoHoursAgo = now - 7200000
const yesterday = now - 86400000
const twoDaysAgo = now - 172800000

const meta: Meta<typeof TaskChatHistoryDropdownView> = {
  title: "Selectors/TaskChatHistoryDropdown",
  component: TaskChatHistoryDropdownView,
  parameters: {},
  tags: ["autodocs"],
  decorators: [
    Story => (
      <div className="flex justify-end p-8">
        <Story />
      </div>
    ),
  ],
  args: {
    sessions: [],
    isLoading: false,
    error: null,
    issuePrefix: "PROJ-",
    onSelectSession: fn(),
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    sessions: [
      createSession("session-1", "PROJ-123", "Fix authentication bug", oneHourAgo, 5),
      createSession("session-2", "PROJ-124", "Add dark mode support", twoHoursAgo, 12),
      createSession("session-3", "PROJ-125", "Refactor API endpoints", yesterday, 8),
      createSession("session-4", "PROJ-126", "Update documentation", twoDaysAgo, 3),
    ],
  },
}

export const Loading: Story = {
  args: {
    sessions: [],
    isLoading: true,
    error: null,
  },
}

export const Empty: Story = {
  args: {
    sessions: [],
    isLoading: false,
    error: null,
  },
}

export const WithError: Story = {
  args: {
    sessions: [],
    isLoading: false,
    error: "Failed to connect to database",
  },
}

export const ManySessions: Story = {
  args: {
    sessions: [
      // Today's sessions
      ...Array.from({ length: 5 }, (_, i) =>
        createSession(
          `today-${i}`,
          `PROJ-${100 + i}`,
          `Task ${i + 1} - Today`,
          now - i * 1800000,
          Math.floor(Math.random() * 20) + 1,
        ),
      ),
      // Yesterday's sessions
      ...Array.from({ length: 3 }, (_, i) =>
        createSession(
          `yesterday-${i}`,
          `PROJ-${200 + i}`,
          `Task ${i + 1} - Yesterday`,
          yesterday - i * 3600000,
          Math.floor(Math.random() * 20) + 1,
        ),
      ),
      // Older sessions
      ...Array.from({ length: 4 }, (_, i) =>
        createSession(
          `older-${i}`,
          `PROJ-${300 + i}`,
          `Task ${i + 1} - Older`,
          twoDaysAgo - i * 86400000,
          Math.floor(Math.random() * 20) + 1,
        ),
      ),
    ],
  },
}

export const UntitledTask: Story = {
  args: {
    sessions: [
      createSession("session-1", "PROJ-123", null, oneHourAgo, 5),
      createSession("session-2", "untitled", null, twoHoursAgo, 3),
    ],
  },
}

export const WithLongTitles: Story = {
  args: {
    sessions: [
      createSession(
        "session-1",
        "PROJ-123",
        "This is a very long task title that should truncate properly in the dropdown menu when it overflows",
        oneHourAgo,
        15,
      ),
      createSession(
        "session-2",
        "PROJ-124",
        "Another extremely long title to test the truncation behavior of the component",
        twoHoursAgo,
        8,
      ),
    ],
  },
}

export const NoIssuePrefix: Story = {
  args: {
    sessions: [
      createSession("session-1", "fix-auth-bug", "Fix authentication bug", oneHourAgo, 5),
      createSession("session-2", "add-dark-mode", "Add dark mode support", twoHoursAgo, 12),
    ],
    issuePrefix: null,
  },
}

// ============================================================================
// Interaction tests (migrated from Playwright)
// ============================================================================

/** Verifies the trigger button is visible. */
export const TriggerButtonVisible: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = await canvas.findByTestId("task-chat-history-dropdown-trigger")
    await expect(trigger).toBeVisible()
  },
}

/** Verifies trigger button has accessible aria-label. */
export const TriggerButtonAccessibility: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = await canvas.findByTestId("task-chat-history-dropdown-trigger")
    await expect(trigger).toHaveAttribute("aria-label", "View chat history")
    await expect(trigger).toHaveAttribute("title", "Chat history")
  },
}

/** Verifies clicking trigger opens the dropdown. */
export const ClickOpensDropdown: Story = {
  args: {
    sessions: [createSession("session-1", "PROJ-123", "Test task", oneHourAgo, 5)],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    const trigger = await canvas.findByTestId("task-chat-history-dropdown-trigger")
    await userEvent.click(trigger)

    // Note: Radix popovers render in portals which may not be "visible" by testing-library standards
    const popover = await canvas.findByTestId("task-chat-history-popover")
    await expect(popover).toBeInTheDocument()
  },
}

/** Verifies search input is present when dropdown opens. */
export const SearchInputVisible: Story = {
  args: {
    sessions: [createSession("session-1", "PROJ-123", "Test task", oneHourAgo, 5)],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    const trigger = await canvas.findByTestId("task-chat-history-dropdown-trigger")
    await userEvent.click(trigger)

    // Verify the popover and search input exist in the document
    // Note: Radix popovers render in portals which may not be "visible" by testing-library standards
    const popover = await canvas.findByTestId("task-chat-history-popover")
    await expect(popover).toBeInTheDocument()

    const searchInput = await canvas.findByTestId("search-input")
    await expect(searchInput).toBeInTheDocument()
  },
}

/** Verifies search input has correct placeholder. */
export const SearchInputPlaceholder: Story = {
  args: {
    sessions: [createSession("session-1", "PROJ-123", "Test task", oneHourAgo, 5)],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    const trigger = await canvas.findByTestId("task-chat-history-dropdown-trigger")
    await userEvent.click(trigger)

    const searchInput = await canvas.findByTestId("search-input")
    await expect(searchInput).toHaveAttribute("placeholder", "Search chat sessions...")
  },
}

/** Verifies typing in search input works. */
export const CanTypeInSearch: Story = {
  args: {
    sessions: [createSession("session-1", "PROJ-123", "Test task", oneHourAgo, 5)],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    const trigger = await canvas.findByTestId("task-chat-history-dropdown-trigger")
    await userEvent.click(trigger)

    const searchInput = await canvas.findByTestId("search-input")
    await userEvent.type(searchInput, "test query")
    await expect(searchInput).toHaveValue("test query")
  },
}

/** Verifies empty state message is shown when no sessions exist. */
export const EmptyStateMessage: Story = {
  args: {
    sessions: [],
    isLoading: false,
    error: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    const trigger = await canvas.findByTestId("task-chat-history-dropdown-trigger")
    await userEvent.click(trigger)

    const emptyState = await canvas.findByTestId("empty-state")
    await expect(emptyState).toBeInTheDocument()
    await expect(emptyState).toHaveTextContent("No chat sessions found.")
  },
}

/** Verifies loading state is displayed. */
export const LoadingStateDisplay: Story = {
  args: {
    sessions: [],
    isLoading: true,
    error: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    const trigger = await canvas.findByTestId("task-chat-history-dropdown-trigger")
    await userEvent.click(trigger)

    const emptyState = await canvas.findByTestId("empty-state")
    await expect(emptyState).toBeInTheDocument()
    await expect(emptyState).toHaveTextContent("Loading...")
  },
}

/** Verifies error message is displayed. */
export const ErrorStateDisplay: Story = {
  args: {
    sessions: [],
    isLoading: false,
    error: "Connection failed",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    const trigger = await canvas.findByTestId("task-chat-history-dropdown-trigger")
    await userEvent.click(trigger)

    const emptyState = await canvas.findByTestId("empty-state")
    await expect(emptyState).toBeInTheDocument()
    await expect(emptyState).toHaveTextContent("Connection failed")
  },
}

/** Verifies date groups are shown when sessions exist. */
export const DateGroupsDisplay: Story = {
  args: {
    sessions: [
      createSession("session-1", "PROJ-123", "Today task", oneHourAgo, 5),
      createSession("session-2", "PROJ-124", "Yesterday task", yesterday, 8),
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    const trigger = await canvas.findByTestId("task-chat-history-dropdown-trigger")
    await userEvent.click(trigger)

    const dateGroups = await canvas.findAllByTestId("date-group")
    await expect(dateGroups.length).toBeGreaterThan(0)
  },
}

/** Verifies session items are visible. */
export const SessionItemsVisible: Story = {
  args: {
    sessions: [createSession("session-1", "PROJ-123", "Test task", oneHourAgo, 5)],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    const trigger = await canvas.findByTestId("task-chat-history-dropdown-trigger")
    await userEvent.click(trigger)

    const sessionItem = await canvas.findByTestId("session-item")
    await expect(sessionItem).toBeInTheDocument()
  },
}

/** Verifies selecting a session calls the callback. */
export const SelectingSessionCallsCallback: Story = {
  args: {
    sessions: [createSession("session-1", "PROJ-123", "Test task", oneHourAgo, 5)],
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    const trigger = await canvas.findByTestId("task-chat-history-dropdown-trigger")
    await userEvent.click(trigger)

    const sessionItem = await canvas.findByTestId("session-item")
    await userEvent.click(sessionItem)

    await expect(args.onSelectSession).toHaveBeenCalledWith("session-1")
  },
}

// Note: EscapeClosesDropdown test removed - Radix Popover behavior is tested by Radix itself.
// The Playwright E2E test (clicking outside closes dropdown) covers integration behavior.

/** Verifies search input is a combobox for accessibility. */
export const SearchInputIsCombobox: Story = {
  args: {
    sessions: [createSession("session-1", "PROJ-123", "Test task", oneHourAgo, 5)],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    const trigger = await canvas.findByTestId("task-chat-history-dropdown-trigger")
    await userEvent.click(trigger)

    const searchInput = await canvas.findByTestId("search-input")
    await expect(searchInput).toHaveAttribute("role", "combobox")
  },
}

/** Verifies message count is displayed in session items. */
export const SessionShowsMessageCount: Story = {
  args: {
    sessions: [createSession("session-1", "PROJ-123", "Test task", oneHourAgo, 15)],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)

    const trigger = await canvas.findByTestId("task-chat-history-dropdown-trigger")
    await userEvent.click(trigger)

    const messageCount = await canvas.findByTestId("message-count")
    await expect(messageCount).toBeInTheDocument()
    await expect(messageCount).toHaveTextContent("15")
  },
}
