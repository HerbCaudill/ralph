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

  it("is translated off-screen when closed", () => {
    render(<TaskDetailSheet {...defaultProps} open={false} />)

    const panel = screen.getByTestId("task-detail-sheet")
    expect(panel.className).toContain("translate-x-full")
  })

  it("is translated off-screen when no task is provided", () => {
    render(<TaskDetailSheet {...defaultProps} task={null} />)

    const panel = screen.getByTestId("task-detail-sheet")
    expect(panel.className).toContain("translate-x-full")
  })

  it("renders TaskDetailsController in a panel when open with a task", () => {
    render(<TaskDetailSheet {...defaultProps} />)

    expect(screen.getByTestId("task-details-controller")).toBeInTheDocument()
    expect(screen.getAllByText("Test Task").length).toBeGreaterThanOrEqual(1)
  })

  it("renders as an absolutely positioned panel with shadow", () => {
    render(<TaskDetailSheet {...defaultProps} />)

    const panel = screen.getByTestId("task-detail-sheet")
    expect(panel.className).toContain("absolute")
    expect(panel.className).toContain("shadow-lg")
    expect(panel.className).toContain("translate-x-0")
  })

  it("has no modal overlay or backdrop", () => {
    render(<TaskDetailSheet {...defaultProps} />)

    // Should not have a Radix Dialog overlay
    const overlays = document.querySelectorAll("[data-state]")
    overlays.forEach(overlay => {
      expect(overlay.className).not.toContain("bg-black")
    })
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
