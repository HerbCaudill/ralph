import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, within, userEvent, fn } from "storybook/test"
import { IterationHistoryPanelView } from "./IterationHistoryPanel"
import type { EventLogSummary } from "@/hooks"

/** Helper to create event log mock data */
function createEventLog(
  id: string,
  taskId: string | undefined,
  title: string | undefined,
  createdAt: string,
  eventCount: number,
): EventLogSummary {
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

const meta: Meta<typeof IterationHistoryPanelView> = {
  title: "Panels/IterationHistoryPanel",
  component: IterationHistoryPanelView,
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
    eventLogs: [],
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
    eventLogs: [],
    isLoading: false,
    error: null,
  },
}

/** Loading state. */
export const Loading: Story = {
  args: {
    eventLogs: [],
    isLoading: true,
    error: null,
  },
}

/** Error state with retry button. */
export const WithError: Story = {
  args: {
    eventLogs: [],
    isLoading: false,
    error: "Failed to load iterations",
  },
}

/** With iteration data. */
export const WithIterations: Story = {
  args: {
    eventLogs: [
      createEventLog("log-1", "PROJ-123", "Fix authentication bug", oneHourAgo, 42),
      createEventLog("log-2", "PROJ-124", "Add dark mode support", twoHoursAgo, 28),
      createEventLog("log-3", "PROJ-125", "Refactor API endpoints", yesterday, 156),
      createEventLog("log-4", "PROJ-126", "Update documentation", twoDaysAgo, 15),
    ],
  },
}

/** With many iterations across multiple days. */
export const ManyIterations: Story = {
  args: {
    eventLogs: [
      // Today
      createEventLog("today-1", "PROJ-101", "Task 1 - Today", today, 45),
      createEventLog("today-2", "PROJ-102", "Task 2 - Today", oneHourAgo, 32),
      createEventLog("today-3", "PROJ-103", "Task 3 - Today", twoHoursAgo, 18),
      // Yesterday
      createEventLog("yesterday-1", "PROJ-201", "Task 1 - Yesterday", yesterday, 67),
      createEventLog(
        "yesterday-2",
        "PROJ-202",
        "Task 2 - Yesterday",
        new Date(now.getTime() - 90000000).toISOString(),
        54,
      ),
      // Older
      createEventLog("older-1", "PROJ-301", "Task 1 - Older", twoDaysAgo, 89),
      createEventLog(
        "older-2",
        "PROJ-302",
        "Task 2 - Older",
        new Date(now.getTime() - 259200000).toISOString(),
        23,
      ),
    ],
  },
}

/** Iteration without a task (no task metadata). */
export const WithoutTask: Story = {
  args: {
    eventLogs: [
      createEventLog("log-1", undefined, undefined, oneHourAgo, 42),
      createEventLog("log-2", "PROJ-124", "Has a task", twoHoursAgo, 28),
    ],
  },
}

/** With long task titles. */
export const LongTitles: Story = {
  args: {
    eventLogs: [
      createEventLog(
        "log-1",
        "PROJ-123",
        "This is a very long task title that should truncate properly in the panel when it overflows the available width",
        oneHourAgo,
        42,
      ),
      createEventLog(
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

/** Verifies empty state message is shown when no iterations exist. */
export const EmptyStateMessage: Story = {
  args: {
    eventLogs: [],
    isLoading: false,
    error: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const emptyState = await canvas.findByTestId("empty-state")
    await expect(emptyState).toBeVisible()
    await expect(emptyState).toHaveTextContent("No iteration history yet")
  },
}

/** Verifies loading state is displayed correctly. */
export const LoadingStateDisplay: Story = {
  args: {
    eventLogs: [],
    isLoading: true,
    error: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const loadingState = await canvas.findByTestId("loading-state")
    await expect(loadingState).toBeVisible()
    await expect(loadingState).toHaveTextContent("Loading iterations...")
  },
}

/** Verifies error state with retry button. */
export const ErrorStateWithRetry: Story = {
  args: {
    eventLogs: [],
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

/** Verifies search input is visible when iterations exist. */
export const SearchInputVisible: Story = {
  args: {
    eventLogs: [createEventLog("log-1", "PROJ-123", "Test task", oneHourAgo, 42)],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const searchInput = await canvas.findByTestId("search-input")
    await expect(searchInput).toBeVisible()
    await expect(searchInput).toHaveAttribute("placeholder", "Search by task ID or title...")
    await expect(searchInput).toHaveAttribute("aria-label", "Search iterations")
  },
}

/** Verifies search input is hidden when no iterations exist. */
export const SearchInputHiddenWhenEmpty: Story = {
  args: {
    eventLogs: [],
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
    eventLogs: [createEventLog("log-1", "PROJ-123", "Test task", oneHourAgo, 42)],
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
    eventLogs: [createEventLog("log-1", "PROJ-123", "Test task", oneHourAgo, 42)],
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
    eventLogs: [createEventLog("log-1", "PROJ-123", "Fix bug", oneHourAgo, 42)],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Search for something that won't match
    const searchInput = await canvas.findByTestId("search-input")
    await userEvent.type(searchInput, "xyznonexistent123")

    // Should show no results message
    const noResults = await canvas.findByTestId("no-results")
    await expect(noResults).toBeVisible()
    await expect(noResults).toHaveTextContent("No matching iterations found")
  },
}

/** Verifies date groups are shown correctly. */
export const DateGroupsDisplay: Story = {
  args: {
    eventLogs: [
      createEventLog("log-1", "PROJ-123", "Today task", oneHourAgo, 42),
      createEventLog("log-2", "PROJ-124", "Yesterday task", yesterday, 28),
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const dateGroups = await canvas.findAllByTestId("date-group")
    await expect(dateGroups.length).toBeGreaterThan(0)

    const dateLabels = await canvas.findAllByTestId("date-label")
    await expect(dateLabels.length).toBeGreaterThan(0)

    // Should include "Today" label
    const todayLabel = dateLabels.find(label => label.textContent?.toLowerCase().includes("today"))
    await expect(todayLabel).toBeTruthy()
  },
}

/** Verifies iteration items show event count. */
export const ItemsShowEventCount: Story = {
  args: {
    eventLogs: [createEventLog("log-1", "PROJ-123", "Test task", oneHourAgo, 42)],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const eventCount = await canvas.findByTestId("event-count")
    await expect(eventCount).toBeVisible()
    await expect(eventCount).toHaveTextContent("42 events")
  },
}

/** Verifies iteration items are clickable. */
export const ItemsAreClickable: Story = {
  args: {
    eventLogs: [createEventLog("log-1", "PROJ-123", "Test task", oneHourAgo, 42)],
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    const itemButton = await canvas.findByTestId("iteration-item-button")
    await expect(itemButton).toBeVisible()

    await userEvent.click(itemButton)
    await expect(args.onItemClick).toHaveBeenCalledWith("log-1")
  },
}

/** Verifies iteration list has proper ARIA role. */
export const ListHasProperAriaRole: Story = {
  args: {
    eventLogs: [createEventLog("log-1", "PROJ-123", "Test task", oneHourAgo, 42)],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const list = await canvas.findByTestId("iteration-list")
    await expect(list).toHaveAttribute("role", "list")
    await expect(list).toHaveAttribute("aria-label", "Iteration history")
  },
}

/** Verifies iteration item buttons have accessible labels. */
export const ItemsHaveAccessibleLabels: Story = {
  args: {
    eventLogs: [createEventLog("log-1", "PROJ-123", "Test task", oneHourAgo, 42)],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const itemButton = await canvas.findByTestId("iteration-item-button")
    const ariaLabel = itemButton.getAttribute("aria-label")
    await expect(ariaLabel).toMatch(/view iteration/i)
  },
}

/** Verifies iteration count is shown in header. */
export const ShowsIterationCount: Story = {
  args: {
    eventLogs: [
      createEventLog("log-1", "PROJ-123", "Task 1", oneHourAgo, 42),
      createEventLog("log-2", "PROJ-124", "Task 2", twoHoursAgo, 28),
      createEventLog("log-3", "PROJ-125", "Task 3", yesterday, 15),
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const count = await canvas.findByTestId("iteration-count")
    await expect(count).toBeVisible()
    await expect(count).toHaveTextContent("(3)")
  },
}
