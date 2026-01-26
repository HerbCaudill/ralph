import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { TaskSidebar } from "./TaskSidebar"

describe("TaskSidebar", () => {
  describe("rendering", () => {
    it("renders with complementary role", () => {
      render(<TaskSidebar />)
      expect(screen.getByRole("complementary", { name: "Task sidebar" })).toBeInTheDocument()
    })

    it("renders empty state when no taskList provided", () => {
      render(<TaskSidebar />)
      expect(screen.getByText("No tasks yet")).toBeInTheDocument()
    })

    it("applies custom className", () => {
      render(<TaskSidebar className="custom-class" />)
      expect(screen.getByRole("complementary")).toHaveClass("custom-class")
    })
  })

  describe("slots", () => {
    it("renders quickInput when provided", () => {
      render(<TaskSidebar quickInput={<div data-testid="quick-input">Quick input</div>} />)
      expect(screen.getByTestId("quick-input")).toBeInTheDocument()
      expect(screen.getByText("Quick input")).toBeInTheDocument()
    })

    it("does not render quickInput area when not provided but search is always present", () => {
      const { container } = render(<TaskSidebar />)
      // One border-b element should exist for the always-visible search bar
      const borderBElements = container.querySelectorAll(".border-b")
      expect(borderBElements).toHaveLength(1)
    })

    it("renders taskList when provided", () => {
      render(<TaskSidebar taskList={<div data-testid="task-list">Task list</div>} />)
      expect(screen.getByTestId("task-list")).toBeInTheDocument()
      expect(screen.getByText("Task list")).toBeInTheDocument()
    })

    it("hides empty state when taskList is provided", () => {
      render(<TaskSidebar taskList={<div>Task list</div>} />)
      expect(screen.queryByText("No tasks yet")).not.toBeInTheDocument()
    })

    it("renders taskList standalone (no quickInput)", () => {
      render(<TaskSidebar taskList={<div data-testid="task-list">Task list</div>} />)
      expect(screen.getByTestId("task-list")).toBeInTheDocument()
    })

    it("renders progressBar when provided", () => {
      render(<TaskSidebar progressBar={<div data-testid="progress-bar">Progress</div>} />)
      expect(screen.getByTestId("progress-bar")).toBeInTheDocument()
      expect(screen.getByText("Progress")).toBeInTheDocument()
    })
  })

  describe("layout", () => {
    it("has flexbox column layout", () => {
      render(<TaskSidebar />)
      const sidebar = screen.getByRole("complementary")
      expect(sidebar).toHaveClass("flex", "flex-col")
    })

    it("has full height", () => {
      render(<TaskSidebar />)
      const sidebar = screen.getByRole("complementary")
      expect(sidebar).toHaveClass("h-full")
    })

    it("task list area is flexible container", () => {
      render(<TaskSidebar taskList={<div data-testid="task-list-content">My tasks</div>} />)
      // The task list container should be a flexible container
      // (scrolling is handled by TaskList sections internally)
      const taskListContainer = screen.getByTestId("task-list-content").parentElement
      expect(taskListContainer).toHaveClass("min-h-0", "flex-1")
    })
  })

  describe("search", () => {
    it("always renders search input", () => {
      render(<TaskSidebar />)
      expect(screen.getByRole("textbox", { name: "Search tasks" })).toBeInTheDocument()
    })

    it("renders search input above task list", () => {
      render(<TaskSidebar taskList={<div data-testid="task-list">Task list</div>} />)
      // Verify all elements are present
      expect(screen.getByRole("textbox", { name: "Search tasks" })).toBeInTheDocument()
      expect(screen.getByTestId("task-list")).toBeInTheDocument()

      // Get the elements in DOM order
      const sidebar = screen.getByRole("complementary")
      const allElements = sidebar.querySelectorAll("[data-testid], [aria-label='Search tasks']")
      const elementOrder = Array.from(allElements).map(
        el => el.getAttribute("data-testid") || el.getAttribute("aria-label"),
      )

      // Search should come before task list
      expect(elementOrder.indexOf("Search tasks")).toBeLessThan(elementOrder.indexOf("task-list"))
    })
  })
})
