import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useTaskDialogRouter } from "./useTaskDialogRouter"
import { parseTaskIdFromUrl } from "../lib/parseTaskIdFromUrl"
import { buildTaskIdPath } from "../lib/buildTaskIdPath"
import { parseTaskIdHash } from "../lib/parseTaskIdHash"
import { buildTaskIdHash } from "../lib/buildTaskIdHash"
import type { UseTaskDialogResult } from "./useTaskDialog"

describe("parseTaskIdFromUrl", () => {
  it("returns null for root path with no hash", () => {
    expect(parseTaskIdFromUrl({ pathname: "/", hash: "" })).toBeNull()
    expect(parseTaskIdFromUrl({ pathname: "/", hash: "#" })).toBeNull()
  })

  it("parses task ID from path-based URL", () => {
    expect(parseTaskIdFromUrl({ pathname: "/issue/r-abc1", hash: "" })).toBe("r-abc1")
    expect(parseTaskIdFromUrl({ pathname: "/issue/r-xyz99", hash: "" })).toBe("r-xyz99")
    expect(parseTaskIdFromUrl({ pathname: "/issue/r-ABCD", hash: "" })).toBe("r-ABCD")
    expect(parseTaskIdFromUrl({ pathname: "/issue/r-3kp6", hash: "" })).toBe("r-3kp6")
  })

  it("parses subtask ID from path-based URL", () => {
    expect(parseTaskIdFromUrl({ pathname: "/issue/r-abc1.1", hash: "" })).toBe("r-abc1.1")
    expect(parseTaskIdFromUrl({ pathname: "/issue/r-xyz99.42", hash: "" })).toBe("r-xyz99.42")
    expect(parseTaskIdFromUrl({ pathname: "/issue/r-ehii.5", hash: "" })).toBe("r-ehii.5")
  })

  it("returns null for invalid path format", () => {
    expect(parseTaskIdFromUrl({ pathname: "/issues/r-abc1", hash: "" })).toBeNull()
    expect(parseTaskIdFromUrl({ pathname: "/issue", hash: "" })).toBeNull()
    expect(parseTaskIdFromUrl({ pathname: "/issue/", hash: "" })).toBeNull()
    expect(parseTaskIdFromUrl({ pathname: "/task/r-abc1", hash: "" })).toBeNull()
  })

  it("returns null for invalid task ID format in path", () => {
    // Missing prefix-
    expect(parseTaskIdFromUrl({ pathname: "/issue/abc123", hash: "" })).toBeNull()
    // Missing alphanumeric after prefix-
    expect(parseTaskIdFromUrl({ pathname: "/issue/r-", hash: "" })).toBeNull()
  })

  // Legacy hash format support
  it("parses task ID from legacy hash format", () => {
    expect(parseTaskIdFromUrl({ pathname: "/", hash: "#id=r-abc1" })).toBe("r-abc1")
    expect(parseTaskIdFromUrl({ pathname: "/", hash: "#id=r-xyz99.5" })).toBe("r-xyz99.5")
  })

  it("prefers path over hash when both present", () => {
    // Path takes precedence
    expect(parseTaskIdFromUrl({ pathname: "/issue/r-path1", hash: "#id=r-hash1" })).toBe("r-path1")
  })
})

describe("buildTaskIdPath", () => {
  it("builds a valid path string", () => {
    expect(buildTaskIdPath("r-abc1")).toBe("/issue/r-abc1")
    expect(buildTaskIdPath("r-xyz99.5")).toBe("/issue/r-xyz99.5")
  })
})

// Legacy function tests for backwards compatibility
describe("parseTaskIdHash (legacy)", () => {
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
    // Missing prefix-
    expect(parseTaskIdHash("#id=abc123")).toBeNull()
    // Empty ID
    expect(parseTaskIdHash("#id=")).toBeNull()
    // Invalid characters
    expect(parseTaskIdHash("#id=r-abc_123")).toBeNull()
    // Missing alphanumeric after prefix-
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

describe("buildTaskIdHash (legacy)", () => {
  it("builds a valid hash string", () => {
    expect(buildTaskIdHash("r-abc1")).toBe("#id=r-abc1")
    expect(buildTaskIdHash("r-xyz99.5")).toBe("#id=r-xyz99.5")
  })
})

describe("useTaskDialogRouter", () => {
  // Store original values
  let originalPathname: string
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
    originalPathname = window.location.pathname
    originalHash = window.location.hash
    originalPushState = window.history.pushState

    // Reset to root
    window.history.pushState(null, "", "/")
  })

  afterEach(() => {
    // Restore original URL
    window.history.pushState(null, "", originalPathname + originalHash)
    window.history.pushState = originalPushState
  })

  it("returns navigateToTask and closeTaskDialog functions", () => {
    const mockTaskDialog = createMockTaskDialog()
    const { result } = renderHook(() => useTaskDialogRouter({ taskDialog: mockTaskDialog }))

    expect(result.current.navigateToTask).toBeInstanceOf(Function)
    expect(result.current.closeTaskDialog).toBeInstanceOf(Function)
  })

  it("navigateToTask updates the URL path", () => {
    const mockTaskDialog = createMockTaskDialog()
    const { result } = renderHook(() => useTaskDialogRouter({ taskDialog: mockTaskDialog }))

    act(() => {
      result.current.navigateToTask("r-abc1")
    })

    expect(window.location.pathname).toBe("/issue/r-abc1")
  })

  it("closeTaskDialog clears the URL and closes dialog", () => {
    window.history.pushState(null, "", "/issue/r-abc1")
    window.history.pushState = vi.fn()

    const mockTaskDialog = createMockTaskDialog()
    const { result } = renderHook(() => useTaskDialogRouter({ taskDialog: mockTaskDialog }))

    act(() => {
      result.current.closeTaskDialog()
    })

    expect(window.history.pushState).toHaveBeenCalled()
    expect(mockTaskDialog.closeDialog).toHaveBeenCalled()
  })

  it("parses task ID from path URL on mount and opens dialog", async () => {
    window.history.pushState(null, "", "/issue/r-abc1")

    const mockTaskDialog = createMockTaskDialog()
    renderHook(() => useTaskDialogRouter({ taskDialog: mockTaskDialog }))

    await waitFor(() => {
      expect(mockTaskDialog.openDialogById).toHaveBeenCalledWith("r-abc1")
    })
  })

  it("parses subtask ID from path URL on mount", async () => {
    window.history.pushState(null, "", "/issue/r-abc1.5")

    const mockTaskDialog = createMockTaskDialog()
    renderHook(() => useTaskDialogRouter({ taskDialog: mockTaskDialog }))

    await waitFor(() => {
      expect(mockTaskDialog.openDialogById).toHaveBeenCalledWith("r-abc1.5")
    })
  })

  // Legacy hash support
  it("parses task ID from legacy hash URL on mount and opens dialog", async () => {
    window.location.hash = "#id=r-abc1"

    const mockTaskDialog = createMockTaskDialog()
    renderHook(() => useTaskDialogRouter({ taskDialog: mockTaskDialog }))

    await waitFor(() => {
      expect(mockTaskDialog.openDialogById).toHaveBeenCalledWith("r-abc1")
    })
  })

  it("responds to popstate events (back/forward navigation)", async () => {
    const mockTaskDialog = createMockTaskDialog()
    renderHook(() => useTaskDialogRouter({ taskDialog: mockTaskDialog }))

    // Initially no task
    expect(mockTaskDialog.openDialogById).not.toHaveBeenCalled()

    // Simulate navigation to a task (e.g., via back/forward)
    act(() => {
      window.history.pushState(null, "", "/issue/r-xyz99")
      window.dispatchEvent(new PopStateEvent("popstate"))
    })

    await waitFor(() => {
      expect(mockTaskDialog.openDialogById).toHaveBeenCalledWith("r-xyz99")
    })
  })

  it("responds to hashchange events for legacy URLs", async () => {
    const mockTaskDialog = createMockTaskDialog()
    renderHook(() => useTaskDialogRouter({ taskDialog: mockTaskDialog }))

    // Initially no task
    expect(mockTaskDialog.openDialogById).not.toHaveBeenCalled()

    // Change hash (legacy format)
    act(() => {
      window.location.hash = "#id=r-xyz99"
      window.dispatchEvent(new HashChangeEvent("hashchange"))
    })

    await waitFor(() => {
      expect(mockTaskDialog.openDialogById).toHaveBeenCalledWith("r-xyz99")
    })
  })

  it("closes dialog when URL path is cleared", async () => {
    window.history.pushState(null, "", "/issue/r-abc1")

    const mockTaskDialog = createMockTaskDialog({ isOpen: true })
    renderHook(() => useTaskDialogRouter({ taskDialog: mockTaskDialog }))

    // Wait for initial open
    await waitFor(() => {
      expect(mockTaskDialog.openDialogById).toHaveBeenCalledWith("r-abc1")
    })

    // Navigate to root
    act(() => {
      window.history.pushState(null, "", "/")
      window.dispatchEvent(new PopStateEvent("popstate"))
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
      expect(window.location.pathname).toBe("/issue/r-def4")
    })
  })

  it("clears URL when dialog is closed via other means", async () => {
    window.history.pushState(null, "", "/issue/r-abc1")
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

  it("does not update URL if path already matches", async () => {
    window.history.pushState(null, "", "/issue/r-abc1")
    const pushStateSpy = vi.fn()
    window.history.pushState = pushStateSpy

    const mockTask = {
      id: "r-abc1",
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

    // Wait a tick to ensure any updates would have happened
    await waitFor(() => {
      // pushState should not have been called since URL already matches
      expect(pushStateSpy).not.toHaveBeenCalled()
    })
  })
})
