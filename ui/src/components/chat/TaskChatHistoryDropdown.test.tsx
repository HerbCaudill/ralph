import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { TaskChatHistoryDropdown } from "./TaskChatHistoryDropdown"
import { useAppStore } from "@/store"
import type { TaskChatSessionMetadata } from "@/lib/persistence"

// Mock the useTaskChatSessions hook
vi.mock("@/hooks/useTaskChatSessions", () => ({
  useTaskChatSessions: vi.fn(),
}))

// Import the mocked module so we can control it
import { useTaskChatSessions } from "@/hooks/useTaskChatSessions"
const mockUseTaskChatSessions = vi.mocked(useTaskChatSessions)

// Helper to create mock sessions with timestamps guaranteed to fall into "Today" and "Yesterday" buckets.
// Uses noon of each day to avoid midnight boundary issues.
function createMockSessions(): TaskChatSessionMetadata[] {
  const now = new Date()
  // Get the start of today at midnight, then add 12 hours (noon) to be safely within "today"
  const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0).getTime()
  // Get noon of yesterday
  const yesterdayNoon = todayNoon - 24 * 60 * 60 * 1000
  return [
    {
      id: "session-abc123",
      taskId: "r-test.1",
      taskTitle: "Fix authentication bug",
      instanceId: "default",
      createdAt: todayNoon - 3600000,
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
      createdAt: yesterdayNoon - 3600000,
      updatedAt: yesterdayNoon, // noon yesterday -> "Yesterday"
      messageCount: 10,
      eventCount: 25,
      lastEventSequence: 24,
    },
  ]
}

describe("TaskChatHistoryDropdown", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset store state
    useAppStore.setState({ activeInstanceId: "default", issuePrefix: "r" })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders trigger button with history icon", () => {
    mockUseTaskChatSessions.mockReturnValue({
      sessions: [],
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    render(<TaskChatHistoryDropdown />)

    const button = screen.getByRole("button", { name: "View chat history" })
    expect(button).toBeInTheDocument()
  })

  it("opens dropdown when trigger button is clicked", async () => {
    mockUseTaskChatSessions.mockReturnValue({
      sessions: createMockSessions(),
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    render(<TaskChatHistoryDropdown />)

    // Click the trigger button
    fireEvent.click(screen.getByRole("button", { name: "View chat history" }))

    // Dropdown should now be open - look for the search input
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search chat sessions...")).toBeInTheDocument()
    })
  })

  it("shows sessions in the dropdown", async () => {
    mockUseTaskChatSessions.mockReturnValue({
      sessions: createMockSessions(),
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    render(<TaskChatHistoryDropdown />)

    // Open the dropdown
    fireEvent.click(screen.getByRole("button", { name: "View chat history" }))

    // Should show sessions
    await waitFor(() => {
      expect(screen.getByText("Fix authentication bug")).toBeInTheDocument()
      expect(screen.getByText("Add new feature")).toBeInTheDocument()
    })
  })

  it("calls onSelectSession and closes dropdown when session is selected", async () => {
    const mockOnSelectSession = vi.fn()
    mockUseTaskChatSessions.mockReturnValue({
      sessions: createMockSessions(),
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    render(<TaskChatHistoryDropdown onSelectSession={mockOnSelectSession} />)

    // Open the dropdown
    fireEvent.click(screen.getByRole("button", { name: "View chat history" }))

    // Wait for dropdown to be open
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search chat sessions...")).toBeInTheDocument()
    })

    // Click on a session
    fireEvent.click(screen.getByText("Fix authentication bug"))

    // Should call the callback with the session ID
    expect(mockOnSelectSession).toHaveBeenCalledWith("session-abc123")

    // Dropdown should close
    await waitFor(() => {
      expect(screen.queryByPlaceholderText("Search chat sessions...")).not.toBeInTheDocument()
    })
  })

  it("applies custom className to trigger button", () => {
    mockUseTaskChatSessions.mockReturnValue({
      sessions: [],
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    render(<TaskChatHistoryDropdown className="custom-class" />)

    const button = screen.getByRole("button", { name: "View chat history" })
    expect(button).toHaveClass("custom-class")
  })

  it("shows loading state in dropdown", async () => {
    mockUseTaskChatSessions.mockReturnValue({
      sessions: [],
      isLoading: true,
      error: null,
      refresh: vi.fn(),
    })

    render(<TaskChatHistoryDropdown />)

    // Open the dropdown
    fireEvent.click(screen.getByRole("button", { name: "View chat history" }))

    // Should show loading message
    await waitFor(() => {
      expect(screen.getByText("Loading...")).toBeInTheDocument()
    })
  })

  it("shows error state in dropdown", async () => {
    mockUseTaskChatSessions.mockReturnValue({
      sessions: [],
      isLoading: false,
      error: "Failed to load sessions",
      refresh: vi.fn(),
    })

    render(<TaskChatHistoryDropdown />)

    // Open the dropdown
    fireEvent.click(screen.getByRole("button", { name: "View chat history" }))

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText("Failed to load sessions")).toBeInTheDocument()
    })
  })

  it("groups sessions by date", async () => {
    mockUseTaskChatSessions.mockReturnValue({
      sessions: createMockSessions(),
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    render(<TaskChatHistoryDropdown />)

    // Open the dropdown
    fireEvent.click(screen.getByRole("button", { name: "View chat history" }))

    // Should show date group headings
    await waitFor(() => {
      expect(screen.getByText("Today")).toBeInTheDocument()
      expect(screen.getByText("Yesterday")).toBeInTheDocument()
    })
  })
})
