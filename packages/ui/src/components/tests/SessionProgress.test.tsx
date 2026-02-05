import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { SessionProgress } from "../SessionProgress"
import type { TaskCardTask } from "@herbcaudill/beads-view"

function createTask(overrides: Partial<TaskCardTask> = {}): TaskCardTask {
  return {
    id: `task-${Math.random().toString(36).slice(2)}`,
    title: "Test task",
    status: "open",
    ...overrides,
  }
}

describe("SessionProgress", () => {
  describe("visibility", () => {
    it("renders when there are tasks", () => {
      render(<SessionProgress tasks={[createTask()]} />)
      expect(screen.getByTestId("session-progress")).toBeInTheDocument()
    })

    it("does not render when there are no tasks", () => {
      const { container } = render(<SessionProgress tasks={[]} />)
      expect(container.firstChild).toBeNull()
    })
  })

  describe("progress calculation", () => {
    it("shows 0 closed when no tasks are closed", () => {
      render(
        <SessionProgress
          tasks={[createTask({ status: "open" }), createTask({ status: "in_progress" })]}
        />,
      )
      expect(screen.getByText("0/2")).toBeInTheDocument()
    })

    it("shows correct count when some tasks are closed", () => {
      render(
        <SessionProgress
          tasks={[
            createTask({ status: "closed" }),
            createTask({ status: "open" }),
            createTask({ status: "closed" }),
          ]}
        />,
      )
      expect(screen.getByText("2/3")).toBeInTheDocument()
    })

    it("shows correct count when all tasks are closed", () => {
      render(
        <SessionProgress
          tasks={[createTask({ status: "closed" }), createTask({ status: "closed" })]}
        />,
      )
      expect(screen.getByText("2/2")).toBeInTheDocument()
    })

    it("excludes epics from count", () => {
      render(
        <SessionProgress
          tasks={[
            createTask({ status: "closed" }),
            createTask({ status: "open" }),
            createTask({ status: "open", issue_type: "epic" }),
          ]}
        />,
      )
      expect(screen.getByText("1/2")).toBeInTheDocument()
    })
  })

  describe("styling", () => {
    it("applies custom className", () => {
      render(<SessionProgress tasks={[createTask()]} className="custom-class" />)
      expect(screen.getByTestId("session-progress")).toHaveClass("custom-class")
    })

    it("uses accent color for progress bar fill when set", () => {
      render(<SessionProgress tasks={[createTask({ status: "closed" })]} accentColor="#ff0000" />)
      const progressBar = screen.getByTestId("session-progress")
      const fillElement = progressBar.querySelector(".h-full")
      expect(fillElement).toHaveStyle({ backgroundColor: "#ff0000" })
    })

    it("uses default accent color when not set", () => {
      render(<SessionProgress tasks={[createTask({ status: "closed" })]} />)
      const progressBar = screen.getByTestId("session-progress")
      const fillElement = progressBar.querySelector(".h-full")
      // Default gray color
      expect(fillElement).toHaveStyle({ backgroundColor: "#374151" })
    })
  })

  describe("accessibility", () => {
    it("has title showing progress", () => {
      render(
        <SessionProgress
          tasks={[createTask({ status: "closed" }), createTask({ status: "open" })]}
        />,
      )
      const container = screen.getByTestId("session-progress")
      expect(container).toHaveAttribute("title", "Session 1 of 2")
    })
  })
})
