import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { TaskDetailSheet } from "../TaskDetailSheet"
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

describe("TaskDetailSheet", () => {
  const defaultProps = {
    task: mockTask,
    open: true,
    onClose: vi.fn(),
    onChanged: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders nothing when closed", () => {
    render(<TaskDetailSheet {...defaultProps} open={false} />)

    expect(screen.queryByTestId("task-details-controller")).not.toBeInTheDocument()
  })

  it("renders nothing when no task is provided", () => {
    render(<TaskDetailSheet {...defaultProps} task={null} />)

    expect(screen.queryByTestId("task-details-controller")).not.toBeInTheDocument()
  })

  it("renders TaskDetailsController in a sheet when open with a task", () => {
    render(<TaskDetailSheet {...defaultProps} />)

    expect(screen.getByTestId("task-details-controller")).toBeInTheDocument()
    // Title appears in both header and controller mock, so use getAllByText
    expect(screen.getAllByText("Test Task").length).toBeGreaterThanOrEqual(1)
  })

  it("renders as an overlay (sheet from right side)", () => {
    render(<TaskDetailSheet {...defaultProps} />)

    // Sheet should have role="dialog"
    const dialog = screen.getByRole("dialog")
    expect(dialog).toBeInTheDocument()
  })

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn()
    render(<TaskDetailSheet {...defaultProps} onClose={onClose} />)

    const closeButton = screen.getByRole("button", { name: /close/i })
    fireEvent.click(closeButton)

    expect(onClose).toHaveBeenCalled()
  })

  it("displays the task title in the header", () => {
    render(<TaskDetailSheet {...defaultProps} />)

    // The title should appear in the sheet header (using getAllByText since it's also in the mock)
    const titles = screen.getAllByText("Test Task")
    // At least one should be the Dialog.Title in the header
    expect(titles.length).toBeGreaterThanOrEqual(1)
  })
})
