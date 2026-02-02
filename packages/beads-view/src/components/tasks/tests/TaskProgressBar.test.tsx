import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { TaskProgressBar } from ".././TaskProgressBar"
import type { TaskCardTask, ClosedTasksTimeFilter } from "../../../types"

function createTask(overrides: Partial<TaskCardTask> = {}): TaskCardTask {
  return {
    id: `task-${Math.random().toString(36).slice(2)}`,
    title: "Test task",
    status: "open",
    ...overrides,
  }
}

/** Render TaskProgressBar with the given config via props. */
function renderProgressBar(config: {
  tasks: TaskCardTask[]
  initialTaskCount: number | null
  accentColor?: string | null
  closedTimeFilter?: ClosedTasksTimeFilter
  isRunning?: boolean
  className?: string
}) {
  return render(
    <TaskProgressBar
      isRunning={config.isRunning ?? true}
      tasks={config.tasks}
      initialTaskCount={config.initialTaskCount}
      accentColor={config.accentColor ?? null}
      closedTimeFilter={config.closedTimeFilter ?? "all_time"}
      className={config.className}
    />,
  )
}

describe("TaskProgressBar", () => {
  describe("visibility", () => {
    it("does not render when the host marks it as not running", () => {
      const { container } = renderProgressBar({
        tasks: [createTask({ status: "closed" })],
        initialTaskCount: 1,
        isRunning: false,
      })
      expect(container.firstChild).toBeNull()
    })

    it("does not render when initialTaskCount is null", () => {
      const { container } = renderProgressBar({
        tasks: [createTask()],
        initialTaskCount: null,
      })
      expect(container.firstChild).toBeNull()
    })

    it("does not render when there are no tasks", () => {
      const { container } = renderProgressBar({
        tasks: [],
        initialTaskCount: 0,
      })
      expect(container.firstChild).toBeNull()
    })

    it("renders when the host marks it as running and has tasks", () => {
      renderProgressBar({
        tasks: [createTask()],
        initialTaskCount: 1,
      })
      expect(screen.getByTestId("task-progress-bar")).toBeInTheDocument()
    })
  })

  describe("progress calculation", () => {
    it("shows 0 closed when no tasks are closed", () => {
      renderProgressBar({
        tasks: [createTask({ status: "open" }), createTask({ status: "in_progress" })],
        initialTaskCount: 2,
      })
      expect(screen.getByText("0/2")).toBeInTheDocument()
    })

    it("shows correct count when some tasks are closed", () => {
      renderProgressBar({
        tasks: [
          createTask({ status: "closed" }),
          createTask({ status: "open" }),
          createTask({ status: "closed" }),
        ],
        initialTaskCount: 3,
      })
      expect(screen.getByText("2/3")).toBeInTheDocument()
    })

    it("shows correct count when all tasks are closed", () => {
      renderProgressBar({
        tasks: [createTask({ status: "closed" }), createTask({ status: "closed" })],
        initialTaskCount: 2,
      })
      expect(screen.getByText("2/2")).toBeInTheDocument()
    })

    it("uses visible task count (excludes epics)", () => {
      renderProgressBar({
        tasks: [
          createTask({ status: "closed" }),
          createTask({ status: "open" }),
          createTask({ status: "open", issue_type: "epic" }),
        ],
        initialTaskCount: 3,
      })
      expect(screen.getByText("1/2")).toBeInTheDocument()
    })

    it("filters closed tasks based on time filter", () => {
      const now = new Date()
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString()
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString()

      renderProgressBar({
        tasks: [
          createTask({ status: "closed", closed_at: twoHoursAgo }),
          createTask({ status: "closed", closed_at: thirtyMinutesAgo }),
          createTask({ status: "open" }),
        ],
        initialTaskCount: 3,
        closedTimeFilter: "past_hour",
      })
      expect(screen.getByText("1/2")).toBeInTheDocument()
    })

    it("shows all closed tasks when filter is all_time", () => {
      const now = new Date()
      const weekAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString()
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString()

      renderProgressBar({
        tasks: [
          createTask({ status: "closed", closed_at: weekAgo }),
          createTask({ status: "closed", closed_at: thirtyMinutesAgo }),
          createTask({ status: "open" }),
        ],
        initialTaskCount: 3,
        closedTimeFilter: "all_time",
      })
      expect(screen.getByText("2/3")).toBeInTheDocument()
    })
  })

  describe("accessibility", () => {
    it("has progressbar role", () => {
      renderProgressBar({
        tasks: [createTask({ status: "closed" }), createTask({ status: "open" })],
        initialTaskCount: 2,
      })
      expect(screen.getByRole("progressbar")).toBeInTheDocument()
    })

    it("has correct aria attributes", () => {
      renderProgressBar({
        tasks: [createTask({ status: "closed" }), createTask({ status: "open" })],
        initialTaskCount: 2,
      })
      const progressbar = screen.getByRole("progressbar")
      expect(progressbar).toHaveAttribute("aria-valuenow", "1")
      expect(progressbar).toHaveAttribute("aria-valuemin", "0")
      expect(progressbar).toHaveAttribute("aria-valuemax", "2")
      expect(progressbar).toHaveAttribute("aria-label", "Task completion progress")
    })
  })

  describe("styling", () => {
    it("applies custom className", () => {
      renderProgressBar({
        tasks: [createTask()],
        initialTaskCount: 1,
        className: "custom-class",
      })
      expect(screen.getByTestId("task-progress-bar")).toHaveClass("custom-class")
    })

    it("has border-t class for top border", () => {
      renderProgressBar({
        tasks: [createTask()],
        initialTaskCount: 1,
      })
      expect(screen.getByTestId("task-progress-bar")).toHaveClass("border-t")
    })

    it("uses accent color for progress bar fill when set", () => {
      renderProgressBar({
        tasks: [createTask({ status: "closed" })],
        initialTaskCount: 1,
        accentColor: "#ff0000",
      })
      const progressBar = screen.getByTestId("task-progress-bar")
      const fillElement = progressBar.querySelector(".h-full")
      expect(fillElement).toHaveStyle({ backgroundColor: "#ff0000" })
    })

    it("uses default accent color when peacock color is not set", () => {
      renderProgressBar({
        tasks: [createTask({ status: "closed" })],
        initialTaskCount: 1,
        accentColor: null,
      })
      const progressBar = screen.getByTestId("task-progress-bar")
      const fillElement = progressBar.querySelector(".h-full")
      expect(fillElement).toHaveStyle({ backgroundColor: "#374151" })
    })
  })
})
