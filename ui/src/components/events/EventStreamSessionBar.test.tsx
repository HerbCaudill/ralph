import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { EventStreamSessionBar } from "./EventStreamSessionBar"
import type { SessionSummary } from "@/hooks"

// Mock the SessionHistoryDropdown component to simplify testing
vi.mock("./SessionHistoryDropdown", () => ({
  SessionHistoryDropdown: ({
    currentTask,
    isRunning,
  }: {
    currentTask: { id: string | null; title: string } | null
    isRunning: boolean
  }) => (
    <div data-testid="session-history-dropdown">
      {currentTask ?
        <>
          {currentTask.id && <span data-testid="dropdown-task-id">{currentTask.id}</span>}
          <span data-testid="dropdown-task-title">{currentTask.title}</span>
        </>
      : <span data-testid="dropdown-placeholder">
          {isRunning ? "Choosing a task..." : "No active task"}
        </span>
      }
    </div>
  ),
}))

// Helper to create mock session
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

describe("EventStreamSessionBar", () => {
  const defaultProps = {
    currentTask: null,
    sessions: [] as SessionSummary[],
    isLoadingSessions: false,
    issuePrefix: null,
    isRunning: false,
    onSessionHistorySelect: vi.fn(),
  }

  describe("showDropdown condition", () => {
    it("shows dropdown when there are sessions (hasSessions=true)", () => {
      render(
        <EventStreamSessionBar
          {...defaultProps}
          sessions={[createMockSession("abc123", new Date().toISOString(), "task-1", "Test task")]}
          isLoadingSessions={false}
          isRunning={false}
        />,
      )

      expect(screen.getByTestId("session-history-dropdown")).toBeInTheDocument()
      // The "No active task" text inside the dropdown placeholder is expected
      // when currentTask is null, but the key is that the dropdown is shown, not the static text
    })

    it("shows dropdown when loading (isLoadingSessions=true)", () => {
      render(
        <EventStreamSessionBar
          {...defaultProps}
          sessions={[]}
          isLoadingSessions={true}
          isRunning={false}
        />,
      )

      expect(screen.getByTestId("session-history-dropdown")).toBeInTheDocument()
    })

    it("shows dropdown when Ralph is running (isRunning=true, even with no sessions)", () => {
      render(
        <EventStreamSessionBar
          {...defaultProps}
          sessions={[]}
          isLoadingSessions={false}
          isRunning={true}
        />,
      )

      expect(screen.getByTestId("session-history-dropdown")).toBeInTheDocument()
    })

    it("shows task info (not dropdown) when stopped with no sessions and currentTask exists", () => {
      render(
        <EventStreamSessionBar
          {...defaultProps}
          currentTask={{ id: "task-123", title: "My important task" }}
          sessions={[]}
          isLoadingSessions={false}
          isRunning={false}
        />,
      )

      // Should not show the dropdown
      expect(screen.queryByTestId("session-history-dropdown")).not.toBeInTheDocument()

      // Should show the task info directly
      expect(screen.getByText("task-123")).toBeInTheDocument()
      expect(screen.getByText("My important task")).toBeInTheDocument()
    })

    it("shows 'No active task' when stopped with no sessions and no currentTask", () => {
      render(
        <EventStreamSessionBar
          {...defaultProps}
          currentTask={null}
          sessions={[]}
          isLoadingSessions={false}
          isRunning={false}
        />,
      )

      // Should not show the dropdown
      expect(screen.queryByTestId("session-history-dropdown")).not.toBeInTheDocument()

      // Should show "No active task" text
      expect(screen.getByText("No active task")).toBeInTheDocument()
    })
  })

  describe("task info display (when dropdown not shown)", () => {
    it("shows task ID as a link when ID is provided", () => {
      render(
        <EventStreamSessionBar
          {...defaultProps}
          currentTask={{ id: "r-abc1", title: "Fix the bug" }}
          sessions={[]}
          isLoadingSessions={false}
          isRunning={false}
        />,
      )

      const link = screen.getByRole("link", { name: "View task r-abc1" })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute("href", "/issue/r-abc1")
    })

    it("shows task title without ID link when ID is null", () => {
      render(
        <EventStreamSessionBar
          {...defaultProps}
          currentTask={{ id: null, title: "Ad-hoc task" }}
          sessions={[]}
          isLoadingSessions={false}
          isRunning={false}
        />,
      )

      expect(screen.getByText("Ad-hoc task")).toBeInTheDocument()
      expect(screen.queryByRole("link")).not.toBeInTheDocument()
    })

    it("shows 'Choosing a task...' when running with no current task (but dropdown shown)", () => {
      // When isRunning=true, dropdown is shown, so we check that dropdown gets correct props
      render(
        <EventStreamSessionBar
          {...defaultProps}
          currentTask={null}
          sessions={[]}
          isLoadingSessions={false}
          isRunning={true}
        />,
      )

      // Dropdown is shown and should display "Choosing a task..."
      expect(screen.getByTestId("session-history-dropdown")).toBeInTheDocument()
      expect(screen.getByTestId("dropdown-placeholder")).toHaveTextContent("Choosing a task...")
    })
  })

  describe("edge cases", () => {
    it("prioritizes dropdown over task info when sessions exist", () => {
      // Even with a currentTask, if there are sessions, dropdown should be shown
      render(
        <EventStreamSessionBar
          {...defaultProps}
          currentTask={{ id: "task-1", title: "Current task" }}
          sessions={[
            createMockSession("abc123", new Date().toISOString(), "task-1", "Current task"),
          ]}
          isLoadingSessions={false}
          isRunning={false}
        />,
      )

      expect(screen.getByTestId("session-history-dropdown")).toBeInTheDocument()
    })

    it("shows dropdown when all conditions are true", () => {
      render(
        <EventStreamSessionBar
          {...defaultProps}
          currentTask={{ id: "task-1", title: "Active task" }}
          sessions={[createMockSession("abc123", new Date().toISOString())]}
          isLoadingSessions={true}
          isRunning={true}
        />,
      )

      expect(screen.getByTestId("session-history-dropdown")).toBeInTheDocument()
    })
  })

  describe("data-testid", () => {
    it("renders session bar with correct testid", () => {
      render(<EventStreamSessionBar {...defaultProps} />)

      expect(screen.getByTestId("session-bar")).toBeInTheDocument()
    })
  })
})
