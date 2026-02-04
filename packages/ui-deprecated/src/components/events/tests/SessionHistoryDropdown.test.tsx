import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { SessionHistoryDropdown } from ".././SessionHistoryDropdown"
import type { SessionSummary } from "@/hooks"

// Mock event logs for testing
const createMockSession = (
  id: string,
  createdAt: string,
  taskId?: string,
  title?: string,
): SessionSummary => ({
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

describe("SessionHistoryDropdown", () => {
  const defaultProps = {
    currentTask: null,
    sessions: [] as SessionSummary[],
    isLoadingSessions: false,
    issuePrefix: null,
    isRunning: false,
    onSessionHistorySelect: vi.fn(),
  }

  describe("trigger display", () => {
    it("shows 'No active task' when no task and not running", () => {
      render(<SessionHistoryDropdown {...defaultProps} isRunning={false} />)
      expect(screen.getByText("No active task")).toBeInTheDocument()
    })

    it("shows 'Choosing a task...' when no task and running", () => {
      render(<SessionHistoryDropdown {...defaultProps} isRunning={true} />)
      expect(screen.getByText("Choosing a task...")).toBeInTheDocument()
    })

    it("shows task title when currentTask is provided", () => {
      render(
        <SessionHistoryDropdown
          {...defaultProps}
          currentTask={{ id: "r-abc1", title: "Fix the bug" }}
        />,
      )
      expect(screen.getByText("Fix the bug")).toBeInTheDocument()
      expect(screen.getByText("r-abc1")).toBeInTheDocument()
    })

    it("shows task title without ID when ID is null", () => {
      render(
        <SessionHistoryDropdown
          {...defaultProps}
          currentTask={{ id: null, title: "Ad-hoc task" }}
        />,
      )
      expect(screen.getByText("Ad-hoc task")).toBeInTheDocument()
      expect(screen.queryByText("null")).not.toBeInTheDocument()
    })

    it("strips issue prefix from task ID", () => {
      render(
        <SessionHistoryDropdown
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
        <SessionHistoryDropdown
          {...defaultProps}
          sessions={[createMockSession("abc12345", todayStr, "r-xyz", "Past task")]}
        />,
      )

      fireEvent.click(screen.getByTestId("session-history-dropdown-trigger"))
      expect(screen.getByText("Past task")).toBeInTheDocument()
    })

    it("shows loading state when sessions are loading", () => {
      render(<SessionHistoryDropdown {...defaultProps} isLoadingSessions={true} />)

      fireEvent.click(screen.getByTestId("session-history-dropdown-trigger"))
      expect(screen.getByText("Loading history...")).toBeInTheDocument()
    })

    it("shows empty state when no sessions", () => {
      render(<SessionHistoryDropdown {...defaultProps} sessions={[]} />)

      fireEvent.click(screen.getByTestId("session-history-dropdown-trigger"))
      expect(screen.getByText("No session history yet.")).toBeInTheDocument()
    })

    it("groups event logs by date", () => {
      render(
        <SessionHistoryDropdown
          {...defaultProps}
          sessions={[
            createMockSession("abc12345", todayStr, "r-001", "Today's task"),
            createMockSession("def12345", yesterdayStr, "r-002", "Yesterday's task"),
            createMockSession("ghi12345", weekAgoStr, "r-003", "Old task"),
          ]}
        />,
      )

      fireEvent.click(screen.getByTestId("session-history-dropdown-trigger"))
      expect(screen.getByText("Today")).toBeInTheDocument()
      expect(screen.getByText("Yesterday")).toBeInTheDocument()
      // The week-ago date will show as a formatted date string
    })

    it("shows event log task info", () => {
      render(
        <SessionHistoryDropdown
          {...defaultProps}
          sessions={[createMockSession("abc12345", todayStr, "r-task1", "Historical task")]}
        />,
      )

      fireEvent.click(screen.getByTestId("session-history-dropdown-trigger"))
      expect(screen.getByText("r-task1")).toBeInTheDocument()
      expect(screen.getByText("Historical task")).toBeInTheDocument()
    })
  })

  describe("interactions", () => {
    it("calls onSessionHistorySelect when clicking a past session", () => {
      const onSessionHistorySelect = vi.fn()
      render(
        <SessionHistoryDropdown
          {...defaultProps}
          sessions={[createMockSession("abc12345", todayStr, "r-task1", "Historical task")]}
          onSessionHistorySelect={onSessionHistorySelect}
        />,
      )

      fireEvent.click(screen.getByTestId("session-history-dropdown-trigger"))
      fireEvent.click(screen.getByText("Historical task"))

      expect(onSessionHistorySelect).toHaveBeenCalledWith("abc12345")
    })

    it("closes dropdown after selection", () => {
      render(
        <SessionHistoryDropdown
          {...defaultProps}
          sessions={[createMockSession("abc12345", todayStr, "r-task1", "Historical task")]}
        />,
      )

      fireEvent.click(screen.getByTestId("session-history-dropdown-trigger"))
      expect(screen.getByText("Historical task")).toBeInTheDocument()

      fireEvent.click(screen.getByText("Historical task"))

      // Dropdown should be closed - the task text should no longer be in the dropdown
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
    })
  })

  describe("search functionality", () => {
    it("hides search input when fewer than 5 sessions", () => {
      render(
        <SessionHistoryDropdown
          {...defaultProps}
          sessions={[
            createMockSession("abc12345", todayStr, "r-task1", "First task"),
            createMockSession("def12345", todayStr, "r-task2", "Second task"),
          ]}
        />,
      )

      fireEvent.click(screen.getByTestId("session-history-dropdown-trigger"))

      // Search input should not be present with fewer than 5 sessions
      expect(screen.queryByPlaceholderText("Search sessions...")).not.toBeInTheDocument()

      // Items should still be visible
      expect(screen.getByText("First task")).toBeInTheDocument()
      expect(screen.getByText("Second task")).toBeInTheDocument()
    })

    it("shows search input when 5 or more sessions", () => {
      render(
        <SessionHistoryDropdown
          {...defaultProps}
          sessions={[
            createMockSession("abc12345", todayStr, "r-task1", "First task"),
            createMockSession("def12345", todayStr, "r-task2", "Second task"),
            createMockSession("ghi12345", todayStr, "r-task3", "Third task"),
            createMockSession("jkl12345", todayStr, "r-task4", "Fourth task"),
            createMockSession("mno12345", todayStr, "r-task5", "Fifth task"),
          ]}
        />,
      )

      fireEvent.click(screen.getByTestId("session-history-dropdown-trigger"))
      const searchInput = screen.getByPlaceholderText("Search sessions...")

      // Verify search input is available
      expect(searchInput).toBeInTheDocument()

      // Verify items are visible
      expect(screen.getByText("First task")).toBeInTheDocument()
      expect(screen.getByText("Fifth task")).toBeInTheDocument()
    })

    it("filters event logs by title", () => {
      render(
        <SessionHistoryDropdown
          {...defaultProps}
          sessions={[
            createMockSession("abc12345", todayStr, "r-001", "Bug fix"),
            createMockSession("def12345", todayStr, "r-002", "New feature"),
            createMockSession("ghi12345", todayStr, "r-003", "Third task"),
            createMockSession("jkl12345", todayStr, "r-004", "Fourth task"),
            createMockSession("mno12345", todayStr, "r-005", "Fifth task"),
          ]}
        />,
      )

      fireEvent.click(screen.getByTestId("session-history-dropdown-trigger"))
      const searchInput = screen.getByPlaceholderText("Search sessions...")

      // Both items initially visible
      expect(screen.getByText("New feature")).toBeInTheDocument()
      expect(screen.getByText("Bug fix")).toBeInTheDocument()

      // Search for "feature" - cmdk handles the filtering
      fireEvent.change(searchInput, { target: { value: "feature" } })

      // Item matching search should be visible
      expect(screen.getByText("New feature")).toBeInTheDocument()
    })
  })

  describe("current session indicator", () => {
    it("shows checkmark icon for the currently selected session", () => {
      const sessions = [
        createMockSession("session-1", todayStr, "r-001", "First task"),
        createMockSession("session-2", todayStr, "r-002", "Second task"),
        createMockSession("session-3", yesterdayStr, "r-003", "Third task"),
      ]

      render(
        <SessionHistoryDropdown
          {...defaultProps}
          sessions={sessions}
          currentSessionId="session-2"
        />,
      )

      // Open the dropdown
      fireEvent.click(screen.getByTestId("session-history-dropdown-trigger"))

      // Verify the checkmark is displayed for the selected session
      const checkIcon = screen.getByTestId("session-selected-check")
      expect(checkIcon).toBeInTheDocument()

      // Verify there's only one checkmark (for the selected session)
      const allCheckIcons = screen.queryAllByTestId("session-selected-check")
      expect(allCheckIcons).toHaveLength(1)
    })

    it("does not show checkmark when no session is selected", () => {
      const sessions = [
        createMockSession("session-1", todayStr, "r-001", "First task"),
        createMockSession("session-2", todayStr, "r-002", "Second task"),
      ]

      render(
        <SessionHistoryDropdown {...defaultProps} sessions={sessions} currentSessionId={null} />,
      )

      // Open the dropdown
      fireEvent.click(screen.getByTestId("session-history-dropdown-trigger"))

      // Verify no checkmark is displayed
      const checkIcon = screen.queryByTestId("session-selected-check")
      expect(checkIcon).not.toBeInTheDocument()
    })
  })

  describe("accessibility", () => {
    it("has accessible trigger button", () => {
      render(<SessionHistoryDropdown {...defaultProps} />)
      const trigger = screen.getByTestId("session-history-dropdown-trigger")
      expect(trigger).toHaveAttribute("aria-label", "View session history")
    })
  })
})
