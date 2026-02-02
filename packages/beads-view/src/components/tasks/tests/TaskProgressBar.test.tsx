import { render, screen } from "@testing-library/react"
import { describe, it, expect, beforeEach, vi } from "vitest"
import { TaskProgressBar } from ".././TaskProgressBar"
import { useBeadsViewStore } from "@herbcaudill/beads-view"
import type { Task, ClosedTasksTimeFilter } from "../../../types"

vi.mock("@herbcaudill/beads-view", async () => {
  const actual =
    await vi.importActual<typeof import("@herbcaudill/beads-view")>("@herbcaudill/beads-view")
  return {
    ...actual,
    useBeadsViewStore: vi.fn(),
  }
})

const mockUseBeadsViewStore = vi.mocked(useBeadsViewStore)

function setupMock(config: {
  tasks: Task[]
  initialTaskCount: number | null
  accentColor?: string | null
  closedTimeFilter?: ClosedTasksTimeFilter
}) {
  mockUseBeadsViewStore.mockImplementation(selector => {
    const beadsState = {
      tasks: config.tasks,
      initialTaskCount: config.initialTaskCount,
      accentColor: config.accentColor ?? null,
      closedTimeFilter: config.closedTimeFilter ?? "all_time",
    }
    return selector(beadsState as any)
  })
}

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: `task-${Math.random().toString(36).slice(2)}`,
    title: "Test task",
    status: "open",
    ...overrides,
  }
}

describe("TaskProgressBar", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("visibility", () => {
    it("does not render when the host marks it as not running", () => {
      setupMock({
        tasks: [createTask({ status: "closed" })],
        initialTaskCount: 1,
      })

      const { container } = render(<TaskProgressBar isRunning={false} />)
      expect(container.firstChild).toBeNull()
    })

    it("does not render when initialTaskCount is null", () => {
      setupMock({
        tasks: [createTask()],
        initialTaskCount: null,
      })

      const { container } = render(<TaskProgressBar isRunning={true} />)
      expect(container.firstChild).toBeNull()
    })

    it("does not render when there are no tasks", () => {
      setupMock({
        tasks: [],
        initialTaskCount: 0,
      })

      const { container } = render(<TaskProgressBar isRunning={true} />)
      expect(container.firstChild).toBeNull()
    })

    it("renders when the host marks it as running and has tasks", () => {
      setupMock({
        tasks: [createTask()],
        initialTaskCount: 1,
      })

      render(<TaskProgressBar isRunning={true} />)
      expect(screen.getByTestId("task-progress-bar")).toBeInTheDocument()
    })
  })

  describe("progress calculation", () => {
    it("shows 0 closed when no tasks are closed", () => {
      setupMock({
        tasks: [createTask({ status: "open" }), createTask({ status: "in_progress" })],
        initialTaskCount: 2,
      })

      render(<TaskProgressBar isRunning={true} />)
      expect(screen.getByText("0/2")).toBeInTheDocument()
    })

    it("shows correct count when some tasks are closed", () => {
      setupMock({
        tasks: [
          createTask({ status: "closed" }),
          createTask({ status: "open" }),
          createTask({ status: "closed" }),
        ],
        initialTaskCount: 3,
      })

      render(<TaskProgressBar isRunning={true} />)
      expect(screen.getByText("2/3")).toBeInTheDocument()
    })

    it("shows correct count when all tasks are closed", () => {
      setupMock({
        tasks: [createTask({ status: "closed" }), createTask({ status: "closed" })],
        initialTaskCount: 2,
      })

      render(<TaskProgressBar isRunning={true} />)
      expect(screen.getByText("2/2")).toBeInTheDocument()
    })

    it("uses visible task count (excludes epics)", () => {
      setupMock({
        tasks: [
          createTask({ status: "closed" }),
          createTask({ status: "open" }),
          createTask({ status: "open", issue_type: "epic" }), // Epic should be excluded
        ],
        initialTaskCount: 3,
      })

      render(<TaskProgressBar isRunning={true} />)
      // Total should be 2 (excluding epic), not 3
      expect(screen.getByText("1/2")).toBeInTheDocument()
    })

    it("filters closed tasks based on time filter", () => {
      const now = new Date()
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString()
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString()

      setupMock({
        tasks: [
          createTask({ status: "closed", closed_at: twoHoursAgo }), // Closed 2 hours ago
          createTask({ status: "closed", closed_at: thirtyMinutesAgo }), // Closed 30 mins ago
          createTask({ status: "open" }),
        ],
        initialTaskCount: 3,
        closedTimeFilter: "past_hour", // Only show tasks closed in past hour
      })

      render(<TaskProgressBar isRunning={true} />)
      // Total should be 2 (1 recent closed + 1 open), closed count should be 1
      expect(screen.getByText("1/2")).toBeInTheDocument()
    })

    it("shows all closed tasks when filter is all_time", () => {
      const now = new Date()
      const weekAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString()
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString()

      setupMock({
        tasks: [
          createTask({ status: "closed", closed_at: weekAgo }), // Closed over a week ago
          createTask({ status: "closed", closed_at: thirtyMinutesAgo }), // Closed 30 mins ago
          createTask({ status: "open" }),
        ],
        initialTaskCount: 3,
        closedTimeFilter: "all_time",
      })

      render(<TaskProgressBar isRunning={true} />)
      // All tasks should be visible
      expect(screen.getByText("2/3")).toBeInTheDocument()
    })
  })

  describe("accessibility", () => {
    it("has progressbar role", () => {
      setupMock({
        tasks: [createTask({ status: "closed" }), createTask({ status: "open" })],
        initialTaskCount: 2,
      })

      render(<TaskProgressBar isRunning={true} />)
      expect(screen.getByRole("progressbar")).toBeInTheDocument()
    })

    it("has correct aria attributes", () => {
      setupMock({
        tasks: [createTask({ status: "closed" }), createTask({ status: "open" })],
        initialTaskCount: 2,
      })

      render(<TaskProgressBar isRunning={true} />)
      const progressbar = screen.getByRole("progressbar")
      expect(progressbar).toHaveAttribute("aria-valuenow", "1")
      expect(progressbar).toHaveAttribute("aria-valuemin", "0")
      expect(progressbar).toHaveAttribute("aria-valuemax", "2")
      expect(progressbar).toHaveAttribute("aria-label", "Task completion progress")
    })
  })

  describe("styling", () => {
    it("applies custom className", () => {
      setupMock({
        tasks: [createTask()],
        initialTaskCount: 1,
      })

      render(<TaskProgressBar className="custom-class" isRunning={true} />)
      expect(screen.getByTestId("task-progress-bar")).toHaveClass("custom-class")
    })

    it("has border-t class for top border", () => {
      setupMock({
        tasks: [createTask()],
        initialTaskCount: 1,
      })

      render(<TaskProgressBar isRunning={true} />)
      expect(screen.getByTestId("task-progress-bar")).toHaveClass("border-t")
    })

    it("uses accent color for progress bar fill when set", () => {
      setupMock({
        tasks: [createTask({ status: "closed" })],
        initialTaskCount: 1,
        accentColor: "#ff0000",
      })

      render(<TaskProgressBar isRunning={true} />)
      const progressBar = screen.getByTestId("task-progress-bar")
      const fillElement = progressBar.querySelector(".h-full")
      expect(fillElement).toHaveStyle({ backgroundColor: "#ff0000" })
    })

    it("uses default accent color when peacock color is not set", () => {
      setupMock({
        tasks: [createTask({ status: "closed" })],
        initialTaskCount: 1,
        accentColor: null,
      })

      render(<TaskProgressBar isRunning={true} />)
      const progressBar = screen.getByTestId("task-progress-bar")
      const fillElement = progressBar.querySelector(".h-full")
      expect(fillElement).toHaveStyle({ backgroundColor: "#374151" })
    })
  })
})
