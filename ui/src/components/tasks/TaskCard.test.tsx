import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { TaskCard, type TaskCardTask, type TaskStatus } from "./TaskCard"

// Test Fixtures

const baseTask: TaskCardTask = {
  id: "rui-4rt.5",
  title: "Create TaskCard component",
  status: "open",
}

const fullTask: TaskCardTask = {
  id: "rui-4rt.5",
  title: "Create TaskCard component",
  description: "Display individual task with ID, title. Click to expand/edit.",
  status: "in_progress",
  priority: 2,
  issue_type: "task",
  parent: "rui-4rt",
}

// Tests

describe("TaskCard", () => {
  describe("rendering", () => {
    it("renders task title", () => {
      render(<TaskCard task={baseTask} />)
      expect(screen.getByText("Create TaskCard component")).toBeInTheDocument()
    })

    it("does not render task ID in main view", () => {
      render(<TaskCard task={baseTask} />)
      // Task ID should not be visible in the main view
      expect(screen.queryByText("rui-4rt.5")).not.toBeInTheDocument()
    })

    it("renders status icon", () => {
      render(<TaskCard task={baseTask} />)
      expect(screen.getByLabelText("Status: Open")).toBeInTheDocument()
    })

    it("renders different status icons", () => {
      const statuses: TaskStatus[] = ["open", "in_progress", "blocked", "deferred", "closed"]
      const labels = ["Open", "In Progress", "Blocked", "Deferred", "Closed"]

      statuses.forEach((status, i) => {
        const { unmount } = render(<TaskCard task={{ ...baseTask, status }} />)
        expect(screen.getByLabelText(`Status: ${labels[i]}`)).toBeInTheDocument()
        unmount()
      })
    })

    it("does not render priority badge for P2 (default priority)", () => {
      render(<TaskCard task={{ ...baseTask, priority: 2 }} />)
      // P2 priority badge should not be visible since it's the default
      expect(screen.queryByText("P2")).not.toBeInTheDocument()
    })

    it("renders priority badge for non-P2 priorities", () => {
      const { rerender } = render(<TaskCard task={{ ...baseTask, priority: 0 }} />)
      expect(screen.getByText("P0")).toBeInTheDocument()
      expect(screen.getByLabelText("Priority: P0")).toBeInTheDocument()

      rerender(<TaskCard task={{ ...baseTask, priority: 1 }} />)
      expect(screen.getByText("P1")).toBeInTheDocument()

      rerender(<TaskCard task={{ ...baseTask, priority: 3 }} />)
      expect(screen.getByText("P3")).toBeInTheDocument()

      rerender(<TaskCard task={{ ...baseTask, priority: 4 }} />)
      expect(screen.getByText("P4")).toBeInTheDocument()
    })

    it("renders type icon for bug type", () => {
      render(<TaskCard task={{ ...baseTask, issue_type: "bug" }} />)
      expect(screen.getByLabelText("Type: Bug")).toBeInTheDocument()
    })

    it("renders type icon for feature type", () => {
      render(<TaskCard task={{ ...baseTask, issue_type: "feature" }} />)
      expect(screen.getByLabelText("Type: Feature")).toBeInTheDocument()
    })

    it("renders type icon for epic type", () => {
      render(<TaskCard task={{ ...baseTask, issue_type: "epic" }} />)
      expect(screen.getByLabelText("Type: Epic")).toBeInTheDocument()
    })

    it("does not render type icon for task type (default)", () => {
      render(<TaskCard task={{ ...baseTask, issue_type: "task" }} />)
      expect(screen.queryByLabelText(/Type:/)).not.toBeInTheDocument()
    })

    it("applies reduced opacity for closed tasks", () => {
      const { container } = render(<TaskCard task={{ ...baseTask, status: "closed" }} />)
      expect(container.firstChild).toHaveClass("opacity-60")
    })

    it("applies strikethrough for closed task titles", () => {
      render(<TaskCard task={{ ...baseTask, status: "closed" }} />)
      const title = screen.getByText("Create TaskCard component")
      expect(title).toHaveClass("line-through")
    })

    it("applies custom className", () => {
      const { container } = render(<TaskCard task={baseTask} className="custom-class" />)
      expect(container.firstChild).toHaveClass("custom-class")
    })
  })

  describe("click behavior", () => {
    it("supports keyboard navigation with Enter", () => {
      const onClick = vi.fn()
      render(<TaskCard task={fullTask} onClick={onClick} />)

      const contentButton = screen.getByRole("button", { name: fullTask.title })
      fireEvent.keyDown(contentButton, { key: "Enter" })

      expect(onClick).toHaveBeenCalledWith(fullTask.id)
    })

    it("supports keyboard navigation with Space", () => {
      const onClick = vi.fn()
      render(<TaskCard task={fullTask} onClick={onClick} />)

      const contentButton = screen.getByRole("button", { name: fullTask.title })
      fireEvent.keyDown(contentButton, { key: " " })

      expect(onClick).toHaveBeenCalledWith(fullTask.id)
    })
  })

  describe("status change", () => {
    it("does not show status menu without onStatusChange handler", () => {
      render(<TaskCard task={baseTask} />)

      const statusButton = screen.getByLabelText("Status: Open")
      fireEvent.click(statusButton)

      // Menu should not appear
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
    })

    it("shows status menu when onStatusChange is provided and clicked", () => {
      const onStatusChange = vi.fn()
      render(<TaskCard task={baseTask} onStatusChange={onStatusChange} />)

      const statusButton = screen.getByLabelText(/Status: Open/)
      fireEvent.click(statusButton)

      // Menu should appear
      expect(screen.getByRole("listbox")).toBeInTheDocument()
    })

    it("displays all status options in menu", () => {
      const onStatusChange = vi.fn()
      render(<TaskCard task={baseTask} onStatusChange={onStatusChange} />)

      fireEvent.click(screen.getByLabelText(/Status: Open/))

      expect(screen.getByRole("option", { name: "Open" })).toBeInTheDocument()
      expect(screen.getByRole("option", { name: "In Progress" })).toBeInTheDocument()
      expect(screen.getByRole("option", { name: "Blocked" })).toBeInTheDocument()
      expect(screen.getByRole("option", { name: "Deferred" })).toBeInTheDocument()
      expect(screen.getByRole("option", { name: "Closed" })).toBeInTheDocument()
    })

    it("calls onStatusChange when option selected", () => {
      const onStatusChange = vi.fn()
      render(<TaskCard task={baseTask} onStatusChange={onStatusChange} />)

      fireEvent.click(screen.getByLabelText(/Status: Open/))
      fireEvent.click(screen.getByRole("option", { name: "In Progress" }))

      expect(onStatusChange).toHaveBeenCalledWith("rui-4rt.5", "in_progress")
    })

    it("closes menu after selection", () => {
      const onStatusChange = vi.fn()
      render(<TaskCard task={baseTask} onStatusChange={onStatusChange} />)

      fireEvent.click(screen.getByLabelText(/Status: Open/))
      fireEvent.click(screen.getByRole("option", { name: "In Progress" }))

      expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
    })

    it("marks current status as selected", () => {
      const onStatusChange = vi.fn()
      render(
        <TaskCard task={{ ...baseTask, status: "in_progress" }} onStatusChange={onStatusChange} />,
      )

      fireEvent.click(screen.getByLabelText(/Status: In Progress/))

      expect(screen.getByRole("option", { name: "In Progress" })).toHaveAttribute(
        "aria-selected",
        "true",
      )
    })

    it("status button click does not trigger onClick", () => {
      const onStatusChange = vi.fn()
      const onClick = vi.fn()
      render(<TaskCard task={fullTask} onStatusChange={onStatusChange} onClick={onClick} />)

      fireEvent.click(screen.getByLabelText(/Status: In Progress/))

      // onClick should not have been called
      expect(onClick).not.toHaveBeenCalled()
      // Status menu should be open
      expect(screen.getByRole("listbox")).toBeInTheDocument()
    })
  })

  describe("onClick callback", () => {
    it("calls onClick when card content is clicked", () => {
      const onClick = vi.fn()
      render(<TaskCard task={baseTask} onClick={onClick} />)

      fireEvent.click(screen.getByRole("button", { name: baseTask.title }))

      expect(onClick).toHaveBeenCalledWith("rui-4rt.5")
    })

    it("calls onClick without showing expanded details", () => {
      const onClick = vi.fn()
      render(<TaskCard task={fullTask} onClick={onClick} />)

      fireEvent.click(screen.getByRole("button", { name: fullTask.title }))

      expect(onClick).toHaveBeenCalledWith("rui-4rt.5")
      // Description should NOT be visible (clicking opens dialog instead of expanding inline)
      expect(screen.queryByText(fullTask.description!)).not.toBeInTheDocument()
    })
  })

  describe("priority", () => {
    it("displays priority badges for non-P2 priorities", () => {
      // P0, P1, P3, P4 should show badges
      ;[0, 1, 3, 4].forEach(priority => {
        const { unmount } = render(<TaskCard task={{ ...baseTask, priority }} />)
        expect(screen.getByText(`P${priority}`)).toBeInTheDocument()
        unmount()
      })
    })

    it("does not display priority badge for P2 (default)", () => {
      render(<TaskCard task={{ ...baseTask, priority: 2 }} />)
      expect(screen.queryByText("P2")).not.toBeInTheDocument()
    })

    it("does not display priority badge when priority is undefined", () => {
      render(<TaskCard task={baseTask} />)
      expect(screen.queryByText(/^P\d$/)).not.toBeInTheDocument()
    })
  })

  describe("issue type", () => {
    it("displays bug icon with error color", () => {
      render(<TaskCard task={{ ...baseTask, issue_type: "bug" }} />)
      const typeIndicator = screen.getByLabelText("Type: Bug")
      expect(typeIndicator).toBeInTheDocument()
      expect(typeIndicator).toHaveClass("text-status-error")
    })

    it("displays feature icon with primary color", () => {
      render(<TaskCard task={{ ...baseTask, issue_type: "feature" }} />)
      const typeIndicator = screen.getByLabelText("Type: Feature")
      expect(typeIndicator).toBeInTheDocument()
      expect(typeIndicator).toHaveClass("text-primary")
    })

    it("displays epic icon with primary color", () => {
      render(<TaskCard task={{ ...baseTask, issue_type: "epic" }} />)
      const typeIndicator = screen.getByLabelText("Type: Epic")
      expect(typeIndicator).toBeInTheDocument()
      expect(typeIndicator).toHaveClass("text-primary")
    })

    it("does not display type icon for task type", () => {
      render(<TaskCard task={{ ...baseTask, issue_type: "task" }} />)
      expect(screen.queryByLabelText(/Type:/)).not.toBeInTheDocument()
    })

    it("does not display type icon when issue_type is undefined", () => {
      render(<TaskCard task={baseTask} />)
      expect(screen.queryByLabelText(/Type:/)).not.toBeInTheDocument()
    })
  })

  describe("accessibility", () => {
    it("content area has button role", () => {
      render(<TaskCard task={baseTask} />)
      expect(screen.getByRole("button", { name: baseTask.title })).toBeInTheDocument()
    })

    it("status button has aria-haspopup when interactive", () => {
      const onStatusChange = vi.fn()
      render(<TaskCard task={baseTask} onStatusChange={onStatusChange} />)

      const statusButton = screen.getByLabelText(/Status: Open/)
      expect(statusButton).toHaveAttribute("aria-haspopup", "listbox")
    })

    it("status menu has correct ARIA attributes", () => {
      const onStatusChange = vi.fn()
      render(<TaskCard task={baseTask} onStatusChange={onStatusChange} />)

      fireEvent.click(screen.getByLabelText(/Status: Open/))

      const listbox = screen.getByRole("listbox")
      expect(listbox).toHaveAttribute("aria-label", "Select status")
    })
  })
})
