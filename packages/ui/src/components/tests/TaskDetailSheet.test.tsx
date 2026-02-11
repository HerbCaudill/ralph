import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { TaskDetailSheet } from "../TaskDetailSheet"
import { useUiStore } from "../../stores/uiStore"
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

  describe("resizable width", () => {
    beforeEach(() => {
      // Reset uiStore to default state before each test
      useUiStore.setState({
        issueSheetWidthPercent: 25,
      })
      // Mock window.innerWidth for consistent test results
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 1920,
      })
    })

    it("renders a resize handle on the right edge", () => {
      render(<TaskDetailSheet {...defaultProps} />)

      const handle = screen.getByTestId("issue-sheet-resize-handle")
      expect(handle).toBeInTheDocument()
      expect(handle).toHaveClass("cursor-col-resize")
    })

    it("uses persisted width from uiStore", () => {
      // Set a custom width in the store (30% of 1920px = 576px)
      useUiStore.setState({ issueSheetWidthPercent: 30 })

      render(<TaskDetailSheet {...defaultProps} />)

      const panel = screen.getByTestId("task-detail-sheet")
      expect(panel).toHaveStyle({ width: "576px" })
    })

    it("updates width while dragging", () => {
      render(<TaskDetailSheet {...defaultProps} />)

      const handle = screen.getByTestId("issue-sheet-resize-handle")
      const panel = screen.getByTestId("task-detail-sheet")

      // Initial width: 25% of 1920px = 480px
      expect(panel).toHaveStyle({ width: "480px" })

      // Start dragging
      fireEvent.mouseDown(handle, { clientX: 480 })

      // Drag to new position (600px from left edge of sheet)
      fireEvent.mouseMove(document, { clientX: 600 })

      // Width should update to 600px
      expect(panel).toHaveStyle({ width: "600px" })
    })

    it("persists width to uiStore on mouse up", () => {
      render(<TaskDetailSheet {...defaultProps} />)

      const handle = screen.getByTestId("issue-sheet-resize-handle")

      // Start dragging
      fireEvent.mouseDown(handle, { clientX: 480 })

      // Drag to new position (600px)
      fireEvent.mouseMove(document, { clientX: 600 })

      // Release
      fireEvent.mouseUp(document)

      // Store should be updated (600/1920 * 100 ≈ 31.25%)
      const { issueSheetWidthPercent } = useUiStore.getState()
      expect(issueSheetWidthPercent).toBeCloseTo(31.25, 1)
    })

    it("enforces minimum width constraint", () => {
      render(<TaskDetailSheet {...defaultProps} />)

      const handle = screen.getByTestId("issue-sheet-resize-handle")
      const panel = screen.getByTestId("task-detail-sheet")

      // Start dragging
      fireEvent.mouseDown(handle, { clientX: 480 })

      // Try to drag below minimum (100px, below MIN_ISSUE_SHEET_WIDTH of 300px)
      fireEvent.mouseMove(document, { clientX: 100 })

      // Width should be constrained to minimum
      expect(panel).toHaveStyle({ width: "300px" })
    })

    it("enforces maximum width constraint", () => {
      render(<TaskDetailSheet {...defaultProps} />)

      const handle = screen.getByTestId("issue-sheet-resize-handle")
      const panel = screen.getByTestId("task-detail-sheet")

      // Start dragging
      fireEvent.mouseDown(handle, { clientX: 480 })

      // Try to drag beyond maximum (1500px, above MAX_ISSUE_SHEET_WIDTH_PERCENT of 60%)
      fireEvent.mouseMove(document, { clientX: 1500 })

      // Width should be constrained to maximum (60% of 1920px = 1152px)
      expect(panel).toHaveStyle({ width: "1152px" })
    })

    it("continues resizing when mouse leaves the panel", () => {
      render(<TaskDetailSheet {...defaultProps} />)

      const handle = screen.getByTestId("issue-sheet-resize-handle")
      const panel = screen.getByTestId("task-detail-sheet")

      // Initial width: 25% of 1920px = 480px
      expect(panel).toHaveStyle({ width: "480px" })

      // Start dragging
      fireEvent.mouseDown(handle, { clientX: 480 })

      // Move mouse outside the panel (on document, not on panel)
      fireEvent.mouseMove(document, { clientX: 700 })

      // Width should still update even though mouse left the panel
      expect(panel).toHaveStyle({ width: "700px" })
    })

    it("completes resize when mouseup occurs outside the panel", () => {
      render(<TaskDetailSheet {...defaultProps} />)

      const handle = screen.getByTestId("issue-sheet-resize-handle")

      // Start dragging
      fireEvent.mouseDown(handle, { clientX: 480 })

      // Move mouse outside panel
      fireEvent.mouseMove(document, { clientX: 700 })

      // Release mouse outside panel (on document)
      fireEvent.mouseUp(document)

      // Store should be updated (700/1920 * 100 ≈ 36.46%)
      const { issueSheetWidthPercent } = useUiStore.getState()
      expect(issueSheetWidthPercent).toBeCloseTo(36.46, 0)
    })

    it("cleans up document event listeners after mouseup", () => {
      const addSpy = vi.spyOn(document, "addEventListener")
      const removeSpy = vi.spyOn(document, "removeEventListener")

      render(<TaskDetailSheet {...defaultProps} />)

      const handle = screen.getByTestId("issue-sheet-resize-handle")

      // Start dragging - should add document listeners
      fireEvent.mouseDown(handle, { clientX: 480 })

      const mousemoveCalls = addSpy.mock.calls.filter(([type]) => type === "mousemove")
      const mouseupCalls = addSpy.mock.calls.filter(([type]) => type === "mouseup")
      expect(mousemoveCalls.length).toBeGreaterThanOrEqual(1)
      expect(mouseupCalls.length).toBeGreaterThanOrEqual(1)

      // Release - should remove document listeners
      fireEvent.mouseUp(document)

      const removeMoveCalls = removeSpy.mock.calls.filter(([type]) => type === "mousemove")
      const removeUpCalls = removeSpy.mock.calls.filter(([type]) => type === "mouseup")
      expect(removeMoveCalls.length).toBeGreaterThanOrEqual(1)
      expect(removeUpCalls.length).toBeGreaterThanOrEqual(1)

      addSpy.mockRestore()
      removeSpy.mockRestore()
    })

    it("clamps stored width to valid bounds on load", () => {
      // Set an out-of-bounds width (e.g. 90%, well above MAX of 60%)
      useUiStore.setState({ issueSheetWidthPercent: 90 })

      render(<TaskDetailSheet {...defaultProps} />)

      const panel = screen.getByTestId("task-detail-sheet")
      // Should be clamped to MAX (60% of 1920 = 1152px)
      const width = parseInt(panel.style.width)
      expect(width).toBeLessThanOrEqual(1152)
    })

    it("does not call onClose when clicking on resize handle", async () => {
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

      const handle = screen.getByTestId("issue-sheet-resize-handle")
      fireEvent.mouseDown(handle)

      expect(defaultProps.onClose).not.toHaveBeenCalled()
    })
  })
})
