import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { TaskCard } from ".././TaskCard"
import { beadsViewStore } from "../../../store"
import type { TaskCardTask, TaskStatus } from "../../../types"

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
  beforeEach(() => {
    // Reset store state before each test
    beadsViewStore.setState({
      issuePrefix: "rui",
      selectedTaskId: null,
      accentColor: null,
    })
  })

  describe("rendering", () => {
    it("renders task title", () => {
      render(<TaskCard task={baseTask} />)
      expect(screen.getByText("Create TaskCard component")).toBeInTheDocument()
    })

    it("renders task ID in main view (stripped of prefix)", () => {
      render(<TaskCard task={baseTask} />)
      // Task ID should be visible, stripped of the prefix for cleaner display
      expect(screen.getByText("4rt.5")).toBeInTheDocument()
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
      // Task type icon should not be visible since it's the default
      expect(screen.queryByLabelText("Type: Task")).not.toBeInTheDocument()
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

    it("displays feature icon with repo accent color", () => {
      render(<TaskCard task={{ ...baseTask, issue_type: "feature" }} />)
      const typeIndicator = screen.getByLabelText("Type: Feature")
      expect(typeIndicator).toBeInTheDocument()
      expect(typeIndicator).toHaveClass("text-repo-accent")
    })

    it("displays epic icon with repo accent color", () => {
      render(<TaskCard task={{ ...baseTask, issue_type: "epic" }} />)
      const typeIndicator = screen.getByLabelText("Type: Epic")
      expect(typeIndicator).toBeInTheDocument()
      expect(typeIndicator).toHaveClass("text-repo-accent")
    })

    it("does not display task icon (default type)", () => {
      render(<TaskCard task={{ ...baseTask, issue_type: "task" }} />)
      // Task type icon should not be visible since it's the default
      expect(screen.queryByLabelText("Type: Task")).not.toBeInTheDocument()
    })

    it("does not display type icon when issue_type is undefined", () => {
      render(<TaskCard task={baseTask} />)
      expect(screen.queryByLabelText(/Type:/)).not.toBeInTheDocument()
    })

    it("renders placeholder div for alignment when no type icon is displayed", () => {
      const { container } = render(<TaskCard task={baseTask} />)
      // Find the type/priority container (flex div with gap-1.5)
      const indicatorsContainer = container.querySelector(".flex.shrink-0.items-center.gap-1\\.5")
      expect(indicatorsContainer).toBeInTheDocument()
      // Should have a placeholder div with h-3.5 and w-3.5 classes
      const placeholder = indicatorsContainer?.querySelector("div.h-3\\.5.w-3\\.5")
      expect(placeholder).toBeInTheDocument()
    })
  })

  describe("accessibility", () => {
    it("content area has button role", () => {
      render(<TaskCard task={baseTask} />)
      expect(screen.getByRole("button", { name: baseTask.title })).toBeInTheDocument()
    })

    it("status indicator has aria-label", () => {
      render(<TaskCard task={baseTask} />)
      expect(screen.getByLabelText("Status: Open")).toBeInTheDocument()
    })
  })

  describe("new task animation", () => {
    it("applies animation class when isNew is true", () => {
      const { container } = render(<TaskCard task={baseTask} isNew={true} />)
      expect(container.firstChild).toHaveClass("animate-bounceIn")
    })

    it("does not apply animation class when isNew is false", () => {
      const { container } = render(<TaskCard task={baseTask} isNew={false} />)
      expect(container.firstChild).not.toHaveClass("animate-bounceIn")
    })

    it("does not apply animation class by default", () => {
      const { container } = render(<TaskCard task={baseTask} />)
      expect(container.firstChild).not.toHaveClass("animate-bounceIn")
    })
  })

  describe("epic with subtasks", () => {
    const epicTask: TaskCardTask = {
      ...baseTask,
      issue_type: "epic",
      title: "Epic task with subtasks",
    }

    it("displays chevron button when epic has subtasks and onToggleCollapse is provided", () => {
      const onToggleCollapse = vi.fn()
      render(<TaskCard task={epicTask} onToggleCollapse={onToggleCollapse} subtaskCount={3} />)

      expect(screen.getByLabelText("Collapse subtasks")).toBeInTheDocument()
    })

    it("does not display chevron when epic has no subtasks", () => {
      const onToggleCollapse = vi.fn()
      render(<TaskCard task={epicTask} onToggleCollapse={onToggleCollapse} subtaskCount={0} />)

      expect(screen.queryByLabelText("Collapse subtasks")).not.toBeInTheDocument()
      expect(screen.queryByLabelText("Expand subtasks")).not.toBeInTheDocument()
    })

    it("does not display chevron when onToggleCollapse is not provided", () => {
      render(<TaskCard task={epicTask} subtaskCount={3} />)

      expect(screen.queryByLabelText("Collapse subtasks")).not.toBeInTheDocument()
      expect(screen.queryByLabelText("Expand subtasks")).not.toBeInTheDocument()
    })

    it("displays subtask count badge", () => {
      const onToggleCollapse = vi.fn()
      render(<TaskCard task={epicTask} onToggleCollapse={onToggleCollapse} subtaskCount={5} />)

      expect(screen.getByLabelText("5 subtasks")).toBeInTheDocument()
      expect(screen.getByText("5")).toBeInTheDocument()
    })

    it("calls onToggleCollapse when chevron is clicked", () => {
      const onToggleCollapse = vi.fn()
      render(<TaskCard task={epicTask} onToggleCollapse={onToggleCollapse} subtaskCount={3} />)

      const chevron = screen.getByLabelText("Collapse subtasks")
      fireEvent.click(chevron)

      expect(onToggleCollapse).toHaveBeenCalledTimes(1)
    })

    it("calls onClick when epic content area is clicked, not onToggleCollapse", () => {
      const onClick = vi.fn()
      const onToggleCollapse = vi.fn()
      render(
        <TaskCard
          task={epicTask}
          onClick={onClick}
          onToggleCollapse={onToggleCollapse}
          subtaskCount={3}
        />,
      )

      // Click on the content area (not the chevron)
      const contentButton = screen.getByRole("button", { name: epicTask.title })
      fireEvent.click(contentButton)

      // Should call onClick to open details dialog
      expect(onClick).toHaveBeenCalledWith(epicTask.id)
      // Should NOT call onToggleCollapse
      expect(onToggleCollapse).not.toHaveBeenCalled()
    })

    it("chevron click does not trigger onClick", () => {
      const onClick = vi.fn()
      const onToggleCollapse = vi.fn()
      render(
        <TaskCard
          task={epicTask}
          onClick={onClick}
          onToggleCollapse={onToggleCollapse}
          subtaskCount={3}
        />,
      )

      // Click on the chevron
      const chevron = screen.getByLabelText("Collapse subtasks")
      fireEvent.click(chevron)

      // Should call onToggleCollapse
      expect(onToggleCollapse).toHaveBeenCalledTimes(1)
      // Should NOT call onClick
      expect(onClick).not.toHaveBeenCalled()
    })

    it("changes chevron aria-label and rotation when collapsed", () => {
      const onToggleCollapse = vi.fn()
      const { rerender } = render(
        <TaskCard
          task={epicTask}
          onToggleCollapse={onToggleCollapse}
          subtaskCount={3}
          isCollapsed={false}
        />,
      )

      let chevron = screen.getByLabelText("Collapse subtasks")
      expect(chevron).toHaveAttribute("aria-expanded", "true")

      // Rerender with collapsed state
      rerender(
        <TaskCard
          task={epicTask}
          onToggleCollapse={onToggleCollapse}
          subtaskCount={3}
          isCollapsed={true}
        />,
      )

      chevron = screen.getByLabelText("Expand subtasks")
      expect(chevron).toHaveAttribute("aria-expanded", "false")
    })

    it("supports keyboard navigation on chevron with Enter", () => {
      const onToggleCollapse = vi.fn()
      render(<TaskCard task={epicTask} onToggleCollapse={onToggleCollapse} subtaskCount={3} />)

      const chevron = screen.getByLabelText("Collapse subtasks")
      fireEvent.keyDown(chevron, { key: "Enter" })

      expect(onToggleCollapse).toHaveBeenCalledTimes(1)
    })

    it("supports keyboard navigation on chevron with Space", () => {
      const onToggleCollapse = vi.fn()
      render(<TaskCard task={epicTask} onToggleCollapse={onToggleCollapse} subtaskCount={3} />)

      const chevron = screen.getByLabelText("Collapse subtasks")
      fireEvent.keyDown(chevron, { key: " " })

      expect(onToggleCollapse).toHaveBeenCalledTimes(1)
    })
  })

  describe("in_progress spinner animation", () => {
    it("applies animate-spin class to in_progress status icon", () => {
      const { container } = render(<TaskCard task={{ ...baseTask, status: "in_progress" }} />)
      // The status icon should have the animate-spin class
      const statusIcon = container.querySelector('svg[class*="animate-spin"]')
      expect(statusIcon).toBeInTheDocument()
    })

    it("does not apply animate-spin class to other status icons", () => {
      const statuses: TaskStatus[] = ["open", "blocked", "deferred", "closed"]

      statuses.forEach(status => {
        const { container, unmount } = render(<TaskCard task={{ ...baseTask, status }} />)
        // These status icons should NOT have the animate-spin class
        const statusIcon = container.querySelector('svg[class*="animate-spin"]')
        expect(statusIcon).not.toBeInTheDocument()
        unmount()
      })
    })
  })

  describe("session indicator", () => {
    it("displays session history icon when hasSessions is true", () => {
      render(<TaskCard task={baseTask} hasSessions={true} />)
      expect(screen.getByLabelText("Has session history")).toBeInTheDocument()
    })

    it("does not display session history icon when hasSessions is false", () => {
      render(<TaskCard task={baseTask} hasSessions={false} />)
      expect(screen.queryByLabelText("Has session history")).not.toBeInTheDocument()
    })

    it("does not display session history icon by default", () => {
      render(<TaskCard task={baseTask} />)
      expect(screen.queryByLabelText("Has session history")).not.toBeInTheDocument()
    })

    it("session icon has correct styling", () => {
      const { container } = render(<TaskCard task={baseTask} hasSessions={true} />)
      const icon = container.querySelector('svg[aria-label="Has session history"]')
      expect(icon).toHaveClass("text-muted-foreground")
      expect(icon).toHaveClass("size-3.5")
    })
  })

  describe("keyboard selection styling", () => {
    it("applies selection style when task is selected", () => {
      beadsViewStore.setState({ selectedTaskId: baseTask.id })
      const { container } = render(<TaskCard task={baseTask} />)

      // When selected, the card should have inline styles for selection
      const card = container.firstChild as HTMLElement
      expect(card.style.backgroundColor).toBeTruthy()
      expect(card.style.boxShadow).toBeTruthy()
    })

    it("does not apply selection style when task is not selected", () => {
      beadsViewStore.setState({ selectedTaskId: "other-task-id" })
      const { container } = render(<TaskCard task={baseTask} />)

      const card = container.firstChild as HTMLElement
      expect(card.style.backgroundColor).toBe("")
      expect(card.style.boxShadow).toBe("")
    })

    it("uses accent color for selection when provided", () => {
      beadsViewStore.setState({ selectedTaskId: baseTask.id, accentColor: "#ff5500" })
      const { container } = render(<TaskCard task={baseTask} />)

      const card = container.firstChild as HTMLElement
      // Check that the accent color is used
      // Background: #ff5500 with 1A (10%) opacity
      expect(card.style.backgroundColor).toMatch(/rgba\(255,\s*85,\s*0,\s*0\.1\)|#ff55001a/i)
      // Box shadow uses accent color with 80 suffix (50% opacity)
      expect(card.style.boxShadow).toContain("#ff550080")
    })

    it("uses default color for selection when accent color is null", () => {
      beadsViewStore.setState({ selectedTaskId: baseTask.id, accentColor: null })
      const { container } = render(<TaskCard task={baseTask} />)

      const card = container.firstChild as HTMLElement
      // DEFAULT_ACCENT_COLOR is #374151 (gray-700)
      // Background: #374151 with 1A (10%) opacity
      expect(card.style.backgroundColor).toMatch(/rgba\(55,\s*65,\s*81,\s*0\.1\)|#3741511a/i)
      // Box shadow uses default color with 80 suffix (50% opacity)
      expect(card.style.boxShadow).toContain("#37415180")
    })
  })
})
