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
      // Only the search input border-b should exist when quickInput is not provided
      const borderBElements = container.querySelectorAll(".border-b")
      expect(borderBElements).toHaveLength(1)
      // Verify the one border-b element contains the search input
      expect(borderBElements[0].querySelector('[aria-label="Search tasks"]')).toBeInTheDocument()
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

    it("renders both quickInput and taskList together", () => {
      render(
        <TaskSidebar
          quickInput={<div data-testid="quick-input">Quick input</div>}
          taskList={<div data-testid="task-list">Task list</div>}
        />,
      )
      expect(screen.getByTestId("quick-input")).toBeInTheDocument()
      expect(screen.getByTestId("task-list")).toBeInTheDocument()
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
    it("quick input area has correct border styling", () => {
      render(<TaskSidebar quickInput={<div>Input</div>} />)
      const inputContainer = screen.getByText("Input").parentElement
      expect(inputContainer).toHaveClass("border-b", "border-border")
    })
  })

  describe("search", () => {
    it("renders search input", () => {
      render(<TaskSidebar />)
      expect(screen.getByRole("textbox", { name: "Search tasks" })).toBeInTheDocument()
    })

    it("renders search input between quick input and task list", () => {
      render(
        <TaskSidebar
          quickInput={<div data-testid="quick-input">Quick input</div>}
          taskList={<div data-testid="task-list">Task list</div>}
        />,
      )
      // Verify all elements are present
      expect(screen.getByRole("textbox", { name: "Search tasks" })).toBeInTheDocument()
      expect(screen.getByTestId("quick-input")).toBeInTheDocument()
      expect(screen.getByTestId("task-list")).toBeInTheDocument()

      // Get the elements in DOM order
      const sidebar = screen.getByRole("complementary")
      const allElements = sidebar.querySelectorAll("[data-testid], [aria-label='Search tasks']")
      const elementOrder = Array.from(allElements).map(
        el => el.getAttribute("data-testid") || el.getAttribute("aria-label"),
      )

      // Quick input should come first, then search, then task list
      expect(elementOrder.indexOf("quick-input")).toBeLessThan(elementOrder.indexOf("Search tasks"))
      expect(elementOrder.indexOf("Search tasks")).toBeLessThan(elementOrder.indexOf("task-list"))
    })
  })
})
