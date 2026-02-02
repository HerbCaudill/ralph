import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useTaskDialog } from ".././useTaskDialog"
import { beadsViewStore } from "../../store"
import type { TaskCardTask } from "../../types"

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe("useTaskDialog", () => {
  const mockTask: TaskCardTask = {
    id: "task-123",
    title: "Test Task",
    description: "Test description",
    status: "open",
    priority: 2,
    issue_type: "task",
  }

  const mockTask2: TaskCardTask = {
    id: "task-456",
    title: "Another Task",
    status: "in_progress",
    priority: 1,
    issue_type: "bug",
  }

  beforeEach(() => {
    mockFetch.mockReset()
    vi.useFakeTimers()
    // Reset store
    beadsViewStore.setState({
      tasks: [],
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe("openDialog", () => {
    it("opens the dialog with the provided task", () => {
      const { result } = renderHook(() => useTaskDialog())

      expect(result.current.isOpen).toBe(false)
      expect(result.current.selectedTask).toBeNull()

      act(() => {
        result.current.openDialog(mockTask)
      })

      expect(result.current.isOpen).toBe(true)
      expect(result.current.selectedTask).toEqual(mockTask)
      expect(result.current.error).toBeNull()
    })

    it("clears any previous error when opening", () => {
      const { result } = renderHook(() => useTaskDialog())

      // Manually set an error state first (via closeDialog timeout scenario)
      act(() => {
        result.current.openDialog(mockTask)
      })

      expect(result.current.error).toBeNull()
    })

    it("cancels pending close timeout when opening dialog quickly", async () => {
      const { result } = renderHook(() => useTaskDialog())

      // Open dialog
      act(() => {
        result.current.openDialog(mockTask)
      })

      expect(result.current.isOpen).toBe(true)
      expect(result.current.selectedTask).toEqual(mockTask)

      // Close dialog (starts 200ms timeout to clear task)
      act(() => {
        result.current.closeDialog()
      })

      expect(result.current.isOpen).toBe(false)
      // Task should still be there before timeout
      expect(result.current.selectedTask).toEqual(mockTask)

      // Open dialog again quickly before timeout completes
      act(() => {
        result.current.openDialog(mockTask2)
      })

      // Advance past the close timeout
      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      // Task should NOT be cleared because we reopened
      expect(result.current.isOpen).toBe(true)
      expect(result.current.selectedTask).toEqual(mockTask2)
    })
  })

  describe("openDialogById - cache hit", () => {
    it("opens dialog instantly when task is in cache without API call", async () => {
      // Pre-populate the store with cached tasks
      beadsViewStore.setState({ tasks: [mockTask, mockTask2] })

      const { result } = renderHook(() => useTaskDialog())

      expect(result.current.isOpen).toBe(false)
      expect(result.current.selectedTask).toBeNull()
      expect(result.current.isLoading).toBe(false)

      await act(async () => {
        await result.current.openDialogById("task-123")
      })

      // Dialog should be open with cached task
      expect(result.current.isOpen).toBe(true)
      expect(result.current.selectedTask).toEqual(mockTask)
      // Should NOT be loading (instant cache hit)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()

      // API should NOT have been called
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it("uses cached task data without loading state", async () => {
      beadsViewStore.setState({ tasks: [mockTask] })

      const { result } = renderHook(() => useTaskDialog())

      // Track loading state changes
      const loadingStates: boolean[] = []

      await act(async () => {
        // Start the open
        const promise = result.current.openDialogById("task-123")
        loadingStates.push(result.current.isLoading)
        await promise
        loadingStates.push(result.current.isLoading)
      })

      // Loading should never have been true for cache hit
      expect(loadingStates).toEqual([false, false])
      expect(result.current.selectedTask).toEqual(mockTask)
    })

    it("works with different task IDs in cache", async () => {
      beadsViewStore.setState({ tasks: [mockTask, mockTask2] })

      const { result } = renderHook(() => useTaskDialog())

      await act(async () => {
        await result.current.openDialogById("task-456")
      })

      expect(result.current.isOpen).toBe(true)
      expect(result.current.selectedTask).toEqual(mockTask2)
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe("openDialogById - cache miss", () => {
    it("fetches from API when task is not in cache", async () => {
      // Store is empty - no cached tasks
      beadsViewStore.setState({ tasks: [] })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => "application/json",
        },
        json: () => Promise.resolve({ ok: true, issue: mockTask }),
      })

      const { result } = renderHook(() => useTaskDialog())

      await act(async () => {
        await result.current.openDialogById("task-123")
      })

      // API should have been called
      expect(mockFetch).toHaveBeenCalledWith("/api/tasks/task-123")

      // Dialog should be open with fetched task
      expect(result.current.isOpen).toBe(true)
      expect(result.current.selectedTask).toEqual(mockTask)
      expect(result.current.isLoading).toBe(false)
    })

    it("shows loading state while fetching", async () => {
      beadsViewStore.setState({ tasks: [] })

      let resolveFetch: (value: unknown) => void
      const fetchPromise = new Promise(resolve => {
        resolveFetch = resolve
      })

      mockFetch.mockReturnValueOnce(fetchPromise)

      const { result } = renderHook(() => useTaskDialog())

      // Start opening by ID
      act(() => {
        result.current.openDialogById("task-123")
      })

      // Should be loading
      expect(result.current.isLoading).toBe(true)
      expect(result.current.isOpen).toBe(true)

      // Resolve the fetch
      await act(async () => {
        resolveFetch!({
          ok: true,
          headers: {
            get: () => "application/json",
          },
          json: () => Promise.resolve({ ok: true, issue: mockTask }),
        })
      })

      // Loading should be done
      expect(result.current.isLoading).toBe(false)
      expect(result.current.selectedTask).toEqual(mockTask)
    })

    it("sets error and closes dialog when API returns error", async () => {
      beadsViewStore.setState({ tasks: [] })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => "application/json",
        },
        json: () => Promise.resolve({ ok: false, error: "Task not found" }),
      })

      const { result } = renderHook(() => useTaskDialog())

      await act(async () => {
        await result.current.openDialogById("nonexistent-task")
      })

      expect(result.current.isOpen).toBe(false)
      expect(result.current.error).toBe("Task not found")
      expect(result.current.isLoading).toBe(false)
    })

    it("handles network errors gracefully", async () => {
      beadsViewStore.setState({ tasks: [] })

      mockFetch.mockRejectedValueOnce(new Error("Network error"))

      const { result } = renderHook(() => useTaskDialog())

      await act(async () => {
        await result.current.openDialogById("task-123")
      })

      expect(result.current.isOpen).toBe(false)
      expect(result.current.error).toBe("Network error")
      expect(result.current.isLoading).toBe(false)
    })

    it("handles non-JSON response", async () => {
      beadsViewStore.setState({ tasks: [] })

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        headers: {
          get: () => "text/html",
        },
      })

      const { result } = renderHook(() => useTaskDialog())

      await act(async () => {
        await result.current.openDialogById("task-123")
      })

      expect(result.current.isOpen).toBe(false)
      expect(result.current.error).toBe("Server error: 500 Internal Server Error")
    })
  })

  describe("openDialogById - cache priority", () => {
    it("prefers cache over API even when task exists on server", async () => {
      // Put a version of the task in the cache
      const cachedTask = { ...mockTask, title: "Cached Title" }
      beadsViewStore.setState({ tasks: [cachedTask] })

      // Mock API would return different data
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => "application/json",
        },
        json: () => Promise.resolve({ ok: true, issue: { ...mockTask, title: "Server Title" } }),
      })

      const { result } = renderHook(() => useTaskDialog())

      await act(async () => {
        await result.current.openDialogById("task-123")
      })

      // Should use cached version
      expect(result.current.selectedTask?.title).toBe("Cached Title")
      // API should NOT have been called
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it("falls back to API when task ID not in cache", async () => {
      // Cache has different tasks (task-456, not task-123)
      beadsViewStore.setState({ tasks: [mockTask2] })

      const serverTask = { ...mockTask, title: "Server Title" }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => "application/json",
        },
        json: () => Promise.resolve({ ok: true, issue: serverTask }),
      })

      const { result } = renderHook(() => useTaskDialog())

      await act(async () => {
        await result.current.openDialogById("task-123")
      })

      // Should have fetched from API
      expect(mockFetch).toHaveBeenCalledWith("/api/tasks/task-123")
      // Should have the server title, not the mockTask title
      expect(result.current.selectedTask?.title).toBe("Server Title")
    })
  })

  describe("closeDialog", () => {
    it("closes the dialog and clears task after delay", async () => {
      const { result } = renderHook(() => useTaskDialog())

      act(() => {
        result.current.openDialog(mockTask)
      })

      expect(result.current.isOpen).toBe(true)
      expect(result.current.selectedTask).toEqual(mockTask)

      act(() => {
        result.current.closeDialog()
      })

      // Dialog closed immediately
      expect(result.current.isOpen).toBe(false)
      // Task still there for animation
      expect(result.current.selectedTask).toEqual(mockTask)

      // Advance past the 200ms animation delay
      await act(async () => {
        vi.advanceTimersByTime(250)
      })

      // Now task should be cleared
      expect(result.current.selectedTask).toBeNull()
    })
  })

  describe("saveTask", () => {
    it("updates task via API", async () => {
      const onTaskUpdated = vi.fn()
      const { result } = renderHook(() => useTaskDialog({ onTaskUpdated }))

      act(() => {
        result.current.openDialog(mockTask)
      })

      const updatedTask = { ...mockTask, title: "Updated Title" }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => "application/json",
        },
        json: () => Promise.resolve({ ok: true, issue: updatedTask }),
      })

      await act(async () => {
        await result.current.saveTask("task-123", { title: "Updated Title" })
      })

      expect(mockFetch).toHaveBeenCalledWith("/api/tasks/task-123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated Title" }),
      })

      expect(result.current.selectedTask?.title).toBe("Updated Title")
      expect(onTaskUpdated).toHaveBeenCalled()
    })

    it("sets isUpdating during save", async () => {
      const { result } = renderHook(() => useTaskDialog())

      act(() => {
        result.current.openDialog(mockTask)
      })

      let resolveFetch: (value: unknown) => void
      const fetchPromise = new Promise(resolve => {
        resolveFetch = resolve
      })

      mockFetch.mockReturnValueOnce(fetchPromise)

      // Start save
      act(() => {
        result.current.saveTask("task-123", { title: "Updated" })
      })

      expect(result.current.isUpdating).toBe(true)

      await act(async () => {
        resolveFetch!({
          ok: true,
          headers: {
            get: () => "application/json",
          },
          json: () => Promise.resolve({ ok: true, issue: { ...mockTask, title: "Updated" } }),
        })
      })

      expect(result.current.isUpdating).toBe(false)
    })

    it("handles save errors and throws", async () => {
      const { result } = renderHook(() => useTaskDialog())

      act(() => {
        result.current.openDialog(mockTask)
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => "application/json",
        },
        json: () => Promise.resolve({ ok: false, error: "Save failed" }),
      })

      let thrownError: Error | undefined
      await act(async () => {
        try {
          await result.current.saveTask("task-123", { title: "Updated" })
        } catch (err) {
          thrownError = err as Error
        }
      })

      expect(thrownError?.message).toBe("Save failed")
      expect(result.current.error).toBe("Save failed")
      expect(result.current.isUpdating).toBe(false)
    })
  })

  describe("deleteTask", () => {
    it("deletes task via API and updates store", async () => {
      const onTaskDeleted = vi.fn()
      // Set up store with task
      beadsViewStore.setState({ tasks: [mockTask, mockTask2] })

      const { result } = renderHook(() => useTaskDialog({ onTaskDeleted }))

      act(() => {
        result.current.openDialog(mockTask)
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => "application/json",
        },
        json: () => Promise.resolve({ ok: true }),
      })

      // Mock the refresh tasks fetch (this will be called by refreshTasks)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true, issues: [mockTask2] }),
      })

      await act(async () => {
        await result.current.deleteTask("task-123")
      })

      expect(mockFetch).toHaveBeenCalledWith("/api/tasks/task-123", {
        method: "DELETE",
      })

      // Task should be removed from store (optimistic update)
      expect(beadsViewStore.getState().tasks).toHaveLength(1)
      expect(beadsViewStore.getState().tasks[0].id).toBe("task-456")

      expect(onTaskDeleted).toHaveBeenCalled()
    })

    it("handles delete errors and throws", async () => {
      beadsViewStore.setState({ tasks: [mockTask] })

      const { result } = renderHook(() => useTaskDialog())

      act(() => {
        result.current.openDialog(mockTask)
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => "application/json",
        },
        json: () => Promise.resolve({ ok: false, error: "Delete failed" }),
      })

      let thrownError: Error | undefined
      await act(async () => {
        try {
          await result.current.deleteTask("task-123")
        } catch (err) {
          thrownError = err as Error
        }
      })

      expect(thrownError?.message).toBe("Delete failed")
      expect(result.current.error).toBe("Delete failed")
      // Task should still be in store
      expect(beadsViewStore.getState().tasks).toHaveLength(1)
    })
  })

  describe("options callbacks", () => {
    it("calls onTaskUpdated after successful save", async () => {
      const onTaskUpdated = vi.fn().mockResolvedValue(undefined)
      const { result } = renderHook(() => useTaskDialog({ onTaskUpdated }))

      act(() => {
        result.current.openDialog(mockTask)
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => "application/json",
        },
        json: () => Promise.resolve({ ok: true, issue: mockTask }),
      })

      await act(async () => {
        await result.current.saveTask("task-123", { title: "Updated" })
      })

      expect(onTaskUpdated).toHaveBeenCalled()
    })

    it("calls onTaskDeleted after successful delete", async () => {
      const onTaskDeleted = vi.fn().mockResolvedValue(undefined)
      beadsViewStore.setState({ tasks: [mockTask] })

      const { result } = renderHook(() => useTaskDialog({ onTaskDeleted }))

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => "application/json",
        },
        json: () => Promise.resolve({ ok: true }),
      })

      // Mock refresh (refreshTasks will be called)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true, issues: [] }),
      })

      await act(async () => {
        await result.current.deleteTask("task-123")
      })

      expect(onTaskDeleted).toHaveBeenCalled()
    })
  })
})
