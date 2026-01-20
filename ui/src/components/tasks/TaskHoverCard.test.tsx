import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { TaskHoverCard } from "./TaskHoverCard"
import type { TaskCardTask } from "./TaskCard"

// Test Fixtures

const baseTask: TaskCardTask = {
  id: "rui-4rt.5",
  title: "Create TaskCard component",
  status: "open",
}

const fullTask: TaskCardTask = {
  id: "rui-abc.1",
  title: "Full featured task",
  description: "This is a detailed description of the task.",
  status: "in_progress",
  priority: 1,
  issue_type: "task",
  parent: "rui-abc",
}

// Helper to render with trigger content
function renderHoverCard(task: TaskCardTask, props?: Partial<Parameters<typeof TaskHoverCard>[0]>) {
  return render(
    <TaskHoverCard task={task} {...props}>
      <button data-testid="trigger">Hover trigger</button>
    </TaskHoverCard>,
  )
}

// Tests

describe("TaskHoverCard", () => {
  describe("rendering", () => {
    it("renders trigger element", () => {
      renderHoverCard(baseTask)
      expect(screen.getByText("Hover trigger")).toBeInTheDocument()
    })

    it("renders trigger with data attributes from radix", () => {
      renderHoverCard(baseTask)
      const trigger = screen.getByTestId("trigger")
      expect(trigger).toHaveAttribute("data-state")
    })

    it("does not render hover content initially", () => {
      renderHoverCard(baseTask)
      expect(screen.queryByText(baseTask.id)).not.toBeInTheDocument()
    })

    it("renders just the trigger when disabled", () => {
      renderHoverCard(baseTask, { disabled: true })
      const trigger = screen.getByText("Hover trigger")
      expect(trigger).toBeInTheDocument()
      // When disabled, there should be no radix data attributes
      expect(trigger).not.toHaveAttribute("data-state")
    })
  })

  describe("component props", () => {
    it("passes children through correctly", () => {
      render(
        <TaskHoverCard task={baseTask}>
          <div data-testid="custom-child">Custom child content</div>
        </TaskHoverCard>,
      )
      expect(screen.getByTestId("custom-child")).toBeInTheDocument()
      expect(screen.getByText("Custom child content")).toBeInTheDocument()
    })

    it("accepts onOpenDetails callback", () => {
      const onOpenDetails = vi.fn()
      renderHoverCard(baseTask, { onOpenDetails })
      // Just verify it renders without error - callback would be tested in integration/e2e
      expect(screen.getByText("Hover trigger")).toBeInTheDocument()
    })

    it("handles undefined description gracefully", () => {
      renderHoverCard(baseTask)
      expect(screen.getByText("Hover trigger")).toBeInTheDocument()
    })

    it("handles undefined priority gracefully", () => {
      renderHoverCard(baseTask)
      expect(screen.getByText("Hover trigger")).toBeInTheDocument()
    })

    it("handles undefined parent gracefully", () => {
      renderHoverCard(baseTask)
      expect(screen.getByText("Hover trigger")).toBeInTheDocument()
    })

    it("handles undefined issue_type gracefully", () => {
      renderHoverCard(baseTask)
      expect(screen.getByText("Hover trigger")).toBeInTheDocument()
    })
  })

  describe("task states", () => {
    const statuses = ["open", "in_progress", "blocked", "deferred", "closed"] as const

    statuses.forEach(status => {
      it(`renders with ${status} status`, () => {
        const task: TaskCardTask = { ...baseTask, status }
        renderHoverCard(task)
        expect(screen.getByText("Hover trigger")).toBeInTheDocument()
      })
    })
  })

  describe("task priorities", () => {
    const priorities = [0, 1, 2, 3, 4]

    priorities.forEach(priority => {
      it(`renders with priority ${priority}`, () => {
        const task: TaskCardTask = { ...baseTask, priority }
        renderHoverCard(task)
        expect(screen.getByText("Hover trigger")).toBeInTheDocument()
      })
    })
  })

  describe("disabled state", () => {
    it("renders children directly when disabled", () => {
      render(
        <TaskHoverCard task={baseTask} disabled>
          <span data-testid="direct-child">Direct child</span>
        </TaskHoverCard>,
      )
      const child = screen.getByTestId("direct-child")
      expect(child).toBeInTheDocument()
      // When disabled, children should be rendered directly without wrapper
      expect(child.parentElement?.tagName.toLowerCase()).toBe("div") // test container
    })

    it("does not wrap children with hover card when disabled", () => {
      render(
        <TaskHoverCard task={baseTask} disabled>
          <button>Trigger</button>
        </TaskHoverCard>,
      )
      const button = screen.getByRole("button")
      // Should not have radix data-state attribute when disabled
      expect(button).not.toHaveAttribute("data-state")
    })
  })

  describe("full task data", () => {
    it("renders with full task data without error", () => {
      renderHoverCard(fullTask)
      expect(screen.getByText("Hover trigger")).toBeInTheDocument()
    })

    it("renders with all optional fields present", () => {
      const task: TaskCardTask = {
        id: "test-123",
        title: "Test task",
        description: "Description",
        status: "in_progress",
        priority: 2,
        issue_type: "bug",
        parent: "parent-456",
        created_at: "2024-01-01T00:00:00Z",
        closed_at: "2024-01-02T00:00:00Z",
      }
      renderHoverCard(task)
      expect(screen.getByText("Hover trigger")).toBeInTheDocument()
    })
  })
})
