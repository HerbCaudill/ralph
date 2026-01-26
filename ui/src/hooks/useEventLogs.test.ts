import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useEventLogs } from "./useEventLogs"
import { eventDatabase, type EventLogMetadata } from "@/lib/persistence"

// Mock the eventDatabase
vi.mock("@/lib/persistence", () => ({
  eventDatabase: {
    init: vi.fn(),
    listEventLogs: vi.fn(),
    getEventLogsForTask: vi.fn(),
  },
}))

const mockInit = eventDatabase.init as ReturnType<typeof vi.fn>
const mockListEventLogs = eventDatabase.listEventLogs as ReturnType<typeof vi.fn>
const mockGetEventLogsForTask = eventDatabase.getEventLogsForTask as ReturnType<typeof vi.fn>

describe("useEventLogs", () => {
  const mockEventLogMetadata: EventLogMetadata[] = [
    {
      id: "abc12345",
      createdAt: new Date("2026-01-23T10:00:00.000Z").getTime(),
      eventCount: 42,
      taskId: "r-test.1",
      taskTitle: "Test task 1",
      source: "session",
      workspacePath: "/test/workspace",
    },
    {
      id: "def67890",
      createdAt: new Date("2026-01-22T15:30:00.000Z").getTime(),
      eventCount: 128,
      taskId: "r-test.2",
      taskTitle: "Test task 2",
      source: "session",
      workspacePath: "/test/workspace",
    },
    {
      id: "ghi11111",
      createdAt: new Date("2026-01-21T09:00:00.000Z").getTime(),
      eventCount: 15,
      taskId: null,
      taskTitle: null,
      source: null,
      workspacePath: null,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockInit.mockResolvedValue(undefined)
    mockListEventLogs.mockResolvedValue(mockEventLogMetadata)
    mockGetEventLogsForTask.mockResolvedValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("initialization", () => {
    it("fetches event logs on mount", async () => {
      const { result } = renderHook(() => useEventLogs())

      await waitFor(() => {
        expect(result.current.eventLogs).toHaveLength(3)
      })

      expect(mockInit).toHaveBeenCalled()
      expect(mockListEventLogs).toHaveBeenCalled()
    })

    it("sets isLoading while fetching", async () => {
      // Create a promise we can control
      let resolvePromise: () => void
      const controlledPromise = new Promise<EventLogMetadata[]>(resolve => {
        resolvePromise = () => resolve(mockEventLogMetadata)
      })

      mockListEventLogs.mockReturnValue(controlledPromise)

      const { result } = renderHook(() => useEventLogs())

      // Should be loading initially
      expect(result.current.isLoading).toBe(true)

      // Resolve the promise
      await act(async () => {
        resolvePromise!()
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    it("returns event log summaries with metadata", async () => {
      const { result } = renderHook(() => useEventLogs())

      await waitFor(() => {
        expect(result.current.eventLogs).toHaveLength(3)
      })

      const log = result.current.eventLogs[0]
      expect(log.id).toBe("abc12345")
      expect(log.eventCount).toBe(42)
      expect(log.metadata?.taskId).toBe("r-test.1")
      expect(log.metadata?.title).toBe("Test task 1")
    })

    it("handles event logs without metadata", async () => {
      const { result } = renderHook(() => useEventLogs())

      await waitFor(() => {
        expect(result.current.eventLogs).toHaveLength(3)
      })

      const log = result.current.eventLogs[2]
      expect(log.id).toBe("ghi11111")
      expect(log.metadata).toBeUndefined()
    })

    it("converts createdAt from timestamp to ISO string", async () => {
      const { result } = renderHook(() => useEventLogs())

      await waitFor(() => {
        expect(result.current.eventLogs).toHaveLength(3)
      })

      const log = result.current.eventLogs[0]
      expect(log.createdAt).toBe("2026-01-23T10:00:00.000Z")
    })
  })

  describe("filtering by taskId", () => {
    it("fetches event logs for a specific task when taskId is provided", async () => {
      const taskSpecificLogs: EventLogMetadata[] = [mockEventLogMetadata[0]]
      mockGetEventLogsForTask.mockResolvedValue(taskSpecificLogs)

      const { result } = renderHook(() => useEventLogs({ taskId: "r-test.1" }))

      await waitFor(() => {
        expect(result.current.eventLogs).toHaveLength(1)
      })

      expect(mockGetEventLogsForTask).toHaveBeenCalledWith("r-test.1")
      expect(mockListEventLogs).not.toHaveBeenCalled()
    })

    it("refetches when taskId changes", async () => {
      const task1Logs: EventLogMetadata[] = [mockEventLogMetadata[0]]
      const task2Logs: EventLogMetadata[] = [mockEventLogMetadata[1]]

      mockGetEventLogsForTask.mockImplementation(async (taskId: string) => {
        if (taskId === "r-test.1") return task1Logs
        if (taskId === "r-test.2") return task2Logs
        return []
      })

      const { result, rerender } = renderHook(({ taskId }) => useEventLogs({ taskId }), {
        initialProps: { taskId: "r-test.1" },
      })

      await waitFor(() => {
        expect(result.current.eventLogs).toHaveLength(1)
        expect(result.current.eventLogs[0].id).toBe("abc12345")
      })

      rerender({ taskId: "r-test.2" })

      await waitFor(() => {
        expect(result.current.eventLogs[0].id).toBe("def67890")
      })
    })
  })

  describe("error handling", () => {
    it("sets error when database operation fails", async () => {
      mockListEventLogs.mockRejectedValue(new Error("Database error"))

      const { result } = renderHook(() => useEventLogs())

      await waitFor(() => {
        expect(result.current.error).toBe("Database error")
      })

      expect(result.current.eventLogs).toHaveLength(0)
    })

    it("sets generic error for non-Error failures", async () => {
      mockListEventLogs.mockRejectedValue("Unknown failure")

      const { result } = renderHook(() => useEventLogs())

      await waitFor(() => {
        expect(result.current.error).toBe("Failed to load event logs")
      })
    })

    it("sets error when init fails", async () => {
      mockInit.mockRejectedValue(new Error("Init failed"))

      const { result } = renderHook(() => useEventLogs())

      await waitFor(() => {
        expect(result.current.error).toBe("Init failed")
      })
    })
  })

  describe("refresh", () => {
    it("manually refetches event logs", async () => {
      const { result } = renderHook(() => useEventLogs())

      await waitFor(() => {
        expect(result.current.eventLogs).toHaveLength(3)
      })

      // Setup new mock response with more logs
      const additionalLog: EventLogMetadata = {
        id: "jkl22222",
        createdAt: new Date("2026-01-24T12:00:00.000Z").getTime(),
        eventCount: 99,
        taskId: null,
        taskTitle: null,
        source: null,
        workspacePath: null,
      }
      mockListEventLogs.mockResolvedValue([...mockEventLogMetadata, additionalLog])

      await act(async () => {
        await result.current.refresh()
      })

      expect(result.current.eventLogs).toHaveLength(4)
    })

    it("clears error on successful refresh", async () => {
      // First request fails
      mockListEventLogs.mockRejectedValueOnce(new Error("Initial error"))

      const { result } = renderHook(() => useEventLogs())

      await waitFor(() => {
        expect(result.current.error).toBe("Initial error")
      })

      // Second request succeeds
      mockListEventLogs.mockResolvedValue(mockEventLogMetadata)

      await act(async () => {
        await result.current.refresh()
      })

      expect(result.current.error).toBeNull()
      expect(result.current.eventLogs).toHaveLength(3)
    })
  })

  describe("empty state", () => {
    it("handles empty event logs list", async () => {
      mockListEventLogs.mockResolvedValue([])

      const { result } = renderHook(() => useEventLogs())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.eventLogs).toHaveLength(0)
      expect(result.current.error).toBeNull()
    })
  })
})
