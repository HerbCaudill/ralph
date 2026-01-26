import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within, userEvent, fn } from "storybook/test"
import { SessionHistoryPanelView } from "./SessionHistoryPanel"
import type { SessionSummary } from "@/hooks"

/** Helper to create event log mock data */
function createSession(
  id: string,
  taskId: string | undefined,
  title: string | undefined,
  createdAt: string,
  eventCount: number,
): SessionSummary {
  return {
    id,
    createdAt,
    eventCount,
    metadata: taskId ? { taskId, title } : undefined,
  }
}

// Time helpers
const now = new Date()
const today = now.toISOString()
const oneHourAgo = new Date(now.getTime() - 3600000).toISOString()
const twoHoursAgo = new Date(now.getTime() - 7200000).toISOString()
const yesterday = new Date(now.getTime() - 86400000).toISOString()
const twoDaysAgo = new Date(now.getTime() - 172800000).toISOString()

const meta: Meta<typeof SessionHistoryPanelView> = {
  title: "Panels/SessionHistoryPanel",
  component: SessionHistoryPanelView,
  parameters: {},
  tags: ["autodocs"],
  decorators: [
    Story => (
      <div className="border-border h-[600px] w-80 border-r">
        <Story />
      </div>
    ),
  ],
  args: {
    sessions: [],
    isLoading: false,
    error: null,
    issuePrefix: "PROJ-",
    onItemClick: fn(),
    onRetry: fn(),
  },
}

export default meta
type Story = StoryObj<typeof meta>

/** Default empty state. */
export const Empty: Story = {
  args: {
    sessions: [],
    isLoading: false,
    error: null,
  },
}

/** Loading state. */
export const Loading: Story = {
  args: {
    sessions: [],
    isLoading: true,
    error: null,
  },
}

/** Error state with retry button. */
export const WithError: Story = {
  args: {
    sessions: [],
    isLoading: false,
    error: "Failed to load sessions",
  },
}

/** With session data. */
export const WithSessions: Story = {
  args: {
    sessions: [
      createSession("log-1", "PROJ-123", "Fix authentication bug", oneHourAgo, 42),
      createSession("log-2", "PROJ-124", "Add dark mode support", twoHoursAgo, 28),
      createSession("log-3", "PROJ-125", "Refactor API endpoints", yesterday, 156),
      createSession("log-4", "PROJ-126", "Update documentation", twoDaysAgo, 15),
    ],
  },
}

/** With many sessions across multiple days. */
export const ManySessions: Story = {
  args: {
    sessions: [
      // Today
      createSession("today-1", "PROJ-101", "Task 1 - Today", today, 45),
      createSession("today-2", "PROJ-102", "Task 2 - Today", oneHourAgo, 32),
      createSession("today-3", "PROJ-103", "Task 3 - Today", twoHoursAgo, 18),
      // Yesterday
      createSession("yesterday-1", "PROJ-201", "Task 1 - Yesterday", yesterday, 67),
      createSession(
        "yesterday-2",
        "PROJ-202",
        "Task 2 - Yesterday",
        new Date(now.getTime() - 90000000).toISOString(),
        54,
      ),
      // Older
      createSession("older-1", "PROJ-301", "Task 1 - Older", twoDaysAgo, 89),
      createSession(
        "older-2",
        "PROJ-302",
        "Task 2 - Older",
        new Date(now.getTime() - 259200000).toISOString(),
        23,
      ),
    ],
  },
}

/** Session without a task (no task metadata). */
export const WithoutTask: Story = {
  args: {
    sessions: [
      createSession("log-1", undefined, undefined, oneHourAgo, 42),
      createSession("log-2", "PROJ-124", "Has a task", twoHoursAgo, 28),
    ],
  },
}

/** With long task titles. */
export const LongTitles: Story = {
  args: {
    sessions: [
      createSession(
        "log-1",
        "PROJ-123",
        "This is a very long task title that should truncate properly in the panel when it overflows the available width",
        oneHourAgo,
        42,
      ),
      createSession(
        "log-2",
        "PROJ-124",
        "Another extremely long title to test the truncation behavior of the component in various scenarios",
        twoHoursAgo,
        28,
      ),
    ],
  },
}

// ============================================================================
// Interaction tests (migrated from Playwright)
// ============================================================================

/** Verifies empty state message is shown when no sessions exist. */
export const EmptyStateMessage: Story = {
  args: {
    sessions: [],
    isLoading: false,
    error: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const emptyState = await canvas.findByTestId("empty-state")
    await expect(emptyState).toBeVisible()
    await expect(emptyState).toHaveTextContent("No session history yet")
  },
}

/** Verifies loading state is displayed correctly. */
export const LoadingStateDisplay: Story = {
  args: {
    sessions: [],
    isLoading: true,
    error: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const loadingState = await canvas.findByTestId("loading-state")
    await expect(loadingState).toBeVisible()
    await expect(loadingState).toHaveTextContent("Loading sessions...")
  },
}

/** Verifies error state with retry button. */
export const ErrorStateWithRetry: Story = {
  args: {
    sessions: [],
    isLoading: false,
    error: "Connection failed",
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    const errorState = await canvas.findByTestId("error-state")
    await expect(errorState).toBeVisible()
    await expect(errorState).toHaveTextContent("Connection failed")

    const retryButton = await canvas.findByTestId("retry-button")
    await expect(retryButton).toBeVisible()

    await userEvent.click(retryButton)
    await expect(args.onRetry).toHaveBeenCalled()
  },
}

/** Verifies search input is visible when sessions exist. */
export const SearchInputVisible: Story = {
  args: {
    sessions: [createSession("log-1", "PROJ-123", "Test task", oneHourAgo, 42)],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const searchInput = await canvas.findByTestId("search-input")
    await expect(searchInput).toBeVisible()
    await expect(searchInput).toHaveAttribute("placeholder", "Search by task ID or title...")
    await expect(searchInput).toHaveAttribute("aria-label", "Search sessions")
  },
}

/** Verifies search input is hidden when no sessions exist. */
export const SearchInputHiddenWhenEmpty: Story = {
  args: {
    sessions: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const searchInput = canvas.queryByTestId("search-input")
    await expect(searchInput).toBeNull()
  },
}

/** Verifies clear button appears when search has text. */
export const ClearButtonAppearsWithText: Story = {
  args: {
    sessions: [createSession("log-1", "PROJ-123", "Test task", oneHourAgo, 42)],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Initially no clear button
    let clearButton = canvas.queryByTestId("clear-search-button")
    await expect(clearButton).toBeNull()

    // Type in search
    const searchInput = await canvas.findByTestId("search-input")
    await userEvent.type(searchInput, "test")

    // Clear button should appear
    clearButton = await canvas.findByTestId("clear-search-button")
    await expect(clearButton).toBeVisible()
  },
}

/** Verifies clear button clears search text. */
export const ClearButtonClearsText: Story = {
  args: {
    sessions: [createSession("log-1", "PROJ-123", "Test task", oneHourAgo, 42)],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Type in search
    const searchInput = await canvas.findByTestId("search-input")
    await userEvent.type(searchInput, "test query")
    await expect(searchInput).toHaveValue("test query")

    // Click clear button
    const clearButton = await canvas.findByTestId("clear-search-button")
    await userEvent.click(clearButton)

    // Search should be cleared
    await expect(searchInput).toHaveValue("")
  },
}

/** Verifies searching with no matches shows 'no results' message. */
export const NoResultsMessage: Story = {
  args: {
    sessions: [createSession("log-1", "PROJ-123", "Fix bug", oneHourAgo, 42)],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Search for something that won't match
    const searchInput = await canvas.findByTestId("search-input")
    await userEvent.type(searchInput, "xyznonexistent123")

    // Should show no results message
    const noResults = await canvas.findByTestId("no-results")
    await expect(noResults).toBeVisible()
    await expect(noResults).toHaveTextContent("No matching sessions found")
  },
}

/** Verifies date groups are shown correctly. */
export const DateGroupsDisplay: Story = {
  // Use render to create fresh dates at render time, not module load time.
  // This ensures timestamps are relative to when the story actually renders,
  // preventing flaky tests when the module is cached from previous test runs.
  render: args => {
    // Create a timestamp that's definitely "today" in local timezone by using noon local time
    const now = new Date()
    const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0)
    // Create a timestamp that's definitely yesterday by going back 36 hours from now
    const definitelyYesterday = new Date(now.getTime() - 36 * 60 * 60 * 1000)

    const freshSessions = [
      createSession("log-1", "PROJ-123", "Today task", todayNoon.toISOString(), 42),
      createSession("log-2", "PROJ-124", "Yesterday task", definitelyYesterday.toISOString(), 28),
    ]
    return <SessionHistoryPanelView {...args} sessions={freshSessions} />
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const dateGroups = await canvas.findAllByTestId("date-group")
    await expect(dateGroups.length).toBeGreaterThan(0)

    const dateLabels = await canvas.findAllByTestId("date-label")
    await expect(dateLabels.length).toBeGreaterThan(0)

    // Should include "Today" label since one session is from today noon
    const todayLabel = dateLabels.find(label => label.textContent?.toLowerCase().includes("today"))
    await expect(todayLabel).toBeTruthy()
  },
}

/** Verifies session items show event count. */
export const ItemsShowEventCount: Story = {
  args: {
    sessions: [createSession("log-1", "PROJ-123", "Test task", oneHourAgo, 42)],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const eventCount = await canvas.findByTestId("event-count")
    await expect(eventCount).toBeVisible()
    await expect(eventCount).toHaveTextContent("42 events")
  },
}

/** Verifies session items are clickable. */
export const ItemsAreClickable: Story = {
  args: {
    sessions: [createSession("log-1", "PROJ-123", "Test task", oneHourAgo, 42)],
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    const itemButton = await canvas.findByTestId("session-item-button")
    await expect(itemButton).toBeVisible()

    await userEvent.click(itemButton)
    await expect(args.onItemClick).toHaveBeenCalledWith("log-1")
  },
}

/** Verifies session list has proper ARIA role. */
export const ListHasProperAriaRole: Story = {
  args: {
    sessions: [createSession("log-1", "PROJ-123", "Test task", oneHourAgo, 42)],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const list = await canvas.findByTestId("session-list")
    await expect(list).toHaveAttribute("role", "list")
    await expect(list).toHaveAttribute("aria-label", "Session history")
  },
}

/** Verifies session item buttons have accessible labels. */
export const ItemsHaveAccessibleLabels: Story = {
  args: {
    sessions: [createSession("log-1", "PROJ-123", "Test task", oneHourAgo, 42)],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const itemButton = await canvas.findByTestId("session-item-button")
    const ariaLabel = itemButton.getAttribute("aria-label")
    await expect(ariaLabel).toMatch(/view session/i)
  },
}

/** Verifies session count is shown in header. */
export const ShowsSessionCount: Story = {
  args: {
    sessions: [
      createSession("log-1", "PROJ-123", "Task 1", oneHourAgo, 42),
      createSession("log-2", "PROJ-124", "Task 2", twoHoursAgo, 28),
      createSession("log-3", "PROJ-125", "Task 3", yesterday, 15),
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const count = await canvas.findByTestId("session-count")
    await expect(count).toBeVisible()
    await expect(count).toHaveTextContent("(3)")
  },
}
