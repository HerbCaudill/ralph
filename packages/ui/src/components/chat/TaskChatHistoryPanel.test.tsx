import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { TaskChatHistoryPanel } from "./TaskChatHistoryPanel"
import { useAppStore } from "@/store"
import type { TaskChatSessionMetadata } from "@/lib/persistence"

// Mock the useTaskChatSessions hook
vi.mock("@/hooks/useTaskChatSessions", () => ({
  useTaskChatSessions: vi.fn(),
}))

// Import the mocked module so we can control it
import { useTaskChatSessions } from "@/hooks/useTaskChatSessions"
const mockUseTaskChatSessions = vi.mocked(useTaskChatSessions)

// Helper to create mock sessions with timestamps guaranteed to fall into "Today", "Yesterday", and "Older" buckets.
// Uses noon of each day to avoid midnight boundary issues.
function createMockSessions(): TaskChatSessionMetadata[] {
  const now = new Date()
  // Get the start of today at midnight, then add 12 hours (noon) to be safely within "today"
  const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0).getTime()
  // Get noon of yesterday and 2 days ago
  const yesterdayNoon = todayNoon - 24 * 60 * 60 * 1000
  const twoDaysAgoNoon = todayNoon - 48 * 60 * 60 * 1000
  return [
    {
      id: "session-abc123",
      taskId: "r-test.1",
      taskTitle: "Fix authentication bug",
      instanceId: "default",
      workspaceId: null,
      createdAt: todayNoon - 3600000, // Today noon minus 1 hour
      updatedAt: todayNoon, // noon today -> "Today"
      messageCount: 5,
      eventCount: 12,
      lastEventSequence: 11,
    },
    {
      id: "session-def456",
      taskId: "r-test.2",
      taskTitle: "Add new feature",
      instanceId: "default",
      workspaceId: null,
      createdAt: yesterdayNoon - 3600000,
      updatedAt: yesterdayNoon, // noon yesterday -> "Yesterday"
      messageCount: 10,
      eventCount: 25,
      lastEventSequence: 24,
    },
    {
      id: "session-ghi789",
      taskId: "untitled",
      taskTitle: null,
      instanceId: "default",
      workspaceId: null,
      createdAt: twoDaysAgoNoon - 3600000,
      updatedAt: twoDaysAgoNoon, // 2 days ago -> "Older" (full date format)
      messageCount: 3,
      eventCount: 8,
      lastEventSequence: 7,
    },
  ]
}

describe("TaskChatHistoryPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset store state
    useAppStore.setState({ activeInstanceId: "default", issuePrefix: "r" })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("loading state", () => {
    it("shows loading indicator when loading", () => {
      mockUseTaskChatSessions.mockReturnValue({
        sessions: [],
        isLoading: true,
        error: null,
        refresh: vi.fn(),
      })

      render(<TaskChatHistoryPanel />)

      expect(screen.getByText("Loading chat sessions...")).toBeInTheDocument()
      expect(screen.getByText("Chat History")).toBeInTheDocument()
    })
  })

  describe("error state", () => {
    it("shows error message when error occurs", () => {
      const mockRefresh = vi.fn()
      mockUseTaskChatSessions.mockReturnValue({
        sessions: [],
        isLoading: false,
        error: "Failed to load from IndexedDB",
        refresh: mockRefresh,
      })

      render(<TaskChatHistoryPanel />)

      expect(screen.getByText("Failed to load from IndexedDB")).toBeInTheDocument()
      expect(screen.getByText("Retry")).toBeInTheDocument()
    })

    it("calls refresh when retry is clicked", () => {
      const mockRefresh = vi.fn()
      mockUseTaskChatSessions.mockReturnValue({
        sessions: [],
        isLoading: false,
        error: "Database error",
        refresh: mockRefresh,
      })

      render(<TaskChatHistoryPanel />)

      fireEvent.click(screen.getByText("Retry"))
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  describe("empty state", () => {
    it("shows empty message when no sessions exist", () => {
      mockUseTaskChatSessions.mockReturnValue({
        sessions: [],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      })

      render(<TaskChatHistoryPanel />)

      expect(screen.getByText(/No chat history yet/)).toBeInTheDocument()
      expect(screen.getByText(/Chat sessions will appear here/)).toBeInTheDocument()
    })
  })

  describe("list rendering", () => {
    it("renders list of sessions", () => {
      mockUseTaskChatSessions.mockReturnValue({
        sessions: createMockSessions(),
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      })

      render(<TaskChatHistoryPanel />)

      // Should show count in header
      expect(screen.getByText("(3)")).toBeInTheDocument()

      // Should render all items
      expect(screen.getByText("Fix authentication bug")).toBeInTheDocument()
      expect(screen.getByText("Add new feature")).toBeInTheDocument()
    })

    it("displays task IDs with prefix stripped", () => {
      mockUseTaskChatSessions.mockReturnValue({
        sessions: createMockSessions(),
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      })

      render(<TaskChatHistoryPanel />)

      // Should display stripped task IDs
      expect(screen.getByText("test.1")).toBeInTheDocument()
      expect(screen.getByText("test.2")).toBeInTheDocument()
    })

    it("displays message counts", () => {
      mockUseTaskChatSessions.mockReturnValue({
        sessions: createMockSessions(),
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      })

      render(<TaskChatHistoryPanel />)

      expect(screen.getByText("5 messages")).toBeInTheDocument()
      expect(screen.getByText("10 messages")).toBeInTheDocument()
      expect(screen.getByText("3 messages")).toBeInTheDocument()
    })

    it("displays 'General chat' for sessions without task", () => {
      mockUseTaskChatSessions.mockReturnValue({
        sessions: createMockSessions(),
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      })

      render(<TaskChatHistoryPanel />)

      // The third item has taskId "untitled" and no title
      expect(screen.getByText("General chat")).toBeInTheDocument()
    })
  })

  describe("navigation", () => {
    it("calls onSelectSession when item is clicked", () => {
      const mockOnSelectSession = vi.fn()
      mockUseTaskChatSessions.mockReturnValue({
        sessions: createMockSessions(),
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      })

      render(<TaskChatHistoryPanel onSelectSession={mockOnSelectSession} />)

      // Click on the first item
      fireEvent.click(screen.getByText("Fix authentication bug"))

      expect(mockOnSelectSession).toHaveBeenCalledWith("session-abc123")
    })

    it("has accessible button labels", () => {
      mockUseTaskChatSessions.mockReturnValue({
        sessions: createMockSessions(),
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      })

      render(<TaskChatHistoryPanel />)

      // Each item should have an accessible label
      const buttons = screen.getAllByRole("button")
      expect(buttons.length).toBe(3)
      expect(buttons[0]).toHaveAttribute("aria-label", expect.stringContaining("View chat session"))
    })
  })

  describe("accessibility", () => {
    it("has proper list structure", () => {
      mockUseTaskChatSessions.mockReturnValue({
        sessions: createMockSessions(),
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      })

      render(<TaskChatHistoryPanel />)

      const list = screen.getByRole("list", { name: "Chat session history" })
      expect(list).toBeInTheDocument()
    })
  })

  describe("search functionality", () => {
    it("shows search input when sessions exist", () => {
      mockUseTaskChatSessions.mockReturnValue({
        sessions: createMockSessions(),
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      })

      render(<TaskChatHistoryPanel />)

      expect(screen.getByLabelText("Search chat sessions")).toBeInTheDocument()
      expect(screen.getByPlaceholderText("Search by task ID or title...")).toBeInTheDocument()
    })

    it("does not show search input when no sessions", () => {
      mockUseTaskChatSessions.mockReturnValue({
        sessions: [],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      })

      render(<TaskChatHistoryPanel />)

      expect(screen.queryByLabelText("Search chat sessions")).not.toBeInTheDocument()
    })

    it("filters by task title", () => {
      mockUseTaskChatSessions.mockReturnValue({
        sessions: createMockSessions(),
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      })

      render(<TaskChatHistoryPanel />)

      const searchInput = screen.getByLabelText("Search chat sessions")
      fireEvent.change(searchInput, { target: { value: "authentication" } })

      // Should show only matching result
      expect(screen.getByText("Fix authentication bug")).toBeInTheDocument()
      expect(screen.queryByText("Add new feature")).not.toBeInTheDocument()
      expect(screen.queryByText("General chat")).not.toBeInTheDocument()
    })

    it("filters by task ID", () => {
      mockUseTaskChatSessions.mockReturnValue({
        sessions: createMockSessions(),
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      })

      render(<TaskChatHistoryPanel />)

      const searchInput = screen.getByLabelText("Search chat sessions")
      fireEvent.change(searchInput, { target: { value: "test.2" } })

      // Should show only matching result
      expect(screen.getByText("Add new feature")).toBeInTheDocument()
      expect(screen.queryByText("Fix authentication bug")).not.toBeInTheDocument()
    })

    it("shows no results message when filter matches nothing", () => {
      mockUseTaskChatSessions.mockReturnValue({
        sessions: createMockSessions(),
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      })

      render(<TaskChatHistoryPanel />)

      const searchInput = screen.getByLabelText("Search chat sessions")
      fireEvent.change(searchInput, { target: { value: "nonexistent" } })

      expect(screen.getByText("No matching chat sessions found.")).toBeInTheDocument()
    })

    it("clears search when clear button is clicked", () => {
      mockUseTaskChatSessions.mockReturnValue({
        sessions: createMockSessions(),
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      })

      render(<TaskChatHistoryPanel />)

      const searchInput = screen.getByLabelText("Search chat sessions")
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
      mockUseTaskChatSessions.mockReturnValue({
        sessions: createMockSessions(),
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      })

      render(<TaskChatHistoryPanel />)

      const searchInput = screen.getByLabelText("Search chat sessions")
      fireEvent.change(searchInput, { target: { value: "AUTHENTICATION" } })

      // Should still find the result
      expect(screen.getByText("Fix authentication bug")).toBeInTheDocument()
    })
  })

  describe("date grouping", () => {
    it("groups sessions by date", () => {
      mockUseTaskChatSessions.mockReturnValue({
        sessions: createMockSessions(),
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      })

      render(<TaskChatHistoryPanel />)

      // Should show date group headers
      expect(screen.getByText("Today")).toBeInTheDocument()
      expect(screen.getByText("Yesterday")).toBeInTheDocument()
      // Older dates show full date format - just verify the task is there
      expect(screen.getByText("General chat")).toBeInTheDocument()
    })

    it("groups multiple sessions under the same date", () => {
      // Use noon of today to avoid midnight boundary issues
      const now = new Date()
      const todayNoon = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        12,
        0,
        0,
      ).getTime()
      const sessionsWithSameDate: TaskChatSessionMetadata[] = [
        {
          id: "session-1",
          taskId: "r-1",
          taskTitle: "First task",
          instanceId: "default",
          workspaceId: null,
          createdAt: todayNoon - 1000,
          updatedAt: todayNoon - 1000,
          messageCount: 2,
          eventCount: 5,
          lastEventSequence: 4,
        },
        {
          id: "session-2",
          taskId: "r-2",
          taskTitle: "Second task",
          instanceId: "default",
          workspaceId: null,
          createdAt: todayNoon - 2000,
          updatedAt: todayNoon - 2000,
          messageCount: 3,
          eventCount: 7,
          lastEventSequence: 6,
        },
      ]

      mockUseTaskChatSessions.mockReturnValue({
        sessions: sessionsWithSameDate,
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      })

      render(<TaskChatHistoryPanel />)

      // Should have one "Today" header with both tasks under it
      const todayHeaders = screen.getAllByText("Today")
      expect(todayHeaders.length).toBe(1)

      expect(screen.getByText("First task")).toBeInTheDocument()
      expect(screen.getByText("Second task")).toBeInTheDocument()
    })
  })
})
