import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { useSessions } from "./useSessions"
import { eventDatabase, type SessionMetadata } from "@/lib/persistence"
import { beadsViewStore, type Task } from "@herbcaudill/beads-view"

// Mock the eventDatabase
vi.mock("@/lib/persistence", () => ({
  eventDatabase: {
    init: vi.fn().mockResolvedValue(undefined),
    listAllSessions: vi.fn().mockResolvedValue([]),
    getSessionsForTask: vi.fn().mockResolvedValue([]),
    listSessionsByWorkspace: vi.fn().mockResolvedValue([]),
    getSessionsForTaskInWorkspace: vi.fn().mockResolvedValue([]),
    getSessionMetadata: vi.fn().mockResolvedValue(undefined),
    getSession: vi.fn().mockResolvedValue(undefined),
    getEventsForSession: vi.fn().mockResolvedValue([]),
    saveSession: vi.fn().mockResolvedValue(undefined),
  },
}))

describe("useSessions", () => {
  const mockDatabase = vi.mocked(eventDatabase)

  const createValidMetadata = (
    id: string,
    startedAt: number,
    taskId?: string,
  ): SessionMetadata => ({
    id,
    instanceId: "default",
    workspaceId: null,
    startedAt,
    completedAt: null,
    taskId: taskId ?? null,
    tokenUsage: { input: 0, output: 0 },
    contextWindow: { used: 0, max: 200000 },
    session: { current: 1, total: 1 },
    eventCount: 5,
    lastEventSequence: 4,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset store state to ensure test isolation
    beadsViewStore.setState({ tasks: [] })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    // Clean up store state
    beadsViewStore.setState({ tasks: [] })
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
        createValidMetadata("iter-1", timestamp, "task-1"),
      ])

      // Set up tasks in store for title lookup
      beadsViewStore.getState().setTasks([
        {
          id: "task-1",
          title: "Test Task",
          status: "in_progress",
        },
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
        createValidMetadata("iter-1", timestamp, "task-1"),
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
    beforeEach(() => {
      // Reset store to ensure clean state (no tasks from previous tests)
      beadsViewStore.setState({ tasks: [] })
    })

    afterEach(() => {
      beadsViewStore.setState({ tasks: [] })
    })

    it("returns undefined metadata when taskId is not present", async () => {
      const timestamp = Date.now()
      mockDatabase.listAllSessions.mockResolvedValue([createValidMetadata("iter-1", timestamp)])

      const { result } = renderHook(() => useSessions())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.sessions[0].metadata).toBeUndefined()
    })

    it("returns metadata with only taskId when task not in store", async () => {
      const timestamp = Date.now()
      mockDatabase.listAllSessions.mockResolvedValue([
        createValidMetadata("iter-1", timestamp, "task-1"),
      ])

      const { result } = renderHook(() => useSessions())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // No task in store, so title is undefined
      expect(result.current.sessions[0].metadata).toEqual({
        taskId: "task-1",
        title: undefined,
      })
    })
  })

  describe("workspace-scoped loading", () => {
    it("loads sessions filtered by workspaceId when provided", async () => {
      const timestamp = Date.now()
      mockDatabase.listSessionsByWorkspace.mockResolvedValue([
        createValidMetadata("iter-1", timestamp, "task-1"),
      ])

      const { result } = renderHook(() => useSessions({ workspaceId: "/my/workspace" }))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockDatabase.listSessionsByWorkspace).toHaveBeenCalledWith("/my/workspace")
      expect(mockDatabase.listAllSessions).not.toHaveBeenCalled()
      expect(mockDatabase.getSessionsForTask).not.toHaveBeenCalled()
    })

    it("loads sessions filtered by both taskId and workspaceId when both provided", async () => {
      const timestamp = Date.now()
      mockDatabase.getSessionsForTaskInWorkspace.mockResolvedValue([
        createValidMetadata("iter-1", timestamp, "task-1"),
      ])

      const { result } = renderHook(() =>
        useSessions({ taskId: "task-1", workspaceId: "/my/workspace" }),
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockDatabase.getSessionsForTaskInWorkspace).toHaveBeenCalledWith(
        "task-1",
        "/my/workspace",
      )
      expect(mockDatabase.listAllSessions).not.toHaveBeenCalled()
      expect(mockDatabase.getSessionsForTask).not.toHaveBeenCalled()
      expect(mockDatabase.listSessionsByWorkspace).not.toHaveBeenCalled()
    })

    it("falls back to taskId-only filtering when workspaceId is not provided", async () => {
      const timestamp = Date.now()
      mockDatabase.getSessionsForTask.mockResolvedValue([
        createValidMetadata("iter-1", timestamp, "task-1"),
      ])

      const { result } = renderHook(() => useSessions({ taskId: "task-1" }))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockDatabase.getSessionsForTask).toHaveBeenCalledWith("task-1")
      expect(mockDatabase.getSessionsForTaskInWorkspace).not.toHaveBeenCalled()
    })

    it("refetches when workspaceId changes", async () => {
      const timestamp = Date.now()
      mockDatabase.listSessionsByWorkspace.mockResolvedValue([
        createValidMetadata("iter-1", timestamp),
      ])

      const { result, rerender } = renderHook(({ workspaceId }) => useSessions({ workspaceId }), {
        initialProps: { workspaceId: "/workspace-a" },
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockDatabase.listSessionsByWorkspace).toHaveBeenCalledWith("/workspace-a")

      // Change workspace
      rerender({ workspaceId: "/workspace-b" })

      await waitFor(() => {
        expect(mockDatabase.listSessionsByWorkspace).toHaveBeenCalledWith("/workspace-b")
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
      const metadata = createValidMetadata("session-1", timestamp, "task-1")

      mockDatabase.getSession.mockResolvedValue(metadata)
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

    it("falls back to embedded events when events table is empty", async () => {
      const timestamp = Date.now()
      const embeddedEvents = [
        { type: "user", message: { content: "Hello" }, timestamp: timestamp + 100 },
        {
          type: "assistant",
          message: { content: [{ type: "text", text: "Hi!" }] },
          timestamp: timestamp + 200,
        },
      ]
      const sessionWithEmbeddedEvents = {
        ...createValidMetadata("session-1", timestamp, "task-1"),
        events: embeddedEvents,
      }

      mockDatabase.getSession.mockResolvedValue(sessionWithEmbeddedEvents)
      // Events table returns empty — simulates pre-v3 or missing events
      mockDatabase.getEventsForSession.mockResolvedValue([])

      const { result } = renderHook(() => useSessions())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const sessionWithEvents = await result.current.loadSessionEvents("session-1")

      expect(sessionWithEvents).not.toBeNull()
      expect(sessionWithEvents?.events).toHaveLength(2)
      expect(sessionWithEvents?.events[0].type).toBe("user")
      expect(sessionWithEvents?.events[1].type).toBe("assistant")
    })

    it("returns null and sets error when session not found", async () => {
      mockDatabase.getSession.mockResolvedValue(undefined)

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
      mockDatabase.getSession.mockRejectedValue(new Error("Database error"))

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

      mockDatabase.getSession.mockReturnValue(metadataPromise)
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
      const metadata = createValidMetadata("session-1", timestamp, "task-1")

      mockDatabase.getSession.mockResolvedValue(metadata)
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

  describe("task title enrichment", () => {
    const createTask = (id: string, title: string): Task => ({
      id,
      title,
      status: "open",
      issue_type: "task",
      priority: 2,
    })

    beforeEach(() => {
      // Reset store state before each test
      beadsViewStore.setState({ tasks: [] })
    })

    afterEach(() => {
      // Clean up store state
      beadsViewStore.setState({ tasks: [] })
    })

    it("enriches session with task title from store when title matches taskId", async () => {
      const timestamp = Date.now()
      // Session has taskId but title is the same as ID (fallback)
      mockDatabase.listAllSessions.mockResolvedValue([
        createValidMetadata("session-1", timestamp, "task-123"),
      ])

      // Store has the actual task with proper title
      beadsViewStore.setState({
        tasks: [createTask("task-123", "Fix login bug")],
      })

      const { result } = renderHook(() => useSessions())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // The session should have the enriched title from the store
      expect(result.current.sessions[0].metadata?.title).toBe("Fix login bug")
      expect(result.current.sessions[0].metadata?.taskId).toBe("task-123")
    })

    it("enriches session with task title when title is undefined", async () => {
      const timestamp = Date.now()
      // Session has taskId but no title
      mockDatabase.listAllSessions.mockResolvedValue([
        createValidMetadata("session-1", timestamp, "task-456"),
      ])

      // Store has the actual task with proper title
      beadsViewStore.setState({
        tasks: [createTask("task-456", "Add dark mode")],
      })

      const { result } = renderHook(() => useSessions())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // The session should have the enriched title from the store
      expect(result.current.sessions[0].metadata?.title).toBe("Add dark mode")
    })

    it("uses title from store when available", async () => {
      const timestamp = Date.now()
      // Session has taskId
      mockDatabase.listAllSessions.mockResolvedValue([
        createValidMetadata("session-1", timestamp, "task-789"),
      ])

      // Store has the task with a title
      beadsViewStore.setState({
        tasks: [createTask("task-789", "Task From Store")],
      })

      const { result } = renderHook(() => useSessions())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Should use the title from the store
      expect(result.current.sessions[0].metadata?.title).toBe("Task From Store")
    })

    it("filters out sessions without taskId by default", async () => {
      const timestamp = Date.now()
      // Session has no taskId
      mockDatabase.listAllSessions.mockResolvedValue([createValidMetadata("session-1", timestamp)])

      beadsViewStore.setState({
        tasks: [createTask("task-123", "Some Task")],
      })

      const { result } = renderHook(() => useSessions())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Session without taskId should be filtered out
      expect(result.current.sessions).toHaveLength(0)
    })

    it("includes sessions without taskId when includeTaskless is true", async () => {
      const timestamp = Date.now()
      // Session has no taskId
      mockDatabase.listAllSessions.mockResolvedValue([createValidMetadata("session-1", timestamp)])

      beadsViewStore.setState({
        tasks: [createTask("task-123", "Some Task")],
      })

      const { result } = renderHook(() => useSessions({ includeTaskless: true }))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Session without taskId should be included
      expect(result.current.sessions).toHaveLength(1)
      expect(result.current.sessions[0].metadata).toBeUndefined()
    })

    it("returns sessions with undefined title when store has no tasks", async () => {
      const timestamp = Date.now()
      // Session has taskId but no title
      mockDatabase.listAllSessions.mockResolvedValue([
        createValidMetadata("session-1", timestamp, "task-123"),
      ])

      // Store has no tasks
      beadsViewStore.setState({ tasks: [] })

      const { result } = renderHook(() => useSessions())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Title should be undefined when not found in store
      expect(result.current.sessions[0].metadata?.taskId).toBe("task-123")
      expect(result.current.sessions[0].metadata?.title).toBeUndefined()
    })

    it("returns session with undefined title when task not found in store", async () => {
      const timestamp = Date.now()
      mockDatabase.listAllSessions.mockResolvedValue([
        createValidMetadata("session-1", timestamp, "task-123"),
      ])

      // Store has different tasks, not the one we're looking for
      beadsViewStore.setState({
        tasks: [createTask("task-other", "Other Task")],
      })

      const { result } = renderHook(() => useSessions())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Title should be undefined since task not found in store
      expect(result.current.sessions[0].metadata?.taskId).toBe("task-123")
      expect(result.current.sessions[0].metadata?.title).toBeUndefined()
    })

    it("enriches multiple sessions correctly", async () => {
      const timestamp = Date.now()
      mockDatabase.listAllSessions.mockResolvedValue([
        createValidMetadata("session-1", timestamp, "task-1"),
        createValidMetadata("session-2", timestamp + 1000, "task-2"),
        createValidMetadata("session-3", timestamp + 2000, "task-3"),
        createValidMetadata("session-4", timestamp + 3000, "task-unknown"),
      ])

      beadsViewStore.setState({
        tasks: [
          createTask("task-1", "First Task Title"),
          createTask("task-2", "Second Task Title"),
          createTask("task-3", "Third Task Title"),
          // task-unknown is not in the store
        ],
      })

      const { result } = renderHook(() => useSessions())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // All sessions with matching tasks should be enriched with titles
      expect(result.current.sessions[0].metadata?.title).toBe("First Task Title")
      expect(result.current.sessions[1].metadata?.title).toBe("Second Task Title")
      expect(result.current.sessions[2].metadata?.title).toBe("Third Task Title")

      // Session without matching task should have undefined title
      expect(result.current.sessions[3].metadata?.taskId).toBe("task-unknown")
      expect(result.current.sessions[3].metadata?.title).toBeUndefined()
    })

    it("filters out sessions without taskId while keeping sessions with taskId", async () => {
      const timestamp = Date.now()
      mockDatabase.listAllSessions.mockResolvedValue([
        createValidMetadata("session-with-task", timestamp, "task-1"),
        createValidMetadata("session-without-task", timestamp + 1000),
        createValidMetadata("session-with-task-2", timestamp + 2000, "task-2"),
      ])

      beadsViewStore.setState({
        tasks: [createTask("task-1", "First Task"), createTask("task-2", "Second Task")],
      })

      const { result } = renderHook(() => useSessions())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Only sessions with taskId should be returned
      expect(result.current.sessions).toHaveLength(2)
      expect(result.current.sessions[0].id).toBe("session-with-task")
      expect(result.current.sessions[1].id).toBe("session-with-task-2")
    })
  })
})
