import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { TaskDetailPanel } from "../TaskDetailPanel"
import type { TaskCardTask } from "@herbcaudill/beads-view"

// Mock the beads-view components and functions
vi.mock("@herbcaudill/beads-view", async () => {
  const actual = await vi.importActual<typeof import("@herbcaudill/beads-view")>(
    "@herbcaudill/beads-view",
  )
  return {
    ...actual,
    TaskDetailsController: ({
      task,
    }: {
      task: TaskCardTask
      open: boolean
      onClose: () => void
      onSave: (id: string, updates: Record<string, unknown>) => void
      onDelete: (id: string) => void
    }) => <div data-testid="task-details-controller">{task.title}</div>,
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
  }
})

const mockTask: TaskCardTask = {
  id: "test-task-1",
  title: "Test Task",
  status: "open",
  priority: 2,
}

describe("TaskDetailPanel", () => {
  describe("layout", () => {
    it("has a reasonable max-width constraint for readability", () => {
      const { container } = render(
        <TaskDetailPanel task={mockTask} open={true} onClose={vi.fn()} onChanged={vi.fn()} />,
      )

      // The outer wrapper div should have max-width constraint
      const wrapper = container.firstChild as HTMLElement
      expect(wrapper).toBeInTheDocument()

      // Check that the wrapper has max-width class (max-w-2xl = 42rem = 672px)
      expect(wrapper).toHaveClass("max-w-2xl")
    })

    it("centers the content horizontally", () => {
      const { container } = render(
        <TaskDetailPanel task={mockTask} open={true} onClose={vi.fn()} onChanged={vi.fn()} />,
      )

      const wrapper = container.firstChild as HTMLElement
      // mx-auto centers the content
      expect(wrapper).toHaveClass("mx-auto")
    })
  })

  describe("when task is not selected", () => {
    it("shows empty state when task is null", () => {
      render(<TaskDetailPanel task={null} open={true} onClose={vi.fn()} onChanged={vi.fn()} />)
      expect(screen.getByText("Select a task from the sidebar to view details.")).toBeInTheDocument()
    })

    it("shows empty state when not open", () => {
      render(<TaskDetailPanel task={mockTask} open={false} onClose={vi.fn()} onChanged={vi.fn()} />)
      expect(screen.getByText("Select a task from the sidebar to view details.")).toBeInTheDocument()
    })
  })

  describe("when task is selected", () => {
    it("renders the TaskDetailsController", () => {
      render(<TaskDetailPanel task={mockTask} open={true} onClose={vi.fn()} onChanged={vi.fn()} />)
      expect(screen.getByTestId("task-details-controller")).toBeInTheDocument()
    })
  })
})
