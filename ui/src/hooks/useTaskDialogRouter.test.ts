import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useTaskDialogRouter, parseTaskIdHash, buildTaskIdHash } from "./useTaskDialogRouter"
import type { UseTaskDialogResult } from "./useTaskDialog"

describe("parseTaskIdHash", () => {
  it("returns null for empty hash", () => {
    expect(parseTaskIdHash("")).toBeNull()
    expect(parseTaskIdHash("#")).toBeNull()
  })

  it("returns null for hash without id prefix", () => {
    expect(parseTaskIdHash("#something")).toBeNull()
    expect(parseTaskIdHash("#eventlog=123")).toBeNull()
    expect(parseTaskIdHash("#task=123")).toBeNull()
  })

  it("returns null for invalid task ID format", () => {
    // Missing r- prefix
    expect(parseTaskIdHash("#id=abc123")).toBeNull()
    // Empty ID
    expect(parseTaskIdHash("#id=")).toBeNull()
    // Invalid characters
    expect(parseTaskIdHash("#id=r-abc_123")).toBeNull()
    // Missing alphanumeric after r-
    expect(parseTaskIdHash("#id=r-")).toBeNull()
  })

  it("returns ID for valid task hash", () => {
    expect(parseTaskIdHash("#id=r-abc1")).toBe("r-abc1")
    expect(parseTaskIdHash("#id=r-xyz99")).toBe("r-xyz99")
    expect(parseTaskIdHash("#id=r-ABCD")).toBe("r-ABCD")
    expect(parseTaskIdHash("#id=r-3kp6")).toBe("r-3kp6")
  })

  it("returns ID for valid subtask hash", () => {
    expect(parseTaskIdHash("#id=r-abc1.1")).toBe("r-abc1.1")
    expect(parseTaskIdHash("#id=r-xyz99.42")).toBe("r-xyz99.42")
    expect(parseTaskIdHash("#id=r-ehii.5")).toBe("r-ehii.5")
  })

  it("handles hash with leading # already removed", () => {
    expect(parseTaskIdHash("id=r-abc1")).toBe("r-abc1")
  })
})

describe("buildTaskIdHash", () => {
  it("builds a valid hash string", () => {
    expect(buildTaskIdHash("r-abc1")).toBe("#id=r-abc1")
    expect(buildTaskIdHash("r-xyz99.5")).toBe("#id=r-xyz99.5")
  })
})

describe("useTaskDialogRouter", () => {
  // Store the original window.location.hash
  let originalHash: string
  let originalPushState: typeof window.history.pushState

  // Mock task dialog controller
  const createMockTaskDialog = (
    overrides: Partial<UseTaskDialogResult> = {},
  ): UseTaskDialogResult => ({
    selectedTask: null,
    isOpen: false,
    isUpdating: false,
    isLoading: false,
    error: null,
    openDialog: vi.fn(),
    openDialogById: vi.fn().mockResolvedValue(undefined),
    closeDialog: vi.fn(),
    saveTask: vi.fn().mockResolvedValue(undefined),
    deleteTask: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  })

  beforeEach(() => {
    originalHash = window.location.hash
    originalPushState = window.history.pushState

    // Clear the hash first
    window.history.pushState(null, "", window.location.pathname + window.location.search)
  })

  afterEach(() => {
    // Restore window.location.hash
    window.history.pushState(
      null,
      "",
      window.location.pathname + window.location.search + originalHash,
    )
    window.history.pushState = originalPushState
  })

  it("returns navigateToTask and closeTaskDialog functions", () => {
    const mockTaskDialog = createMockTaskDialog()
    const { result } = renderHook(() => useTaskDialogRouter({ taskDialog: mockTaskDialog }))

    expect(result.current.navigateToTask).toBeInstanceOf(Function)
    expect(result.current.closeTaskDialog).toBeInstanceOf(Function)
  })

  it("navigateToTask updates the URL hash", () => {
    const mockTaskDialog = createMockTaskDialog()
    const { result } = renderHook(() => useTaskDialogRouter({ taskDialog: mockTaskDialog }))

    act(() => {
      result.current.navigateToTask("r-abc1")
    })

    expect(window.location.hash).toBe("#id=r-abc1")
  })

  it("closeTaskDialog clears the URL hash and closes dialog", () => {
    window.location.hash = "#id=r-abc1"
    window.history.pushState = vi.fn()

    const mockTaskDialog = createMockTaskDialog()
    const { result } = renderHook(() => useTaskDialogRouter({ taskDialog: mockTaskDialog }))

    act(() => {
      result.current.closeTaskDialog()
    })

    expect(window.history.pushState).toHaveBeenCalled()
    expect(mockTaskDialog.closeDialog).toHaveBeenCalled()
  })

  it("parses task ID from URL on mount and opens dialog", async () => {
    window.location.hash = "#id=r-abc1"

    const mockTaskDialog = createMockTaskDialog()
    renderHook(() => useTaskDialogRouter({ taskDialog: mockTaskDialog }))

    await waitFor(() => {
      expect(mockTaskDialog.openDialogById).toHaveBeenCalledWith("r-abc1")
    })
  })

  it("parses subtask ID from URL on mount", async () => {
    window.location.hash = "#id=r-abc1.5"

    const mockTaskDialog = createMockTaskDialog()
    renderHook(() => useTaskDialogRouter({ taskDialog: mockTaskDialog }))

    await waitFor(() => {
      expect(mockTaskDialog.openDialogById).toHaveBeenCalledWith("r-abc1.5")
    })
  })

  it("responds to hashchange events", async () => {
    const mockTaskDialog = createMockTaskDialog()
    renderHook(() => useTaskDialogRouter({ taskDialog: mockTaskDialog }))

    // Initially no task
    expect(mockTaskDialog.openDialogById).not.toHaveBeenCalled()

    // Change hash
    act(() => {
      window.location.hash = "#id=r-xyz99"
      window.dispatchEvent(new HashChangeEvent("hashchange"))
    })

    await waitFor(() => {
      expect(mockTaskDialog.openDialogById).toHaveBeenCalledWith("r-xyz99")
    })
  })

  it("closes dialog when hash is removed", async () => {
    window.location.hash = "#id=r-abc1"

    const mockTaskDialog = createMockTaskDialog({ isOpen: true })
    renderHook(() => useTaskDialogRouter({ taskDialog: mockTaskDialog }))

    // Wait for initial open
    await waitFor(() => {
      expect(mockTaskDialog.openDialogById).toHaveBeenCalledWith("r-abc1")
    })

    // Clear the hash
    act(() => {
      window.history.pushState(null, "", window.location.pathname + window.location.search)
      window.dispatchEvent(new HashChangeEvent("hashchange"))
    })

    await waitFor(() => {
      expect(mockTaskDialog.closeDialog).toHaveBeenCalled()
    })
  })

  it("updates URL when dialog is opened by clicking a task", async () => {
    const mockTask = {
      id: "r-def4",
      title: "Test Task",
      status: "open" as const,
      priority: 2,
      issue_type: "task",
    }

    const mockTaskDialog = createMockTaskDialog({
      isOpen: true,
      selectedTask: mockTask,
    })

    renderHook(() => useTaskDialogRouter({ taskDialog: mockTaskDialog }))

    // URL should be updated to match the open task
    await waitFor(() => {
      expect(window.location.hash).toBe("#id=r-def4")
    })
  })

  it("clears URL when dialog is closed via other means", async () => {
    window.location.hash = "#id=r-abc1"
    window.history.pushState = vi.fn()

    // Start with dialog open
    const mockTaskDialog = createMockTaskDialog({
      isOpen: true,
      selectedTask: {
        id: "r-abc1",
        title: "Test",
        status: "open",
        priority: 2,
        issue_type: "task",
      },
    })

    const { rerender } = renderHook(({ taskDialog }) => useTaskDialogRouter({ taskDialog }), {
      initialProps: { taskDialog: mockTaskDialog },
    })

    // Now close the dialog
    const closedTaskDialog = createMockTaskDialog({
      isOpen: false,
      selectedTask: null,
    })

    rerender({ taskDialog: closedTaskDialog })

    await waitFor(() => {
      expect(window.history.pushState).toHaveBeenCalled()
    })
  })

  it("does not update URL if hash already matches", async () => {
    window.location.hash = "#id=r-abc1"
    const originalAssign = window.location.hash

    const mockTask = {
      id: "r-abc1",
      title: "Test Task",
      status: "open" as const,
      priority: 2,
      type: "task" as const,
    }

    const mockTaskDialog = createMockTaskDialog({
      isOpen: true,
      selectedTask: mockTask,
    })

    renderHook(() => useTaskDialogRouter({ taskDialog: mockTaskDialog }))

    // Hash should still be the same
    expect(window.location.hash).toBe(originalAssign)
  })
})
