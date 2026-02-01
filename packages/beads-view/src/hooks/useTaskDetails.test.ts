import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useTaskDetails } from "./useTaskDetails"
import { beadsViewStore } from "../store"
import type { TaskCardTask } from "../types"

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock linkSessionToTask
vi.mock("../lib/linkSessionToTask", () => ({
  linkSessionToTask: vi.fn().mockResolvedValue(undefined),
}))

describe("useTaskDetails", () => {
  const mockTask: TaskCardTask = {
    id: "task-123",
    title: "Test Task",
    description: "Test description",
    status: "open",
    priority: 2,
    issue_type: "task",
    parent: undefined,
    labels: ["label1"],
  }

  const mockTask2: TaskCardTask = {
    id: "task-456",
    title: "Another Task",
    description: "Another description",
    status: "in_progress",
    priority: 1,
    issue_type: "bug",
    parent: undefined,
    labels: [],
  }

  const defaultOptions = {
    task: mockTask,
    open: true,
    onClose: vi.fn(),
  }

  beforeEach(() => {
    mockFetch.mockReset()
    vi.useFakeTimers()
    // Reset store
    beadsViewStore.setState({
      tasks: [],
      issuePrefix: "TEST",
    })
    // Default mock for labels fetch
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, labels: ["label1"] }),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe("form state reset behavior (bug fix)", () => {
    it("resets form state when task ID changes", () => {
      const onClose = vi.fn()
      const { result, rerender } = renderHook(
        ({ task, open }) => useTaskDetails({ task, open, onClose }),
        { initialProps: { task: mockTask, open: true } },
      )

      // Initial form values from mockTask
      expect(result.current.formValues.title).toBe("Test Task")
      expect(result.current.formValues.description).toBe("Test description")
      expect(result.current.formValues.status).toBe("open")

      // User edits the title
      act(() => {
        result.current.updateTitle("User Edited Title")
      })

      expect(result.current.formValues.title).toBe("User Edited Title")

      // Switch to a different task (different ID)
      rerender({ task: mockTask2, open: true })

      // Form should reset to the new task's values
      expect(result.current.formValues.title).toBe("Another Task")
      expect(result.current.formValues.description).toBe("Another description")
      expect(result.current.formValues.status).toBe("in_progress")
    })

    it("resets form state when dialog opens (open transitions from false to true)", () => {
      const onClose = vi.fn()
      const { result, rerender } = renderHook(
        ({ task, open }) => useTaskDetails({ task, open, onClose }),
        { initialProps: { task: mockTask, open: true } },
      )

      // User edits the title
      act(() => {
        result.current.updateTitle("User Edited Title")
      })

      expect(result.current.formValues.title).toBe("User Edited Title")

      // Close the dialog
      rerender({ task: mockTask, open: false })

      // Form values should still be there (dialog just closed)
      expect(result.current.formValues.title).toBe("User Edited Title")

      // Create an updated task with different server values (simulating server update)
      const updatedTask: TaskCardTask = {
        ...mockTask,
        title: "Server Updated Title",
        description: "Server updated description",
      }

      // Reopen the dialog - should reset to task's values
      rerender({ task: updatedTask, open: true })

      // Form should reset to task values when opening
      expect(result.current.formValues.title).toBe("Server Updated Title")
      expect(result.current.formValues.description).toBe("Server updated description")
    })

    it("does NOT reset form state when task object reference changes but ID remains the same (polling update)", () => {
      const onClose = vi.fn()
      const { result, rerender } = renderHook(
        ({ task, open }) => useTaskDetails({ task, open, onClose }),
        { initialProps: { task: mockTask, open: true } },
      )

      // Initial form values
      expect(result.current.formValues.title).toBe("Test Task")

      // User edits the title
      act(() => {
        result.current.updateTitle("User Edited Title")
      })

      expect(result.current.formValues.title).toBe("User Edited Title")

      // Simulate a polling update - new object reference, same ID, potentially different data from server
      const pollingUpdatedTask: TaskCardTask = {
        ...mockTask,
        title: "Server Updated Title", // Server has different title
        description: "Server updated description",
      }

      // Rerender with the polling-updated task (same ID, new object reference)
      rerender({ task: pollingUpdatedTask, open: true })

      // CRITICAL: Form should NOT reset - user's edits should be preserved
      expect(result.current.formValues.title).toBe("User Edited Title")
      // Other unchanged fields should still have user's previous values
      expect(result.current.formValues.description).toBe("Test description")
    })

    it("does NOT reset form state on multiple polling updates while editing", () => {
      const onClose = vi.fn()
      const { result, rerender } = renderHook(
        ({ task, open }) => useTaskDetails({ task, open, onClose }),
        { initialProps: { task: mockTask, open: true } },
      )

      // User makes several edits
      act(() => {
        result.current.updateTitle("My Custom Title")
        result.current.updateDescription("My custom description")
        result.current.updatePriority(1)
      })

      expect(result.current.formValues.title).toBe("My Custom Title")
      expect(result.current.formValues.description).toBe("My custom description")
      expect(result.current.formValues.priority).toBe(1)

      // Multiple polling updates (same ID, different object references)
      for (let i = 0; i < 5; i++) {
        const pollingTask: TaskCardTask = {
          ...mockTask,
          title: `Server Title ${i}`,
          description: `Server description ${i}`,
          priority: i + 3,
        }
        rerender({ task: pollingTask, open: true })
      }

      // User's edits should STILL be preserved after all polling updates
      expect(result.current.formValues.title).toBe("My Custom Title")
      expect(result.current.formValues.description).toBe("My custom description")
      expect(result.current.formValues.priority).toBe(1)
    })

    it("resets form state when switching from one task to another task", () => {
      const onClose = vi.fn()
      const { result, rerender } = renderHook(
        ({ task, open }) => useTaskDetails({ task, open, onClose }),
        { initialProps: { task: mockTask, open: true } },
      )

      // User edits task 1
      act(() => {
        result.current.updateTitle("Edited Task 1")
      })

      expect(result.current.formValues.title).toBe("Edited Task 1")

      // Switch to task 2 (different ID)
      rerender({ task: mockTask2, open: true })

      // Should have task 2's values
      expect(result.current.formValues.title).toBe("Another Task")
      expect(result.current.formValues.status).toBe("in_progress")

      // Edit task 2
      act(() => {
        result.current.updateTitle("Edited Task 2")
      })

      // Switch back to task 1 (different ID again)
      rerender({ task: mockTask, open: true })

      // Should reset to task 1's original values (not the edited ones from before)
      expect(result.current.formValues.title).toBe("Test Task")
      expect(result.current.formValues.status).toBe("open")
    })

    it("preserves form edits when dialog stays open and task ID is unchanged", () => {
      const onClose = vi.fn()
      const { result, rerender } = renderHook(
        ({ task, open }) => useTaskDetails({ task, open, onClose }),
        { initialProps: { task: mockTask, open: true } },
      )

      // User makes extensive edits
      act(() => {
        result.current.updateTitle("Completely New Title")
        result.current.updateDescription("Brand new description")
        result.current.updateStatus("in_progress")
        result.current.updatePriority(1)
        result.current.updateIssueType("bug")
      })

      // Verify all edits are in place
      expect(result.current.formValues).toEqual({
        title: "Completely New Title",
        description: "Brand new description",
        status: "in_progress",
        priority: 1,
        issueType: "bug",
        parent: null,
      })

      // Polling update with same ID but server's stale data
      const stalePollingTask: TaskCardTask = {
        ...mockTask, // same ID
        title: "Stale Server Title",
        description: "Stale server description",
        status: "open",
        priority: 2,
        issue_type: "task",
      }

      rerender({ task: stalePollingTask, open: true })

      // All user edits should be preserved
      expect(result.current.formValues).toEqual({
        title: "Completely New Title",
        description: "Brand new description",
        status: "in_progress",
        priority: 1,
        issueType: "bug",
        parent: null,
      })
    })

    it("resets form state when opening dialog after it was closed (even with same task)", () => {
      const onClose = vi.fn()
      const { result, rerender } = renderHook(
        ({ task, open }) => useTaskDetails({ task, open, onClose }),
        { initialProps: { task: mockTask, open: true } },
      )

      // User edits
      act(() => {
        result.current.updateTitle("User Edit")
      })

      expect(result.current.formValues.title).toBe("User Edit")

      // Close dialog
      rerender({ task: mockTask, open: false })

      // Update the task (simulating server-side changes while dialog was closed)
      const serverUpdatedTask: TaskCardTask = {
        ...mockTask,
        title: "Updated On Server",
      }

      // Reopen dialog with updated task (same ID)
      rerender({ task: serverUpdatedTask, open: true })

      // Should reset to server's values because dialog opened
      expect(result.current.formValues.title).toBe("Updated On Server")
    })

    it("handles null task correctly", () => {
      const onClose = vi.fn()
      const { result, rerender } = renderHook(
        ({ task, open }) => useTaskDetails({ task, open, onClose }),
        { initialProps: { task: null as TaskCardTask | null, open: false } },
      )

      // With null task, form should have defaults
      expect(result.current.formValues.title).toBe("")
      expect(result.current.formValues.description).toBe("")

      // Open with a task
      rerender({ task: mockTask, open: true })

      expect(result.current.formValues.title).toBe("Test Task")

      // Close and set task to null
      rerender({ task: null, open: false })

      // Form values should remain (no reset triggered since task is null)
      expect(result.current.formValues.title).toBe("Test Task")
    })

    it("tracks task ID changes correctly across multiple rerenders", () => {
      const onClose = vi.fn()
      const { result, rerender } = renderHook(
        ({ task, open }) => useTaskDetails({ task, open, onClose }),
        { initialProps: { task: mockTask, open: true } },
      )

      // Edit task 1
      act(() => {
        result.current.updateTitle("Edit 1")
      })

      // Polling update for task 1 (should NOT reset)
      rerender({ task: { ...mockTask, title: "Server 1" }, open: true })
      expect(result.current.formValues.title).toBe("Edit 1")

      // Switch to task 2 (SHOULD reset)
      rerender({ task: mockTask2, open: true })
      expect(result.current.formValues.title).toBe("Another Task")

      // Edit task 2
      act(() => {
        result.current.updateTitle("Edit 2")
      })

      // Polling update for task 2 (should NOT reset)
      rerender({ task: { ...mockTask2, title: "Server 2" }, open: true })
      expect(result.current.formValues.title).toBe("Edit 2")

      // Switch back to task 1 (SHOULD reset to task 1's current values)
      rerender({ task: mockTask, open: true })
      expect(result.current.formValues.title).toBe("Test Task")
    })
  })

  describe("initial form values", () => {
    it("initializes form with task values when dialog opens", () => {
      const { result } = renderHook(() => useTaskDetails(defaultOptions))

      expect(result.current.formValues).toEqual({
        title: "Test Task",
        description: "Test description",
        status: "open",
        priority: 2,
        issueType: "task",
        parent: null,
      })
    })

    it("uses default values for missing optional task properties", () => {
      const taskWithMissing: TaskCardTask = {
        id: "task-minimal",
        title: "Minimal Task",
        status: "open",
      }

      const { result } = renderHook(() =>
        useTaskDetails({
          task: taskWithMissing,
          open: true,
          onClose: vi.fn(),
        }),
      )

      expect(result.current.formValues.description).toBe("")
      expect(result.current.formValues.priority).toBe(2) // default
      expect(result.current.formValues.issueType).toBe("task") // default
      expect(result.current.formValues.parent).toBeNull()
    })
  })

  describe("form updates", () => {
    it("updates title and schedules autosave", async () => {
      const onSave = vi.fn().mockResolvedValue(undefined)
      const { result } = renderHook(() =>
        useTaskDetails({
          ...defaultOptions,
          onSave,
        }),
      )

      act(() => {
        result.current.updateTitle("New Title")
      })

      expect(result.current.formValues.title).toBe("New Title")

      // Advance past debounce
      await act(async () => {
        vi.advanceTimersByTime(600)
      })

      expect(onSave).toHaveBeenCalledWith("task-123", { title: "New Title" })
    })

    it("updates status and triggers immediate autosave", async () => {
      const onSave = vi.fn().mockResolvedValue(undefined)
      const { result } = renderHook(() =>
        useTaskDetails({
          ...defaultOptions,
          onSave,
        }),
      )

      await act(async () => {
        result.current.updateStatus("in_progress")
      })

      expect(result.current.formValues.status).toBe("in_progress")
      expect(onSave).toHaveBeenCalledWith("task-123", { status: "in_progress" })
    })

    it("does not trigger autosave in readOnly mode", async () => {
      const onSave = vi.fn()
      const { result } = renderHook(() =>
        useTaskDetails({
          ...defaultOptions,
          onSave,
          readOnly: true,
        }),
      )

      act(() => {
        result.current.updateTitle("New Title")
      })

      await act(async () => {
        vi.advanceTimersByTime(600)
      })

      expect(onSave).not.toHaveBeenCalled()
    })
  })

  describe("delete confirmation flow", () => {
    it("manages delete confirmation state", () => {
      const { result } = renderHook(() => useTaskDetails(defaultOptions))

      expect(result.current.isConfirmingDelete).toBe(false)

      act(() => {
        result.current.startDelete()
      })

      expect(result.current.isConfirmingDelete).toBe(true)

      act(() => {
        result.current.cancelDelete()
      })

      expect(result.current.isConfirmingDelete).toBe(false)
    })

    it("calls onDelete and onClose when confirming delete", async () => {
      const onDelete = vi.fn().mockResolvedValue(undefined)
      const onClose = vi.fn()
      const { result } = renderHook(() =>
        useTaskDetails({
          ...defaultOptions,
          onDelete,
          onClose,
        }),
      )

      act(() => {
        result.current.startDelete()
      })

      await act(async () => {
        await result.current.confirmDelete()
      })

      expect(onDelete).toHaveBeenCalledWith("task-123")
      expect(onClose).toHaveBeenCalled()
    })

    it("handles delete errors", async () => {
      const onDelete = vi.fn().mockRejectedValue(new Error("Delete failed"))
      const { result } = renderHook(() =>
        useTaskDetails({
          ...defaultOptions,
          onDelete,
        }),
      )

      act(() => {
        result.current.startDelete()
      })

      await act(async () => {
        await result.current.confirmDelete()
      })

      expect(result.current.deleteError).toBe("Delete failed")
      expect(result.current.isConfirmingDelete).toBe(false)
    })
  })

  describe("handleClose", () => {
    it("flushes pending autosave before closing", async () => {
      const onSave = vi.fn().mockResolvedValue(undefined)
      const onClose = vi.fn()
      const { result } = renderHook(() =>
        useTaskDetails({
          ...defaultOptions,
          onSave,
          onClose,
        }),
      )

      // Start a debounced save
      act(() => {
        result.current.updateTitle("Pending Title")
      })

      // Close before debounce completes
      await act(async () => {
        await result.current.handleClose()
      })

      // Should have saved and closed
      expect(onSave).toHaveBeenCalledWith("task-123", { title: "Pending Title" })
      expect(onClose).toHaveBeenCalled()
    })
  })
})
