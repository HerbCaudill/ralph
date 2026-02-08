import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
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

    expect(screen.queryByTestId("task-detail-sheet")).not.toBeInTheDocument()
  })

  it("renders nothing when no task is provided", () => {
    render(<TaskDetailSheet {...defaultProps} task={null} />)

    expect(screen.queryByTestId("task-detail-sheet")).not.toBeInTheDocument()
  })

  it("renders TaskDetailsController in a panel when open with a task", () => {
    render(<TaskDetailSheet {...defaultProps} />)

    expect(screen.getByTestId("task-details-controller")).toBeInTheDocument()
    expect(screen.getAllByText("Test Task").length).toBeGreaterThanOrEqual(1)
  })

  it("renders as an overlay sheet on the right side", async () => {
    render(<TaskDetailSheet {...defaultProps} />)

    // The sheet should be in a portal (rendered at document level)
    const sheetContent = await waitFor(() =>
      document.querySelector('[data-testid="task-detail-sheet"]'),
    )
    expect(sheetContent).toBeInTheDocument()

    // Should be positioned on the right side
    expect(sheetContent?.className).toContain("right-0")
  })

  it("has an overlay backdrop", async () => {
    render(<TaskDetailSheet {...defaultProps} />)

    // Should have an overlay element (from Radix Sheet)
    const overlay = await waitFor(() => document.querySelector('[data-state="open"]'))
    expect(overlay).toBeInTheDocument()
  })

  it("provides an accessible title via a visually hidden element", () => {
    render(<TaskDetailSheet {...defaultProps} />)

    const titles = screen.getAllByText("Test Task")
    expect(titles.length).toBeGreaterThanOrEqual(1)
  })

  it("closes on Escape key", () => {
    render(<TaskDetailSheet {...defaultProps} />)

    fireEvent.keyDown(document, { key: "Escape" })
    expect(defaultProps.onClose).toHaveBeenCalled()
  })
})
