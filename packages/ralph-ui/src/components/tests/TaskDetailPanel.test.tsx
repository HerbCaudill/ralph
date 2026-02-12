import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { TaskDetailPanel } from "../TaskDetailPanel"
import type { TaskCardTask } from "@herbcaudill/beads-view"

// Mock beads-view TaskDetailsController
vi.mock("@herbcaudill/beads-view", () => ({
  TaskDetailsController: ({ task, open }: { task: TaskCardTask; open: boolean }) => {
    if (!open || !task) return null
    return (
      <div data-testid="task-details-controller">
        <h2>{task.title}</h2>
        <p>{task.description}</p>
      </div>
    )
  },
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
}))

const mockTask: TaskCardTask = {
  id: "task-123",
  title: "Test Task",
  description: "A test task description",
  status: "open",
  issue_type: "task",
  priority: 2,
}

describe("TaskDetailPanel", () => {
  it("renders empty state when no task is selected", () => {
    render(<TaskDetailPanel task={null} open={false} onClose={vi.fn()} onChanged={vi.fn()} />)

    expect(screen.getByText(/select a task/i)).toBeInTheDocument()
  })

  it("renders empty state when closed", () => {
    render(<TaskDetailPanel task={mockTask} open={false} onClose={vi.fn()} onChanged={vi.fn()} />)

    expect(screen.getByText(/select a task/i)).toBeInTheDocument()
  })

  it("renders TaskDetailsController when open with a task", () => {
    render(<TaskDetailPanel task={mockTask} open={true} onClose={vi.fn()} onChanged={vi.fn()} />)

    expect(screen.getByTestId("task-details-controller")).toBeInTheDocument()
    expect(screen.getByText("Test Task")).toBeInTheDocument()
  })

  it("does not render chat panel elements", () => {
    render(<TaskDetailPanel task={mockTask} open={true} onClose={vi.fn()} onChanged={vi.fn()} />)

    // Should NOT have chat-related UI
    expect(screen.queryByText(/task chat/i)).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/ask about this task/i)).not.toBeInTheDocument()
  })
})
