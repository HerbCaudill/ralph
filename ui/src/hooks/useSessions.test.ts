import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { useSessions } from "./useSessions"
import { eventDatabase, type SessionMetadata } from "@/lib/persistence"

// Mock the eventDatabase
vi.mock("@/lib/persistence", () => ({
  eventDatabase: {
    init: vi.fn().mockResolvedValue(undefined),
    listAllSessions: vi.fn().mockResolvedValue([]),
    getSessionsForTask: vi.fn().mockResolvedValue([]),
    getSessionMetadata: vi.fn().mockResolvedValue(undefined),
    getEventsForSession: vi.fn().mockResolvedValue([]),
  },
}))

describe("useSessions", () => {
  const mockDatabase = vi.mocked(eventDatabase)

  const createValidMetadata = (
    id: string,
    startedAt: number,
    taskId?: string,
    taskTitle?: string,
  ): SessionMetadata => ({
    id,
    instanceId: "default",
    workspaceId: null,
    startedAt,
    completedAt: null,
    taskId: taskId ?? null,
    taskTitle: taskTitle ?? null,
    tokenUsage: { input: 0, output: 0 },
    contextWindow: { used: 0, max: 200000 },
    session: { current: 1, total: 1 },
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
      renderHook(() => useSessions())

      await waitFor(() => {
        expect(mockDatabase.init).toHaveBeenCalledTimes(1)
      })
    })

    it("starts with empty sessions and loading state", () => {
      const { result } = renderHook(() => useSessions())
      expect(result.current.sessions).toEqual([])
      expect(result.current.isLoading).toBe(true)
      expect(result.current.error).toBeNull()
    })
  })

  describe("loading sessions", () => {
    it("loads all sessions when no taskId is provided", async () => {
      const timestamp = Date.now()
      mockDatabase.listAllSessions.mockResolvedValue([
        createValidMetadata("iter-1", timestamp, "task-1", "Test Task"),
      ])

      const { result } = renderHook(() => useSessions())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockDatabase.listAllSessions).toHaveBeenCalled()
      expect(mockDatabase.getSessionsForTask).not.toHaveBeenCalled()
      expect(result.current.sessions).toHaveLength(1)
      expect(result.current.sessions[0]).toEqual({
        id: "iter-1",
        createdAt: new Date(timestamp).toISOString(),
        eventCount: 5,
        metadata: {
          taskId: "task-1",
          title: "Test Task",
        },
      })
    })

    it("loads sessions filtered by taskId when provided", async () => {
      const timestamp = Date.now()
      mockDatabase.getSessionsForTask.mockResolvedValue([
        createValidMetadata("iter-1", timestamp, "task-1", "Test Task"),
      ])

      const { result } = renderHook(() => useSessions({ taskId: "task-1" }))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockDatabase.getSessionsForTask).toHaveBeenCalledWith("task-1")
      expect(mockDatabase.listAllSessions).not.toHaveBeenCalled()
    })
  })

  describe("invalid timestamp handling", () => {
    it("filters out sessions with undefined startedAt", async () => {
      const validTimestamp = Date.now()
      const metadataWithUndefined = {
        ...createValidMetadata("iter-invalid", 0),
        startedAt: undefined,
      } as unknown as SessionMetadata

      mockDatabase.listAllSessions.mockResolvedValue([
        createValidMetadata("iter-valid", validTimestamp),
        metadataWithUndefined,
      ])

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

      const { result } = renderHook(() => useSessions())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.sessions).toHaveLength(1)
      expect(result.current.sessions[0].id).toBe("iter-valid")
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Skipping session iter-invalid"),
      )

      consoleSpy.mockRestore()
    })

    it("filters out sessions with null startedAt", async () => {
      const validTimestamp = Date.now()
      const metadataWithNull = {
        ...createValidMetadata("iter-invalid", 0),
        startedAt: null,
      } as unknown as SessionMetadata

      mockDatabase.listAllSessions.mockResolvedValue([
        createValidMetadata("iter-valid", validTimestamp),
        metadataWithNull,
      ])

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

      const { result } = renderHook(() => useSessions())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.sessions).toHaveLength(1)
      expect(result.current.sessions[0].id).toBe("iter-valid")

      consoleSpy.mockRestore()
    })

    it("filters out sessions with startedAt of 0", async () => {
      const validTimestamp = Date.now()

      mockDatabase.listAllSessions.mockResolvedValue([
        createValidMetadata("iter-valid", validTimestamp),
        createValidMetadata("iter-invalid", 0),
      ])

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

      const { result } = renderHook(() => useSessions())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.sessions).toHaveLength(1)
      expect(result.current.sessions[0].id).toBe("iter-valid")
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Skipping session iter-invalid with invalid startedAt: 0"),
      )

      consoleSpy.mockRestore()
    })

    it("filters out sessions with NaN startedAt", async () => {
      const validTimestamp = Date.now()
      const metadataWithNaN = createValidMetadata("iter-invalid", NaN)

      mockDatabase.listAllSessions.mockResolvedValue([
        createValidMetadata("iter-valid", validTimestamp),
        metadataWithNaN,
      ])

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

      const { result } = renderHook(() => useSessions())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.sessions).toHaveLength(1)
      expect(result.current.sessions[0].id).toBe("iter-valid")

      consoleSpy.mockRestore()
    })
  })

  describe("metadata handling", () => {
    it("returns undefined metadata when neither taskId nor taskTitle present", async () => {
      const timestamp = Date.now()
      mockDatabase.listAllSessions.mockResolvedValue([createValidMetadata("iter-1", timestamp)])

      const { result } = renderHook(() => useSessions())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.sessions[0].metadata).toBeUndefined()
    })

    it("returns metadata with only taskId when taskTitle is null", async () => {
      const timestamp = Date.now()
      mockDatabase.listAllSessions.mockResolvedValue([
        createValidMetadata("iter-1", timestamp, "task-1"),
      ])

      const { result } = renderHook(() => useSessions())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.sessions[0].metadata).toEqual({
        taskId: "task-1",
        title: undefined,
      })
    })
  })

  describe("error handling", () => {
    it("sets error state when database fetch fails", async () => {
      mockDatabase.listAllSessions.mockRejectedValue(new Error("Database error"))

      const { result } = renderHook(() => useSessions())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBe("Database error")
      expect(result.current.sessions).toEqual([])
    })

    it("handles non-Error exceptions", async () => {
      mockDatabase.listAllSessions.mockRejectedValue("Unknown error")

      const { result } = renderHook(() => useSessions())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBe("Failed to load sessions")
    })
  })

  describe("refresh", () => {
    it("provides a refresh function that reloads data", async () => {
      const timestamp1 = Date.now()
      const timestamp2 = Date.now() + 1000

      mockDatabase.listAllSessions.mockResolvedValueOnce([
        createValidMetadata("iter-1", timestamp1),
      ])

      const { result } = renderHook(() => useSessions())

      await waitFor(() => {
        expect(result.current.sessions).toHaveLength(1)
      })

      mockDatabase.listAllSessions.mockResolvedValueOnce([
        createValidMetadata("iter-1", timestamp1),
        createValidMetadata("iter-2", timestamp2),
      ])

      await result.current.refresh()

      await waitFor(() => {
        expect(result.current.sessions).toHaveLength(2)
      })
    })
  })

  describe("loadSessionEvents", () => {
    it("loads events for a session and updates selectedSession", async () => {
      const timestamp = Date.now()
      const metadata = createValidMetadata("session-1", timestamp, "task-1", "Test Task")

      mockDatabase.getSessionMetadata.mockResolvedValue(metadata)
      mockDatabase.getEventsForSession.mockResolvedValue([
        {
          id: "event-1",
          sessionId: "session-1",
          timestamp: timestamp + 100,
          eventType: "user",
          event: { type: "user", message: { content: "Hello" }, timestamp: timestamp + 100 },
        },
        {
          id: "event-2",
          sessionId: "session-1",
          timestamp: timestamp + 200,
          eventType: "assistant",
          event: {
            type: "assistant",
            message: { content: [{ type: "text", text: "Hi!" }] },
            timestamp: timestamp + 200,
          },
        },
      ])

      const { result } = renderHook(() => useSessions())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Load session events
      const sessionWithEvents = await result.current.loadSessionEvents("session-1")

      expect(sessionWithEvents).not.toBeNull()
      expect(sessionWithEvents?.id).toBe("session-1")
      expect(sessionWithEvents?.events).toHaveLength(2)
      expect(sessionWithEvents?.events[0].type).toBe("user")
      expect(sessionWithEvents?.events[1].type).toBe("assistant")

      // Should also update selectedSession state (wait for state update)
      await waitFor(() => {
        expect(result.current.selectedSession).not.toBeNull()
      })
      expect(result.current.selectedSession?.id).toBe("session-1")
      expect(result.current.selectedSession?.events).toHaveLength(2)
      expect(result.current.isLoadingEvents).toBe(false)
      expect(result.current.eventsError).toBeNull()
    })

    it("returns null and sets error when session not found", async () => {
      mockDatabase.getSessionMetadata.mockResolvedValue(undefined)

      const { result } = renderHook(() => useSessions())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const sessionWithEvents = await result.current.loadSessionEvents("nonexistent")

      expect(sessionWithEvents).toBeNull()
      await waitFor(() => {
        expect(result.current.eventsError).toBe("Session not found")
      })
      expect(result.current.selectedSession).toBeNull()
    })

    it("handles database errors gracefully", async () => {
      mockDatabase.getSessionMetadata.mockRejectedValue(new Error("Database error"))

      const { result } = renderHook(() => useSessions())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const sessionWithEvents = await result.current.loadSessionEvents("session-1")

      expect(sessionWithEvents).toBeNull()
      await waitFor(() => {
        expect(result.current.eventsError).toBe("Database error")
      })
      expect(result.current.selectedSession).toBeNull()
    })

    it("sets isLoadingEvents while loading", async () => {
      const timestamp = Date.now()
      const metadata = createValidMetadata("session-1", timestamp)

      // Create a promise we can control
      let resolveMetadata: (value: SessionMetadata) => void
      const metadataPromise = new Promise<SessionMetadata>(resolve => {
        resolveMetadata = resolve
      })

      mockDatabase.getSessionMetadata.mockReturnValue(metadataPromise)
      mockDatabase.getEventsForSession.mockResolvedValue([])

      const { result } = renderHook(() => useSessions())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Start loading events (don't await)
      const loadPromise = result.current.loadSessionEvents("session-1")

      // isLoadingEvents should be true while loading
      await waitFor(() => {
        expect(result.current.isLoadingEvents).toBe(true)
      })

      // Resolve the metadata
      resolveMetadata!(metadata)

      // Wait for loading to complete
      await loadPromise

      // Wait for state to update after promise resolves
      await waitFor(() => {
        expect(result.current.isLoadingEvents).toBe(false)
      })
    })
  })

  describe("clearSelectedSession", () => {
    it("clears the selected session and error", async () => {
      const timestamp = Date.now()
      const metadata = createValidMetadata("session-1", timestamp, "task-1", "Test Task")

      mockDatabase.getSessionMetadata.mockResolvedValue(metadata)
      mockDatabase.getEventsForSession.mockResolvedValue([])

      const { result } = renderHook(() => useSessions())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Load a session
      await result.current.loadSessionEvents("session-1")
      await waitFor(() => {
        expect(result.current.selectedSession).not.toBeNull()
      })

      // Clear it
      result.current.clearSelectedSession()

      await waitFor(() => {
        expect(result.current.selectedSession).toBeNull()
      })
      expect(result.current.eventsError).toBeNull()
    })
  })
})
