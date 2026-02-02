import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { SessionHistoryPanel } from ".././SessionHistoryPanel"
import { useAppStore } from "@/store"
import type { SessionSummary } from "@/hooks"

// Mock the hooks
const mockLoadSessionEvents = vi.fn()

vi.mock("@/hooks", async importOriginal => {
  const original = await importOriginal<typeof import("@/hooks")>()
  return {
    ...original,
    useSessions: vi.fn(),
  }
})

// Import the mocked module so we can control it
import { useSessions, type UseSessionsResult } from "@/hooks"
const mockUseSessions = vi.mocked(useSessions)

/** Default mock values for the new session events properties */
const defaultEventProps = {
  loadSessionEvents: mockLoadSessionEvents,
  selectedSession: null,
  isLoadingEvents: false,
  eventsError: null,
  clearSelectedSession: vi.fn(),
}

/** Helper to create a mock useSessions return value */
function createMockUseSessions(overrides: Partial<UseSessionsResult> = {}): UseSessionsResult {
  return {
    sessions: [],
    isLoading: false,
    error: null,
    refresh: vi.fn(),
    ...defaultEventProps,
    ...overrides,
  }
}

// Test data
const mockSessions: SessionSummary[] = [
  {
    id: "abc12345",
    createdAt: "2026-01-23T10:00:00.000Z",
    eventCount: 42,
    metadata: {
      taskId: "r-test.1",
      title: "Fix authentication bug",
    },
  },
  {
    id: "def67890",
    createdAt: "2026-01-22T15:30:00.000Z",
    eventCount: 128,
    metadata: {
      taskId: "r-test.2",
      title: "Add new feature",
    },
  },
  {
    id: "ghi11111",
    createdAt: "2026-01-21T09:00:00.000Z",
    eventCount: 15,
    // No metadata - represents an session with no task
  },
]

describe("SessionHistoryPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset store state
    useAppStore.setState({ issuePrefix: "r" })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("loading state", () => {
    it("shows loading indicator when loading", () => {
      mockUseSessions.mockReturnValue(
        createMockUseSessions({
          isLoading: true,
        }),
      )

      render(<SessionHistoryPanel />)

      expect(screen.getByText("Loading sessions...")).toBeInTheDocument()
      expect(screen.getByText("Session History")).toBeInTheDocument()
    })
  })

  describe("error state", () => {
    it("shows error message when error occurs", () => {
      const mockRefresh = vi.fn()
      mockUseSessions.mockReturnValue(
        createMockUseSessions({
          error: "Failed to connect to server",
          refresh: mockRefresh,
        }),
      )

      render(<SessionHistoryPanel />)

      expect(screen.getByText("Failed to connect to server")).toBeInTheDocument()
      expect(screen.getByText("Retry")).toBeInTheDocument()
    })

    it("calls refresh when retry is clicked", () => {
      const mockRefresh = vi.fn()
      mockUseSessions.mockReturnValue(
        createMockUseSessions({
          error: "Network error",
          refresh: mockRefresh,
        }),
      )

      render(<SessionHistoryPanel />)

      fireEvent.click(screen.getByText("Retry"))
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  describe("empty state", () => {
    it("shows empty message when no event logs exist", () => {
      mockUseSessions.mockReturnValue(createMockUseSessions())

      render(<SessionHistoryPanel />)

      expect(screen.getByText(/No session history yet/)).toBeInTheDocument()
      expect(screen.getByText(/Completed sessions will appear here/)).toBeInTheDocument()
    })
  })

  describe("list rendering", () => {
    it("renders list of event logs", () => {
      mockUseSessions.mockReturnValue(
        createMockUseSessions({
          sessions: mockSessions,
        }),
      )

      render(<SessionHistoryPanel />)

      // Should show count in header
      expect(screen.getByText("(3)")).toBeInTheDocument()

      // Should render all items
      expect(screen.getByText("Fix authentication bug")).toBeInTheDocument()
      expect(screen.getByText("Add new feature")).toBeInTheDocument()
    })

    it("displays task IDs with prefix stripped", () => {
      mockUseSessions.mockReturnValue(
        createMockUseSessions({
          sessions: mockSessions,
        }),
      )

      render(<SessionHistoryPanel />)

      // Should display stripped task IDs
      expect(screen.getByText("test.1")).toBeInTheDocument()
      expect(screen.getByText("test.2")).toBeInTheDocument()
    })

    it("displays event counts", () => {
      mockUseSessions.mockReturnValue(
        createMockUseSessions({
          sessions: mockSessions,
        }),
      )

      render(<SessionHistoryPanel />)

      expect(screen.getByText("42 events")).toBeInTheDocument()
      expect(screen.getByText("128 events")).toBeInTheDocument()
      expect(screen.getByText("15 events")).toBeInTheDocument()
    })

    it("displays 'No task' for sessions without metadata", () => {
      mockUseSessions.mockReturnValue(
        createMockUseSessions({
          sessions: mockSessions,
        }),
      )

      render(<SessionHistoryPanel />)

      // The third item has no metadata
      expect(screen.getByText("No task")).toBeInTheDocument()
    })
  })

  describe("navigation", () => {
    it("navigates to event log when item is clicked", () => {
      mockUseSessions.mockReturnValue(
        createMockUseSessions({
          sessions: mockSessions,
        }),
      )

      render(<SessionHistoryPanel />)

      // Click on the first item
      fireEvent.click(screen.getByText("Fix authentication bug"))

      expect(mockLoadSessionEvents).toHaveBeenCalledWith("abc12345")
    })

    it("has accessible button labels", () => {
      mockUseSessions.mockReturnValue(
        createMockUseSessions({
          sessions: mockSessions,
        }),
      )

      render(<SessionHistoryPanel />)

      // Each item should have an accessible label
      const buttons = screen.getAllByRole("button")
      expect(buttons.length).toBe(3)
      expect(buttons[0]).toHaveAttribute("aria-label", expect.stringContaining("View session"))
    })
  })

  describe("accessibility", () => {
    it("has proper list structure", () => {
      mockUseSessions.mockReturnValue(
        createMockUseSessions({
          sessions: mockSessions,
        }),
      )

      render(<SessionHistoryPanel />)

      const list = screen.getByRole("list", { name: "Session history" })
      expect(list).toBeInTheDocument()
    })
  })

  describe("search functionality", () => {
    it("shows search input when event logs exist", () => {
      mockUseSessions.mockReturnValue(
        createMockUseSessions({
          sessions: mockSessions,
        }),
      )

      render(<SessionHistoryPanel />)

      expect(screen.getByLabelText("Search sessions")).toBeInTheDocument()
      expect(screen.getByPlaceholderText("Search by task ID or title...")).toBeInTheDocument()
    })

    it("does not show search input when no event logs", () => {
      mockUseSessions.mockReturnValue(createMockUseSessions())

      render(<SessionHistoryPanel />)

      expect(screen.queryByLabelText("Search sessions")).not.toBeInTheDocument()
    })

    it("filters by task title", () => {
      mockUseSessions.mockReturnValue(
        createMockUseSessions({
          sessions: mockSessions,
        }),
      )

      render(<SessionHistoryPanel />)

      const searchInput = screen.getByLabelText("Search sessions")
      fireEvent.change(searchInput, { target: { value: "authentication" } })

      // Should show only matching result
      expect(screen.getByText("Fix authentication bug")).toBeInTheDocument()
      expect(screen.queryByText("Add new feature")).not.toBeInTheDocument()
      expect(screen.queryByText("No task")).not.toBeInTheDocument()
    })

    it("filters by task ID", () => {
      mockUseSessions.mockReturnValue(
        createMockUseSessions({
          sessions: mockSessions,
        }),
      )

      render(<SessionHistoryPanel />)

      const searchInput = screen.getByLabelText("Search sessions")
      fireEvent.change(searchInput, { target: { value: "test.2" } })

      // Should show only matching result
      expect(screen.getByText("Add new feature")).toBeInTheDocument()
      expect(screen.queryByText("Fix authentication bug")).not.toBeInTheDocument()
    })

    it("shows no results message when filter matches nothing", () => {
      mockUseSessions.mockReturnValue(
        createMockUseSessions({
          sessions: mockSessions,
        }),
      )

      render(<SessionHistoryPanel />)

      const searchInput = screen.getByLabelText("Search sessions")
      fireEvent.change(searchInput, { target: { value: "nonexistent" } })

      expect(screen.getByText("No matching sessions found.")).toBeInTheDocument()
    })

    it("clears search when clear button is clicked", () => {
      mockUseSessions.mockReturnValue(
        createMockUseSessions({
          sessions: mockSessions,
        }),
      )

      render(<SessionHistoryPanel />)

      const searchInput = screen.getByLabelText("Search sessions")
      fireEvent.change(searchInput, { target: { value: "authentication" } })

      // Only one result visible
      expect(screen.queryByText("Add new feature")).not.toBeInTheDocument()

      // Click clear button
      fireEvent.click(screen.getByLabelText("Clear search"))

      // All results visible again
      expect(screen.getByText("Fix authentication bug")).toBeInTheDocument()
      expect(screen.getByText("Add new feature")).toBeInTheDocument()
    })

    it("is case-insensitive", () => {
      mockUseSessions.mockReturnValue(
        createMockUseSessions({
          sessions: mockSessions,
        }),
      )

      render(<SessionHistoryPanel />)

      const searchInput = screen.getByLabelText("Search sessions")
      fireEvent.change(searchInput, { target: { value: "AUTHENTICATION" } })

      // Should still find the result
      expect(screen.getByText("Fix authentication bug")).toBeInTheDocument()
    })
  })

  describe("date grouping", () => {
    it("groups sessions by date", () => {
      // Create logs with different dates relative to "today"
      const today = new Date()
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
      const twoDaysAgo = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000)

      const logsWithDates: SessionSummary[] = [
        {
          id: "today1",
          createdAt: today.toISOString(),
          eventCount: 10,
          metadata: { taskId: "r-1", title: "Today task" },
        },
        {
          id: "yesterday1",
          createdAt: yesterday.toISOString(),
          eventCount: 20,
          metadata: { taskId: "r-2", title: "Yesterday task" },
        },
        {
          id: "older1",
          createdAt: twoDaysAgo.toISOString(),
          eventCount: 30,
          metadata: { taskId: "r-3", title: "Older task" },
        },
      ]

      mockUseSessions.mockReturnValue(
        createMockUseSessions({
          sessions: logsWithDates,
        }),
      )

      render(<SessionHistoryPanel />)

      // Should show date group headers
      expect(screen.getByText("Today")).toBeInTheDocument()
      expect(screen.getByText("Yesterday")).toBeInTheDocument()
      // Older dates show full date format - just verify the task is there
      expect(screen.getByText("Older task")).toBeInTheDocument()
    })

    it("groups multiple sessions under the same date", () => {
      const today = new Date()

      const logsWithSameDate: SessionSummary[] = [
        {
          id: "today1",
          createdAt: new Date(today.getTime() - 1000).toISOString(),
          eventCount: 10,
          metadata: { taskId: "r-1", title: "First today task" },
        },
        {
          id: "today2",
          createdAt: new Date(today.getTime() - 2000).toISOString(),
          eventCount: 20,
          metadata: { taskId: "r-2", title: "Second today task" },
        },
      ]

      mockUseSessions.mockReturnValue(
        createMockUseSessions({
          sessions: logsWithSameDate,
        }),
      )

      render(<SessionHistoryPanel />)

      // Should have one "Today" header with both tasks under it
      const todayHeaders = screen.getAllByText("Today")
      expect(todayHeaders.length).toBe(1)

      expect(screen.getByText("First today task")).toBeInTheDocument()
      expect(screen.getByText("Second today task")).toBeInTheDocument()
    })
  })
})
