import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { TaskPanel } from "../TaskPanel"
import type { TaskCardTask } from "../../../types"

const sampleTasks: TaskCardTask[] = [
  { id: "rui-1", title: "Implement authentication", status: "in_progress", priority: 1 },
  { id: "rui-2", title: "Add dark mode support", status: "open", priority: 2 },
]

describe("TaskPanel", () => {
  describe("rendering", () => {
    it("renders with complementary role", () => {
      render(<TaskPanel />)
      expect(screen.getByRole("complementary", { name: "Task sidebar" })).toBeInTheDocument()
    })

    it("renders TaskList empty state when no tasks provided", () => {
      render(<TaskPanel />)
      expect(screen.getByText("No tasks")).toBeInTheDocument()
    })

    it("applies custom className", () => {
      render(<TaskPanel className="custom-class" />)
      expect(screen.getByRole("complementary")).toHaveClass("custom-class")
    })
  })

  describe("sections", () => {
    it("renders task list with provided tasks", () => {
      render(<TaskPanel tasks={sampleTasks} />)
      expect(screen.getByRole("list", { name: "Task list" })).toBeInTheDocument()
      expect(screen.getByText("Implement authentication")).toBeInTheDocument()
      expect(screen.getByText("Add dark mode support")).toBeInTheDocument()
    })

    it("does not render quick input by default", () => {
      render(<TaskPanel tasks={sampleTasks} />)
      expect(screen.queryByRole("textbox", { name: /new task title/i })).not.toBeInTheDocument()
    })

    it("renders quick input when showQuickInput is true", () => {
      render(<TaskPanel tasks={sampleTasks} showQuickInput />)
      expect(screen.getByRole("textbox", { name: /new task title/i })).toBeInTheDocument()
    })

    it("does not render progress bar when not running", () => {
      render(<TaskPanel tasks={sampleTasks} />)
      expect(screen.queryByTestId("task-progress-bar")).not.toBeInTheDocument()
    })

    it("renders progress bar when running with initialTaskCount", () => {
      render(<TaskPanel tasks={sampleTasks} isRunning initialTaskCount={5} />)
      expect(screen.getByTestId("task-progress-bar")).toBeInTheDocument()
    })
  })

  describe("layout", () => {
    it("has flexbox column layout", () => {
      render(<TaskPanel />)
      const sidebar = screen.getByRole("complementary")
      expect(sidebar).toHaveClass("flex", "flex-col")
    })

    it("has full height", () => {
      render(<TaskPanel />)
      const sidebar = screen.getByRole("complementary")
      expect(sidebar).toHaveClass("h-full")
    })
  })

  describe("search", () => {
    it("always renders search input", () => {
      render(<TaskPanel />)
      expect(screen.getByRole("textbox", { name: "Search tasks" })).toBeInTheDocument()
    })
  })
})
