import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"

// Mock the event database - needs to be defined before vi.mock
vi.mock("@/lib/persistence", () => ({
  eventDatabase: {
    init: vi.fn().mockResolvedValue(undefined),
    getTaskIdsWithEventLogs: vi.fn().mockResolvedValue(new Set(["task-1", "task-2"])),
  },
}))

// Import after mocking
import { useTasksWithEventLogs } from "./useTasksWithEventLogs"
import { eventDatabase } from "@/lib/persistence"

describe("useTasksWithEventLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(eventDatabase.init).mockResolvedValue(undefined)
    vi.mocked(eventDatabase.getTaskIdsWithEventLogs).mockResolvedValue(
      new Set(["task-1", "task-2"]),
    )
  })

  it("returns loading state initially", () => {
    const { result } = renderHook(() => useTasksWithEventLogs())

    expect(result.current.isLoading).toBe(true)
    expect(result.current.taskIdsWithEventLogs.size).toBe(0)
    expect(result.current.error).toBe(null)
  })

  it("returns task IDs after loading", async () => {
    const { result } = renderHook(() => useTasksWithEventLogs())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.taskIdsWithEventLogs.has("task-1")).toBe(true)
    expect(result.current.taskIdsWithEventLogs.has("task-2")).toBe(true)
    expect(result.current.taskIdsWithEventLogs.size).toBe(2)
    expect(result.current.error).toBe(null)
  })

  it("initializes the database before fetching", async () => {
    renderHook(() => useTasksWithEventLogs())

    await waitFor(() => {
      expect(eventDatabase.init).toHaveBeenCalled()
    })
  })

  it("handles errors gracefully", async () => {
    const errorMessage = "Database error"
    vi.mocked(eventDatabase.getTaskIdsWithEventLogs).mockRejectedValue(new Error(errorMessage))

    const { result } = renderHook(() => useTasksWithEventLogs())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBe(errorMessage)
    expect(result.current.taskIdsWithEventLogs.size).toBe(0)
  })

  it("provides a refresh function", async () => {
    const { result } = renderHook(() => useTasksWithEventLogs())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Verify initial data
    expect(result.current.taskIdsWithEventLogs.has("task-1")).toBe(true)

    // Update mock to return different data
    vi.mocked(eventDatabase.getTaskIdsWithEventLogs).mockResolvedValue(new Set(["task-3"]))

    // Call refresh
    await result.current.refresh()

    // Wait for the state to update after refresh
    await waitFor(() => {
      expect(result.current.taskIdsWithEventLogs.has("task-3")).toBe(true)
    })

    expect(result.current.taskIdsWithEventLogs.has("task-1")).toBe(false)
  })

  it("returns empty set when no task IDs have event logs", async () => {
    vi.mocked(eventDatabase.getTaskIdsWithEventLogs).mockResolvedValue(new Set())

    const { result } = renderHook(() => useTasksWithEventLogs())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.taskIdsWithEventLogs.size).toBe(0)
    expect(result.current.error).toBe(null)
  })
})
