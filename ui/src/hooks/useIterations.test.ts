import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { useIterations } from "./useIterations"
import { eventDatabase, type IterationMetadata } from "@/lib/persistence"

// Mock the eventDatabase
vi.mock("@/lib/persistence", () => ({
  eventDatabase: {
    init: vi.fn().mockResolvedValue(undefined),
    listAllIterations: vi.fn().mockResolvedValue([]),
    getIterationsForTask: vi.fn().mockResolvedValue([]),
  },
}))

describe("useIterations", () => {
  const mockDatabase = vi.mocked(eventDatabase)

  const createValidMetadata = (
    id: string,
    startedAt: number,
    taskId?: string,
    taskTitle?: string,
  ): IterationMetadata => ({
    id,
    instanceId: "default",
    workspaceId: null,
    startedAt,
    completedAt: null,
    taskId: taskId ?? null,
    taskTitle: taskTitle ?? null,
    tokenUsage: { input: 0, output: 0 },
    contextWindow: { used: 0, max: 200000 },
    iteration: { current: 1, total: 1 },
    eventCount: 5,
    lastEventSequence: 4,
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("initialization", () => {
    it("initializes the database on mount", async () => {
      renderHook(() => useIterations())

      await waitFor(() => {
        expect(mockDatabase.init).toHaveBeenCalledTimes(1)
      })
    })

    it("starts with empty iterations and loading state", () => {
      const { result } = renderHook(() => useIterations())
      expect(result.current.iterations).toEqual([])
      expect(result.current.isLoading).toBe(true)
      expect(result.current.error).toBeNull()
    })
  })

  describe("loading iterations", () => {
    it("loads all iterations when no taskId is provided", async () => {
      const timestamp = Date.now()
      mockDatabase.listAllIterations.mockResolvedValue([
        createValidMetadata("iter-1", timestamp, "task-1", "Test Task"),
      ])

      const { result } = renderHook(() => useIterations())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockDatabase.listAllIterations).toHaveBeenCalled()
      expect(mockDatabase.getIterationsForTask).not.toHaveBeenCalled()
      expect(result.current.iterations).toHaveLength(1)
      expect(result.current.iterations[0]).toEqual({
        id: "iter-1",
        createdAt: new Date(timestamp).toISOString(),
        eventCount: 5,
        metadata: {
          taskId: "task-1",
          title: "Test Task",
        },
      })
    })

    it("loads iterations filtered by taskId when provided", async () => {
      const timestamp = Date.now()
      mockDatabase.getIterationsForTask.mockResolvedValue([
        createValidMetadata("iter-1", timestamp, "task-1", "Test Task"),
      ])

      const { result } = renderHook(() => useIterations({ taskId: "task-1" }))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockDatabase.getIterationsForTask).toHaveBeenCalledWith("task-1")
      expect(mockDatabase.listAllIterations).not.toHaveBeenCalled()
    })
  })

  describe("invalid timestamp handling", () => {
    it("filters out iterations with undefined startedAt", async () => {
      const validTimestamp = Date.now()
      const metadataWithUndefined = {
        ...createValidMetadata("iter-invalid", 0),
        startedAt: undefined,
      } as unknown as IterationMetadata

      mockDatabase.listAllIterations.mockResolvedValue([
        createValidMetadata("iter-valid", validTimestamp),
        metadataWithUndefined,
      ])

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

      const { result } = renderHook(() => useIterations())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.iterations).toHaveLength(1)
      expect(result.current.iterations[0].id).toBe("iter-valid")
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Skipping iteration iter-invalid"),
      )

      consoleSpy.mockRestore()
    })

    it("filters out iterations with null startedAt", async () => {
      const validTimestamp = Date.now()
      const metadataWithNull = {
        ...createValidMetadata("iter-invalid", 0),
        startedAt: null,
      } as unknown as IterationMetadata

      mockDatabase.listAllIterations.mockResolvedValue([
        createValidMetadata("iter-valid", validTimestamp),
        metadataWithNull,
      ])

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

      const { result } = renderHook(() => useIterations())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.iterations).toHaveLength(1)
      expect(result.current.iterations[0].id).toBe("iter-valid")

      consoleSpy.mockRestore()
    })

    it("filters out iterations with startedAt of 0", async () => {
      const validTimestamp = Date.now()

      mockDatabase.listAllIterations.mockResolvedValue([
        createValidMetadata("iter-valid", validTimestamp),
        createValidMetadata("iter-invalid", 0),
      ])

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

      const { result } = renderHook(() => useIterations())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.iterations).toHaveLength(1)
      expect(result.current.iterations[0].id).toBe("iter-valid")
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Skipping iteration iter-invalid with invalid startedAt: 0"),
      )

      consoleSpy.mockRestore()
    })

    it("filters out iterations with NaN startedAt", async () => {
      const validTimestamp = Date.now()
      const metadataWithNaN = createValidMetadata("iter-invalid", NaN)

      mockDatabase.listAllIterations.mockResolvedValue([
        createValidMetadata("iter-valid", validTimestamp),
        metadataWithNaN,
      ])

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

      const { result } = renderHook(() => useIterations())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.iterations).toHaveLength(1)
      expect(result.current.iterations[0].id).toBe("iter-valid")

      consoleSpy.mockRestore()
    })
  })

  describe("metadata handling", () => {
    it("returns undefined metadata when neither taskId nor taskTitle present", async () => {
      const timestamp = Date.now()
      mockDatabase.listAllIterations.mockResolvedValue([createValidMetadata("iter-1", timestamp)])

      const { result } = renderHook(() => useIterations())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.iterations[0].metadata).toBeUndefined()
    })

    it("returns metadata with only taskId when taskTitle is null", async () => {
      const timestamp = Date.now()
      mockDatabase.listAllIterations.mockResolvedValue([
        createValidMetadata("iter-1", timestamp, "task-1"),
      ])

      const { result } = renderHook(() => useIterations())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.iterations[0].metadata).toEqual({
        taskId: "task-1",
        title: undefined,
      })
    })
  })

  describe("error handling", () => {
    it("sets error state when database fetch fails", async () => {
      mockDatabase.listAllIterations.mockRejectedValue(new Error("Database error"))

      const { result } = renderHook(() => useIterations())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBe("Database error")
      expect(result.current.iterations).toEqual([])
    })

    it("handles non-Error exceptions", async () => {
      mockDatabase.listAllIterations.mockRejectedValue("Unknown error")

      const { result } = renderHook(() => useIterations())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBe("Failed to load iterations")
    })
  })

  describe("refresh", () => {
    it("provides a refresh function that reloads data", async () => {
      const timestamp1 = Date.now()
      const timestamp2 = Date.now() + 1000

      mockDatabase.listAllIterations.mockResolvedValueOnce([
        createValidMetadata("iter-1", timestamp1),
      ])

      const { result } = renderHook(() => useIterations())

      await waitFor(() => {
        expect(result.current.iterations).toHaveLength(1)
      })

      mockDatabase.listAllIterations.mockResolvedValueOnce([
        createValidMetadata("iter-1", timestamp1),
        createValidMetadata("iter-2", timestamp2),
      ])

      await result.current.refresh()

      await waitFor(() => {
        expect(result.current.iterations).toHaveLength(2)
      })
    })
  })
})
