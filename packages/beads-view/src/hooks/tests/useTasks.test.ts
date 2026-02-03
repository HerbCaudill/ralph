import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useTasks } from ".././useTasks"
import { fetchBlockedTasks } from "../../lib/fetchBlockedTasks"
import { beadsViewStore } from "../../store"
import type { TaskCardTask } from "../../types"

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe("useTasks", () => {
  const mockTasks: TaskCardTask[] = [
    {
      id: "task-1",
      title: "Open task",
      status: "open",
      issue_type: "task",
      priority: 2,
    },
    {
      id: "task-2",
      title: "In progress task",
      status: "in_progress",
      issue_type: "task",
      priority: 1,
    },
    {
      id: "task-3",
      title: "Closed task",
      status: "closed",
      issue_type: "task",
      priority: 3,
    },
    {
      id: "task-4",
      title: "Blocked task",
      status: "open",
      issue_type: "task",
      priority: 2,
      blocked_by: ["task-5"],
    },
    {
      id: "task-5",
      title: "Blocking dependency",
      status: "open",
      issue_type: "task",
      priority: 2,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset store
    beadsViewStore.setState({
      tasks: [],
    })
    // Default mock response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, issues: mockTasks }),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("initialization", () => {
    it("fetches all tasks on mount", async () => {
      const { result } = renderHook(() => useTasks())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockFetch).toHaveBeenCalledWith("/api/tasks?all=true", undefined)
    })

    it("sets isLoading while fetching", async () => {
      let resolvePromise: (value: unknown) => void
      const controlledPromise = new Promise(resolve => {
        resolvePromise = resolve
      })

      mockFetch.mockReturnValue({
        ok: true,
        json: () => controlledPromise,
      })

      const { result } = renderHook(() => useTasks())

      expect(result.current.isLoading).toBe(true)

      await act(async () => {
        resolvePromise!({ ok: true, issues: mockTasks })
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    it("handles fetch errors", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: false, error: "Server error" }),
      })

      const { result } = renderHook(() => useTasks())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBe("Server error")
      expect(result.current.tasks).toEqual([])
    })

    it("handles network errors", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"))

      const { result } = renderHook(() => useTasks())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBe("Network error")
    })
  })

  describe("filtering", () => {
    it("returns all tasks when no options specified", async () => {
      const { result } = renderHook(() => useTasks())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // By default, excludes closed tasks
      expect(result.current.tasks).toHaveLength(4)
      expect(result.current.tasks.find(t => t.status === "closed")).toBeUndefined()
    })

    it("includes closed tasks when all option is true", async () => {
      const { result } = renderHook(() => useTasks({ all: true }))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.tasks).toHaveLength(5)
      expect(result.current.tasks.find(t => t.status === "closed")).toBeDefined()
    })

    it("filters by status", async () => {
      const { result } = renderHook(() => useTasks({ status: "in_progress" }))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.tasks).toHaveLength(1)
      expect(result.current.tasks[0].status).toBe("in_progress")
    })

    it("filters for ready tasks (open and unblocked)", async () => {
      const { result } = renderHook(() => useTasks({ ready: true }))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Should only return task-1 and task-5 (open and not blocked)
      // task-4 is open but blocked
      expect(result.current.tasks).toHaveLength(2)
      expect(result.current.tasks.every(t => t.status === "open")).toBe(true)
      expect(result.current.tasks.every(t => !t.blocked_by || t.blocked_by.length === 0)).toBe(true)
    })
  })

  describe("store integration", () => {
    it("reads tasks from global store", async () => {
      // Pre-populate the store
      beadsViewStore.setState({ tasks: mockTasks })

      const { result } = renderHook(() => useTasks({ all: true }))

      // Tasks should be available immediately from store
      expect(result.current.tasks).toHaveLength(5)
    })

    it("updates store when tasks are fetched", async () => {
      const { result } = renderHook(() => useTasks())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Store should have all tasks (fetch always gets all)
      const storeState = beadsViewStore.getState()
      expect(storeState.tasks).toHaveLength(5)
    })

    it("reacts to store changes", async () => {
      const { result } = renderHook(() => useTasks({ all: true }))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.tasks).toHaveLength(5)

      // Simulate mutation event updating the store
      act(() => {
        beadsViewStore.getState().setTasks([
          ...mockTasks,
          {
            id: "task-6",
            title: "New task from mutation",
            status: "open",
            issue_type: "task",
            priority: 2,
          },
        ])
      })

      expect(result.current.tasks).toHaveLength(6)
    })
  })

  describe("refresh", () => {
    it("refetches tasks when refresh is called", async () => {
      const { result } = renderHook(() => useTasks())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      mockFetch.mockClear()
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            issues: [
              ...mockTasks,
              { id: "task-6", title: "New task", status: "open", issue_type: "task", priority: 2 },
            ],
          }),
      })

      await act(async () => {
        await result.current.refresh()
      })

      expect(mockFetch).toHaveBeenCalledWith("/api/tasks?all=true", undefined)
      const storeState = beadsViewStore.getState()
      expect(storeState.tasks).toHaveLength(6)
    })

    it("clears error on successful refresh", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: false, error: "Initial error" }),
      })

      const { result } = renderHook(() => useTasks())

      await waitFor(() => {
        expect(result.current.error).toBe("Initial error")
      })

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true, issues: mockTasks }),
      })

      await act(async () => {
        await result.current.refresh()
      })

      expect(result.current.error).toBeNull()
    })
  })

  describe("polling", () => {
    it("sets up interval when pollInterval is provided", async () => {
      const setIntervalSpy = vi.spyOn(global, "setInterval")
      const clearIntervalSpy = vi.spyOn(global, "clearInterval")

      const { unmount } = renderHook(() => useTasks({ pollInterval: 5000 }))

      await waitFor(() => {
        expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5000)
      })

      unmount()

      // Clear interval should be called on cleanup
      expect(clearIntervalSpy).toHaveBeenCalled()

      setIntervalSpy.mockRestore()
      clearIntervalSpy.mockRestore()
    })

    it("cleans up interval on unmount", async () => {
      const clearIntervalSpy = vi.spyOn(global, "clearInterval")

      const { unmount } = renderHook(() => useTasks({ pollInterval: 5000 }))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })

      const clearCountBefore = clearIntervalSpy.mock.calls.length
      unmount()

      // Clear interval should be called on cleanup
      expect(clearIntervalSpy.mock.calls.length).toBeGreaterThan(clearCountBefore)

      clearIntervalSpy.mockRestore()
    })
  })

  describe("memoization", () => {
    it("returns stable task array reference when store does not change", async () => {
      const { result, rerender } = renderHook(() => useTasks({ all: true }))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const firstTasks = result.current.tasks

      rerender()

      expect(result.current.tasks).toBe(firstTasks)
    })

    it("returns new task array when filters change", async () => {
      type StatusType = "open" | "in_progress" | "blocked" | "deferred" | "closed" | undefined
      const { result, rerender } = renderHook(
        ({ status }: { status: StatusType }) => useTasks({ status }),
        {
          initialProps: { status: undefined as StatusType },
        },
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const allTasks = result.current.tasks

      rerender({ status: "open" as StatusType })

      expect(result.current.tasks).not.toBe(allTasks)
    })
  })
})

describe("fetchBlockedTasks", () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = mockFetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("fetches blocked tasks", async () => {
    const blockedTasks = [
      { id: "task-1", title: "Blocked", status: "blocked", blocked_by: ["task-2"] },
    ]

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, issues: blockedTasks }),
    })

    const result = await fetchBlockedTasks()

    expect(mockFetch).toHaveBeenCalledWith("/api/tasks/blocked", undefined)
    expect(result.ok).toBe(true)
    expect(result.issues).toEqual(blockedTasks)
  })

  it("accepts parent parameter", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, issues: [] }),
    })

    await fetchBlockedTasks("parent-123")

    expect(mockFetch).toHaveBeenCalledWith("/api/tasks/blocked?parent=parent-123", undefined)
  })

  it("handles errors", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"))

    const result = await fetchBlockedTasks()

    expect(result.ok).toBe(false)
    expect(result.error).toBe("Network error")
  })
})
