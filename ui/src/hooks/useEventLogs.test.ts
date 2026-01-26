import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useEventLogs } from "./useEventLogs"
import { eventDatabase, type SessionMetadata } from "@/lib/persistence"

// Mock the eventDatabase
vi.mock("@/lib/persistence", () => ({
  eventDatabase: {
    init: vi.fn(),
    listAllSessions: vi.fn(),
    getSessionsForTask: vi.fn(),
  },
}))

const mockInit = eventDatabase.init as ReturnType<typeof vi.fn>
const mockListAllSessions = eventDatabase.listAllSessions as ReturnType<typeof vi.fn>
const mockGetSessionsForTask = eventDatabase.getSessionsForTask as ReturnType<typeof vi.fn>

describe("useEventLogs", () => {
  // Mock session metadata that will be returned by the database
  const mockSessionMetadata: SessionMetadata[] = [
    {
      id: "abc12345",
      instanceId: "test-instance",
      workspaceId: "/test/workspace",
      startedAt: new Date("2026-01-23T10:00:00.000Z").getTime(),
      completedAt: new Date("2026-01-23T11:00:00.000Z").getTime(),
      taskId: "r-test.1",
      taskTitle: "Test task 1",
      tokenUsage: {
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
        totalCost: 0,
      },
      contextWindow: { used: 0, total: 200000, percentUsed: 0 },
      session: { compact: "idle" },
      eventCount: 42,
      lastEventSequence: 41,
    },
    {
      id: "def67890",
      instanceId: "test-instance",
      workspaceId: "/test/workspace",
      startedAt: new Date("2026-01-22T15:30:00.000Z").getTime(),
      completedAt: new Date("2026-01-22T16:30:00.000Z").getTime(),
      taskId: "r-test.2",
      taskTitle: "Test task 2",
      tokenUsage: {
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
        totalCost: 0,
      },
      contextWindow: { used: 0, total: 200000, percentUsed: 0 },
      session: { compact: "idle" },
      eventCount: 128,
      lastEventSequence: 127,
    },
    {
      id: "ghi11111",
      instanceId: "test-instance",
      workspaceId: null,
      startedAt: new Date("2026-01-21T09:00:00.000Z").getTime(),
      completedAt: new Date("2026-01-21T10:00:00.000Z").getTime(),
      taskId: null,
      taskTitle: null,
      tokenUsage: {
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
        totalCost: 0,
      },
      contextWindow: { used: 0, total: 200000, percentUsed: 0 },
      session: { compact: "idle" },
      eventCount: 15,
      lastEventSequence: 14,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockInit.mockResolvedValue(undefined)
    mockListAllSessions.mockResolvedValue(mockSessionMetadata)
    mockGetSessionsForTask.mockResolvedValue([])
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
      expect(mockListAllSessions).toHaveBeenCalled()
    })

    it("sets isLoading while fetching", async () => {
      // Create a promise we can control
      let resolvePromise: () => void
      const controlledPromise = new Promise<EventLogMetadata[]>(resolve => {
        resolvePromise = () => resolve(mockSessionMetadata)
      })

      mockListAllSessions.mockReturnValue(controlledPromise)

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
      const taskSpecificLogs: EventLogMetadata[] = [mockSessionMetadata[0]]
      mockGetSessionsForTask.mockResolvedValue(taskSpecificLogs)

      const { result } = renderHook(() => useEventLogs({ taskId: "r-test.1" }))

      await waitFor(() => {
        expect(result.current.eventLogs).toHaveLength(1)
      })

      expect(mockGetSessionsForTask).toHaveBeenCalledWith("r-test.1")
      expect(mockListAllSessions).not.toHaveBeenCalled()
    })

    it("refetches when taskId changes", async () => {
      const task1Logs: EventLogMetadata[] = [mockSessionMetadata[0]]
      const task2Logs: EventLogMetadata[] = [mockSessionMetadata[1]]

      mockGetSessionsForTask.mockImplementation(async (taskId: string) => {
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
      mockListAllSessions.mockRejectedValue(new Error("Database error"))

      const { result } = renderHook(() => useEventLogs())

      await waitFor(() => {
        expect(result.current.error).toBe("Database error")
      })

      expect(result.current.eventLogs).toHaveLength(0)
    })

    it("sets generic error for non-Error failures", async () => {
      mockListAllSessions.mockRejectedValue("Unknown failure")

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
      const additionalSession: SessionMetadata = {
        id: "jkl22222",
        instanceId: "test-instance",
        workspaceId: null,
        startedAt: new Date("2026-01-24T12:00:00.000Z").getTime(),
        completedAt: new Date("2026-01-24T13:00:00.000Z").getTime(),
        taskId: null,
        taskTitle: null,
        tokenUsage: {
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationInputTokens: 0,
          cacheReadInputTokens: 0,
          totalCost: 0,
        },
        contextWindow: { used: 0, total: 200000, percentUsed: 0 },
        session: { compact: "idle" },
        eventCount: 99,
        lastEventSequence: 98,
      }
      mockListAllSessions.mockResolvedValue([...mockSessionMetadata, additionalSession])

      await act(async () => {
        await result.current.refresh()
      })

      expect(result.current.eventLogs).toHaveLength(4)
    })

    it("clears error on successful refresh", async () => {
      // First request fails
      mockListAllSessions.mockRejectedValueOnce(new Error("Initial error"))

      const { result } = renderHook(() => useEventLogs())

      await waitFor(() => {
        expect(result.current.error).toBe("Initial error")
      })

      // Second request succeeds
      mockListAllSessions.mockResolvedValue(mockSessionMetadata)

      await act(async () => {
        await result.current.refresh()
      })

      expect(result.current.error).toBeNull()
      expect(result.current.eventLogs).toHaveLength(3)
    })
  })

  describe("empty state", () => {
    it("handles empty event logs list", async () => {
      mockListAllSessions.mockResolvedValue([])

      const { result } = renderHook(() => useEventLogs())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.eventLogs).toHaveLength(0)
      expect(result.current.error).toBeNull()
    })
  })
})
