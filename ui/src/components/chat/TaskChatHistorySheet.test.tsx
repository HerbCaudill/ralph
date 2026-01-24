import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { TaskChatHistorySheet } from "./TaskChatHistorySheet"
import { useAppStore } from "@/store"
import type { TaskChatSessionMetadata } from "@/lib/persistence"

// Mock the useTaskChatSessions hook
vi.mock("@/hooks/useTaskChatSessions", () => ({
  useTaskChatSessions: vi.fn(),
}))

// Import the mocked module so we can control it
import { useTaskChatSessions } from "@/hooks/useTaskChatSessions"
const mockUseTaskChatSessions = vi.mocked(useTaskChatSessions)

// Test data
const mockSessions: TaskChatSessionMetadata[] = [
  {
    id: "session-abc123",
    taskId: "r-test.1",
    taskTitle: "Fix authentication bug",
    instanceId: "default",
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 1800000,
    messageCount: 5,
    eventCount: 12,
    lastEventSequence: 11,
  },
  {
    id: "session-def456",
    taskId: "r-test.2",
    taskTitle: "Add new feature",
    instanceId: "default",
    createdAt: Date.now() - 86400000 - 3600000,
    updatedAt: Date.now() - 86400000,
    messageCount: 10,
    eventCount: 25,
    lastEventSequence: 24,
  },
]

describe("TaskChatHistorySheet", () => {
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

    render(<TaskChatHistorySheet />)

    const button = screen.getByRole("button", { name: "View chat history" })
    expect(button).toBeInTheDocument()
  })

  it("opens sheet when trigger button is clicked", async () => {
    mockUseTaskChatSessions.mockReturnValue({
      sessions: mockSessions,
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    render(<TaskChatHistorySheet />)

    // Sheet should not be open initially
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    // Click the trigger button
    fireEvent.click(screen.getByRole("button", { name: "View chat history" }))

    // Sheet should now be open
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    })

    // Should show the history panel content (multiple elements have this text, so use getAllByText)
    expect(screen.getAllByText("Chat History").length).toBeGreaterThan(0)
  })

  it("shows sessions in the sheet", async () => {
    mockUseTaskChatSessions.mockReturnValue({
      sessions: mockSessions,
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    render(<TaskChatHistorySheet />)

    // Open the sheet
    fireEvent.click(screen.getByRole("button", { name: "View chat history" }))

    // Should show sessions
    await waitFor(() => {
      expect(screen.getByText("Fix authentication bug")).toBeInTheDocument()
      expect(screen.getByText("Add new feature")).toBeInTheDocument()
    })
  })

  it("calls onSelectSession and closes sheet when session is selected", async () => {
    const mockOnSelectSession = vi.fn()
    mockUseTaskChatSessions.mockReturnValue({
      sessions: mockSessions,
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    render(<TaskChatHistorySheet onSelectSession={mockOnSelectSession} />)

    // Open the sheet
    fireEvent.click(screen.getByRole("button", { name: "View chat history" }))

    // Wait for sheet to be open
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    })

    // Click on a session
    fireEvent.click(screen.getByText("Fix authentication bug"))

    // Should call the callback with the session ID
    expect(mockOnSelectSession).toHaveBeenCalledWith("session-abc123")

    // Sheet should close
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
  })

  it("applies custom className to trigger button", () => {
    mockUseTaskChatSessions.mockReturnValue({
      sessions: [],
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    render(<TaskChatHistorySheet className="custom-class" />)

    const button = screen.getByRole("button", { name: "View chat history" })
    expect(button).toHaveClass("custom-class")
  })

  it("has screen reader accessible title", async () => {
    mockUseTaskChatSessions.mockReturnValue({
      sessions: mockSessions,
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    render(<TaskChatHistorySheet />)

    // Open the sheet
    fireEvent.click(screen.getByRole("button", { name: "View chat history" }))

    // Should have sr-only title for accessibility
    await waitFor(() => {
      // The SheetTitle has sr-only class, so it won't be visible but will be in the DOM
      const title = screen.getByText("Chat History", { selector: "h2" })
      expect(title).toHaveClass("sr-only")
    })
  })
})
