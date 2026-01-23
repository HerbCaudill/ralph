import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { IterationHistoryPanel } from "./IterationHistoryPanel"
import { useAppStore } from "@/store"
import type { EventLogSummary } from "@/hooks"

// Mock the hooks
const mockNavigateToEventLog = vi.fn()

vi.mock("@/hooks", async importOriginal => {
  const original = await importOriginal<typeof import("@/hooks")>()
  return {
    ...original,
    useEventLogRouter: () => ({
      navigateToEventLog: mockNavigateToEventLog,
      closeEventLogViewer: vi.fn(),
      eventLogId: null,
    }),
    useEventLogs: vi.fn(),
  }
})

// Import the mocked module so we can control it
import { useEventLogs } from "@/hooks"
const mockUseEventLogs = vi.mocked(useEventLogs)

// Test data
const mockEventLogs: EventLogSummary[] = [
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
    // No metadata - represents an iteration with no task
  },
]

describe("IterationHistoryPanel", () => {
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
      mockUseEventLogs.mockReturnValue({
        eventLogs: [],
        isLoading: true,
        error: null,
        refresh: vi.fn(),
      })

      render(<IterationHistoryPanel />)

      expect(screen.getByText("Loading iterations...")).toBeInTheDocument()
      expect(screen.getByText("Iteration History")).toBeInTheDocument()
    })
  })

  describe("error state", () => {
    it("shows error message when error occurs", () => {
      const mockRefresh = vi.fn()
      mockUseEventLogs.mockReturnValue({
        eventLogs: [],
        isLoading: false,
        error: "Failed to connect to server",
        refresh: mockRefresh,
      })

      render(<IterationHistoryPanel />)

      expect(screen.getByText("Failed to connect to server")).toBeInTheDocument()
      expect(screen.getByText("Retry")).toBeInTheDocument()
    })

    it("calls refresh when retry is clicked", () => {
      const mockRefresh = vi.fn()
      mockUseEventLogs.mockReturnValue({
        eventLogs: [],
        isLoading: false,
        error: "Network error",
        refresh: mockRefresh,
      })

      render(<IterationHistoryPanel />)

      fireEvent.click(screen.getByText("Retry"))
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  describe("empty state", () => {
    it("shows empty message when no event logs exist", () => {
      mockUseEventLogs.mockReturnValue({
        eventLogs: [],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      })

      render(<IterationHistoryPanel />)

      expect(screen.getByText(/No iteration history yet/)).toBeInTheDocument()
      expect(screen.getByText(/Completed iterations will appear here/)).toBeInTheDocument()
    })
  })

  describe("list rendering", () => {
    it("renders list of event logs", () => {
      mockUseEventLogs.mockReturnValue({
        eventLogs: mockEventLogs,
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      })

      render(<IterationHistoryPanel />)

      // Should show count in header
      expect(screen.getByText("(3)")).toBeInTheDocument()

      // Should render all items
      expect(screen.getByText("Fix authentication bug")).toBeInTheDocument()
      expect(screen.getByText("Add new feature")).toBeInTheDocument()
    })

    it("displays task IDs with prefix stripped", () => {
      mockUseEventLogs.mockReturnValue({
        eventLogs: mockEventLogs,
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      })

      render(<IterationHistoryPanel />)

      // Should display stripped task IDs
      expect(screen.getByText("test.1")).toBeInTheDocument()
      expect(screen.getByText("test.2")).toBeInTheDocument()
    })

    it("displays event counts", () => {
      mockUseEventLogs.mockReturnValue({
        eventLogs: mockEventLogs,
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      })

      render(<IterationHistoryPanel />)

      expect(screen.getByText("42 events")).toBeInTheDocument()
      expect(screen.getByText("128 events")).toBeInTheDocument()
      expect(screen.getByText("15 events")).toBeInTheDocument()
    })

    it("displays 'No task' for iterations without metadata", () => {
      mockUseEventLogs.mockReturnValue({
        eventLogs: mockEventLogs,
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      })

      render(<IterationHistoryPanel />)

      // The third item has no metadata
      expect(screen.getByText("No task")).toBeInTheDocument()
    })
  })

  describe("navigation", () => {
    it("navigates to event log when item is clicked", () => {
      mockUseEventLogs.mockReturnValue({
        eventLogs: mockEventLogs,
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      })

      render(<IterationHistoryPanel />)

      // Click on the first item
      fireEvent.click(screen.getByText("Fix authentication bug"))

      expect(mockNavigateToEventLog).toHaveBeenCalledWith("abc12345")
    })

    it("has accessible button labels", () => {
      mockUseEventLogs.mockReturnValue({
        eventLogs: mockEventLogs,
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      })

      render(<IterationHistoryPanel />)

      // Each item should have an accessible label
      const buttons = screen.getAllByRole("button")
      expect(buttons.length).toBe(3)
      expect(buttons[0]).toHaveAttribute("aria-label", expect.stringContaining("View iteration"))
    })
  })

  describe("accessibility", () => {
    it("has proper list structure", () => {
      mockUseEventLogs.mockReturnValue({
        eventLogs: mockEventLogs,
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      })

      render(<IterationHistoryPanel />)

      const list = screen.getByRole("list", { name: "Iteration history" })
      expect(list).toBeInTheDocument()
    })
  })
})
