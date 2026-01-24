import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { IterationHistoryDropdown } from "./IterationHistoryDropdown"
import type { EventLogSummary } from "@/hooks"

// Mock event logs for testing
const createMockEventLog = (
  id: string,
  createdAt: string,
  taskId?: string,
  title?: string,
): EventLogSummary => ({
  id,
  createdAt,
  eventCount: 10,
  metadata: taskId || title ? { taskId, title } : undefined,
})

// Helper to get a date string for "today"
const today = new Date()
const todayStr = today.toISOString()

// Helper to get a date string for "yesterday"
const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
const yesterdayStr = yesterday.toISOString()

// Helper to get a date string for a week ago
const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
const weekAgoStr = weekAgo.toISOString()

describe("IterationHistoryDropdown", () => {
  const defaultProps = {
    currentTask: null,
    iterationCount: 1,
    displayedIteration: 1,
    isViewingLatest: true,
    viewingIterationIndex: null,
    eventLogs: [] as EventLogSummary[],
    isLoadingEventLogs: false,
    issuePrefix: null,
    onIterationSelect: vi.fn(),
    onEventLogSelect: vi.fn(),
    onLatest: vi.fn(),
  }

  describe("trigger display", () => {
    it("shows iteration info when no task and single iteration", () => {
      render(<IterationHistoryDropdown {...defaultProps} />)
      expect(screen.getByText("Iteration 1 of 1")).toBeInTheDocument()
    })

    it("shows task title when currentTask is provided", () => {
      render(
        <IterationHistoryDropdown
          {...defaultProps}
          currentTask={{ id: "r-abc1", title: "Fix the bug" }}
        />,
      )
      expect(screen.getByText("Fix the bug")).toBeInTheDocument()
      expect(screen.getByText("r-abc1")).toBeInTheDocument()
    })

    it("shows task title without ID when ID is null", () => {
      render(
        <IterationHistoryDropdown
          {...defaultProps}
          currentTask={{ id: null, title: "Ad-hoc task" }}
        />,
      )
      expect(screen.getByText("Ad-hoc task")).toBeInTheDocument()
      expect(screen.queryByText("null")).not.toBeInTheDocument()
    })

    it("shows iteration info when no task but multiple iterations", () => {
      render(
        <IterationHistoryDropdown
          {...defaultProps}
          currentTask={null}
          iterationCount={3}
          displayedIteration={2}
        />,
      )
      expect(screen.getByText("Iteration 2 of 3")).toBeInTheDocument()
    })

    it("strips issue prefix from task ID", () => {
      render(
        <IterationHistoryDropdown
          {...defaultProps}
          currentTask={{ id: "ralph-123", title: "Test task" }}
          issuePrefix="ralph"
        />,
      )
      expect(screen.getByText("123")).toBeInTheDocument()
      expect(screen.queryByText("ralph-123")).not.toBeInTheDocument()
    })
  })

  describe("dropdown content", () => {
    it("opens dropdown when trigger is clicked", () => {
      render(
        <IterationHistoryDropdown
          {...defaultProps}
          eventLogs={[createMockEventLog("abc12345", todayStr, "r-xyz", "Past task")]}
        />,
      )

      fireEvent.click(screen.getByTestId("iteration-history-dropdown-trigger"))
      expect(screen.getByPlaceholderText("Search iterations...")).toBeInTheDocument()
    })

    it("shows loading state when event logs are loading", () => {
      render(<IterationHistoryDropdown {...defaultProps} isLoadingEventLogs={true} />)

      fireEvent.click(screen.getByTestId("iteration-history-dropdown-trigger"))
      expect(screen.getByText("Loading history...")).toBeInTheDocument()
    })

    it("shows empty state when no event logs and single iteration", () => {
      render(<IterationHistoryDropdown {...defaultProps} eventLogs={[]} iterationCount={1} />)

      fireEvent.click(screen.getByTestId("iteration-history-dropdown-trigger"))
      expect(screen.getByText("No iteration history yet.")).toBeInTheDocument()
    })

    it("shows current session iterations when multiple exist", () => {
      render(
        <IterationHistoryDropdown
          {...defaultProps}
          iterationCount={3}
          displayedIteration={3}
          isViewingLatest={true}
        />,
      )

      fireEvent.click(screen.getByTestId("iteration-history-dropdown-trigger"))
      expect(screen.getByText("Current Session")).toBeInTheDocument()
      expect(screen.getByText("Iteration 1")).toBeInTheDocument()
      expect(screen.getByText("Iteration 2")).toBeInTheDocument()
      expect(screen.getByText("Iteration 3")).toBeInTheDocument()
      expect(screen.getByText("Latest")).toBeInTheDocument()
    })

    it("groups event logs by date", () => {
      render(
        <IterationHistoryDropdown
          {...defaultProps}
          eventLogs={[
            createMockEventLog("abc12345", todayStr, "r-001", "Today's task"),
            createMockEventLog("def12345", yesterdayStr, "r-002", "Yesterday's task"),
            createMockEventLog("ghi12345", weekAgoStr, "r-003", "Old task"),
          ]}
        />,
      )

      fireEvent.click(screen.getByTestId("iteration-history-dropdown-trigger"))
      expect(screen.getByText("Today")).toBeInTheDocument()
      expect(screen.getByText("Yesterday")).toBeInTheDocument()
      // The week-ago date will show as a formatted date string
    })

    it("shows event log task info", () => {
      render(
        <IterationHistoryDropdown
          {...defaultProps}
          eventLogs={[createMockEventLog("abc12345", todayStr, "r-task1", "Historical task")]}
        />,
      )

      fireEvent.click(screen.getByTestId("iteration-history-dropdown-trigger"))
      expect(screen.getByText("r-task1")).toBeInTheDocument()
      expect(screen.getByText("Historical task")).toBeInTheDocument()
    })
  })

  describe("interactions", () => {
    it("calls onIterationSelect when clicking a current session iteration", () => {
      const onIterationSelect = vi.fn()
      render(
        <IterationHistoryDropdown
          {...defaultProps}
          iterationCount={3}
          onIterationSelect={onIterationSelect}
        />,
      )

      fireEvent.click(screen.getByTestId("iteration-history-dropdown-trigger"))
      fireEvent.click(screen.getByText("Iteration 1"))

      expect(onIterationSelect).toHaveBeenCalledWith(0)
    })

    it("calls onLatest when clicking the latest iteration", () => {
      const onLatest = vi.fn()
      render(
        <IterationHistoryDropdown
          {...defaultProps}
          iterationCount={3}
          viewingIterationIndex={0}
          isViewingLatest={false}
          onLatest={onLatest}
        />,
      )

      fireEvent.click(screen.getByTestId("iteration-history-dropdown-trigger"))
      fireEvent.click(screen.getByText("Iteration 3"))

      expect(onLatest).toHaveBeenCalled()
    })

    it("calls onEventLogSelect when clicking an event log", () => {
      const onEventLogSelect = vi.fn()
      render(
        <IterationHistoryDropdown
          {...defaultProps}
          eventLogs={[createMockEventLog("abc12345", todayStr, "r-task1", "Historical task")]}
          onEventLogSelect={onEventLogSelect}
        />,
      )

      fireEvent.click(screen.getByTestId("iteration-history-dropdown-trigger"))
      fireEvent.click(screen.getByText("Historical task"))

      expect(onEventLogSelect).toHaveBeenCalledWith("abc12345")
    })

    it("closes dropdown after selection", () => {
      render(
        <IterationHistoryDropdown
          {...defaultProps}
          eventLogs={[createMockEventLog("abc12345", todayStr, "r-task1", "Historical task")]}
        />,
      )

      fireEvent.click(screen.getByTestId("iteration-history-dropdown-trigger"))
      expect(screen.getByPlaceholderText("Search iterations...")).toBeInTheDocument()

      fireEvent.click(screen.getByText("Historical task"))

      // Dropdown should be closed
      expect(screen.queryByPlaceholderText("Search iterations...")).not.toBeInTheDocument()
    })
  })

  describe("search functionality", () => {
    it("search input is available for filtering", () => {
      render(
        <IterationHistoryDropdown
          {...defaultProps}
          eventLogs={[
            createMockEventLog("abc12345", todayStr, "r-task1", "First task"),
            createMockEventLog("def12345", todayStr, "r-task2", "Second task"),
          ]}
        />,
      )

      fireEvent.click(screen.getByTestId("iteration-history-dropdown-trigger"))
      const searchInput = screen.getByPlaceholderText("Search iterations...")

      // Verify search input is available
      expect(searchInput).toBeInTheDocument()

      // Verify both items are initially visible
      expect(screen.getByText("First task")).toBeInTheDocument()
      expect(screen.getByText("Second task")).toBeInTheDocument()

      // cmdk handles filtering internally - we verify items with matching values exist
      fireEvent.change(searchInput, { target: { value: "task1" } })

      // First task should still be visible (matches value)
      expect(screen.getByText("First task")).toBeInTheDocument()
    })

    it("filters event logs by title", () => {
      render(
        <IterationHistoryDropdown
          {...defaultProps}
          eventLogs={[
            createMockEventLog("abc12345", todayStr, "r-001", "Bug fix"),
            createMockEventLog("def12345", todayStr, "r-002", "New feature"),
          ]}
        />,
      )

      fireEvent.click(screen.getByTestId("iteration-history-dropdown-trigger"))
      const searchInput = screen.getByPlaceholderText("Search iterations...")

      // Both items initially visible
      expect(screen.getByText("New feature")).toBeInTheDocument()
      expect(screen.getByText("Bug fix")).toBeInTheDocument()

      // Search for "feature" - cmdk handles the filtering
      fireEvent.change(searchInput, { target: { value: "feature" } })

      // Item matching search should be visible
      expect(screen.getByText("New feature")).toBeInTheDocument()
    })
  })

  describe("accessibility", () => {
    it("has accessible trigger button", () => {
      render(<IterationHistoryDropdown {...defaultProps} />)
      const trigger = screen.getByTestId("iteration-history-dropdown-trigger")
      expect(trigger).toHaveAttribute("aria-label", "View iteration history")
    })
  })
})
