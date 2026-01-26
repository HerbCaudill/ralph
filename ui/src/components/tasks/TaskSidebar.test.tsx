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

    it("does not render quickInput area when not provided", () => {
      const { container } = render(<TaskSidebar />)
      // No border-b elements should exist when quickInput and search are not shown
      const borderBElements = container.querySelectorAll(".border-b")
      expect(borderBElements).toHaveLength(0)
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

    it("renders iterationHistory when provided", () => {
      render(<TaskSidebar iterationHistory={<div data-testid="iteration-history">History</div>} />)
      expect(screen.getByTestId("iteration-history")).toBeInTheDocument()
      expect(screen.getByText("History")).toBeInTheDocument()
    })

    it("does not render iterationHistory container when not provided", () => {
      const { container } = render(<TaskSidebar />)
      // Should not have the iteration history container with border-t class
      // Note: we check that only the content wrapper exists, not the history footer
      const borderTElements = container.querySelectorAll(".border-t")
      expect(borderTElements).toHaveLength(0)
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

  describe("styling", () => {
    it("iteration history area has correct border styling", () => {
      render(<TaskSidebar iterationHistory={<div>History</div>} />)
      const historyContainer = screen.getByText("History").parentElement
      expect(historyContainer).toHaveClass("border-t", "border-border")
    })
  })

  describe("search", () => {
    it("does not render search input by default", () => {
      render(<TaskSidebar />)
      expect(screen.queryByRole("textbox", { name: "Search tasks" })).not.toBeInTheDocument()
    })

    it("renders search input when isSearchVisible is true", () => {
      render(<TaskSidebar isSearchVisible={true} />)
      expect(screen.getByRole("textbox", { name: "Search tasks" })).toBeInTheDocument()
    })

    it("renders search input above task list when visible", () => {
      render(
        <TaskSidebar
          taskList={<div data-testid="task-list">Task list</div>}
          isSearchVisible={true}
        />,
      )
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
