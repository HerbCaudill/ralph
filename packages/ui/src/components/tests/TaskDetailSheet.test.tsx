import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
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

  afterEach(() => {
    vi.restoreAllMocks()
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

  it("renders as a slide-out panel without a dark overlay", () => {
    render(<TaskDetailSheet {...defaultProps} />)

    const panel = screen.getByTestId("task-detail-sheet")
    expect(panel).toBeInTheDocument()

    // Should NOT have a dark overlay/backdrop element
    expect(document.querySelector("[data-sheet-overlay]")).not.toBeInTheDocument()
    // No Radix overlay
    expect(document.querySelector("[data-state]")).not.toBeInTheDocument()
  })

  it("renders as an absolutely positioned panel anchored to the left", () => {
    render(<TaskDetailSheet {...defaultProps} />)

    const panel = screen.getByTestId("task-detail-sheet")
    expect(panel).toBeInTheDocument()

    // Should be absolutely positioned, anchored to left edge of its container
    // (the right panel wrapper in MainLayout) so it slides out rightward
    expect(panel.className).toContain("absolute")
    expect(panel.className).toContain("left-0")
  })

  it("contains content without clipping (delegates scrolling to child)", () => {
    render(<TaskDetailSheet {...defaultProps} />)

    const panel = screen.getByTestId("task-detail-sheet")
    expect(panel).toBeInTheDocument()

    // The outer panel should have overflow-hidden to contain its child.
    // The TaskDetails component inside handles its own scrolling via flex layout
    // with a flex-1 scrollable content area. Having overflow-y-auto on both
    // the outer container and inner content causes clipping issues.
    expect(panel.className).toContain("overflow-hidden")
    expect(panel.className).not.toContain("overflow-y-auto")
  })

  it("does not render a modal backdrop", () => {
    const { container } = render(<TaskDetailSheet {...defaultProps} />)

    // There should be no overlay element with opacity or backdrop styles
    const overlays = container.querySelectorAll("[data-state]")
    expect(overlays.length).toBe(0)
  })

  it("closes on Escape key", () => {
    render(<TaskDetailSheet {...defaultProps} />)

    fireEvent.keyDown(document, { key: "Escape" })
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it("calls onClose when clicking outside the panel", async () => {
    render(
      <div>
        <div data-testid="outside">Outside content</div>
        <TaskDetailSheet {...defaultProps} />
      </div>,
    )

    // Wait for the outside-click listener to be attached (delayed by 100ms)
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150))
    })

    const outside = screen.getByTestId("outside")
    fireEvent.mouseDown(outside)

    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it("does not call onClose when clicking inside the panel", async () => {
    render(
      <div>
        <div data-testid="outside">Outside content</div>
        <TaskDetailSheet {...defaultProps} />
      </div>,
    )

    // Wait for the outside-click listener to be attached
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150))
    })

    const panel = screen.getByTestId("task-detail-sheet")
    fireEvent.mouseDown(panel)

    expect(defaultProps.onClose).not.toHaveBeenCalled()
  })

  it("does not call onClose when clicking inside a Radix portal", async () => {
    // Create a mock Radix portal element outside the panel
    const portalElement = document.createElement("div")
    portalElement.setAttribute("data-radix-popper-content-wrapper", "")
    portalElement.innerHTML = "<div>Portal Content</div>"
    document.body.appendChild(portalElement)

    render(<TaskDetailSheet {...defaultProps} />)

    // Wait for the outside-click listener to be attached
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150))
    })

    const portalContent = portalElement.querySelector("div")!
    fireEvent.mouseDown(portalContent)

    expect(defaultProps.onClose).not.toHaveBeenCalled()

    // Cleanup
    document.body.removeChild(portalElement)
  })
})
