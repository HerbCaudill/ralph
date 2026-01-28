import { renderHook } from "@testing-library/react"
import { describe, it, expect, beforeEach, vi } from "vitest"
import { useEventStream } from "./useEventStream"
import { useAppStore, DEFAULT_INSTANCE_ID } from "@/store"

// Mock useSessions
const mockLoadSessionEvents = vi.fn()
const mockClearSelectedSession = vi.fn()
let mockSelectedSession: {
  id: string
  createdAt: string
  eventCount: number
  events: Array<{
    type: string
    timestamp: number
    message?: string
    taskId?: string
  }>
  metadata?: { taskId?: string; title?: string }
} | null = null
let mockIsLoadingEvents = false
let mockSessions: Array<{
  id: string
  createdAt: string
  eventCount: number
  metadata?: { taskId?: string; title?: string }
}> = []

vi.mock("@/hooks", async importOriginal => {
  const actual = await importOriginal<typeof import("@/hooks")>()
  return {
    ...actual,
    useSessions: vi.fn(() => ({
      sessions: mockSessions,
      isLoading: false,
      error: null,
      refresh: vi.fn(),
      loadSessionEvents: mockLoadSessionEvents,
      selectedSession: mockSelectedSession,
      isLoadingEvents: mockIsLoadingEvents,
      eventsError: null,
      clearSelectedSession: mockClearSelectedSession,
    })),
  }
})

describe("useEventStream", () => {
  beforeEach(() => {
    // Reset store state before each test
    useAppStore.getState().reset()
    // Reset mock functions and state
    mockLoadSessionEvents.mockClear()
    mockClearSelectedSession.mockClear()
    mockSelectedSession = null
    mockIsLoadingEvents = false
    mockSessions = []
    // Reset URL to root so the URL-based useEffect doesn't pick up session IDs from previous tests
    window.history.replaceState(null, "", "/")
  })

  describe("basic functionality", () => {
    it("returns session events from store", () => {
      useAppStore.getState().addEvent({
        type: "user_message",
        timestamp: 1705600000000,
        message: "Hello",
      })

      const { result } = renderHook(() => useEventStream())

      expect(result.current.sessionEvents).toHaveLength(1)
      expect(result.current.sessionEvents[0]).toMatchObject({
        type: "user_message",
        message: "Hello",
      })
    })

    it("returns ralph status from store", () => {
      useAppStore.getState().setRalphStatus("running")

      const { result } = renderHook(() => useEventStream())

      expect(result.current.ralphStatus).toBe("running")
      expect(result.current.isRunning).toBe(true)
    })

    it("returns isViewingLatest state", () => {
      // Add two sessions
      useAppStore.getState().addEvent({
        type: "system",
        timestamp: 1705600000000,
        subtype: "init",
      })
      useAppStore.getState().addEvent({
        type: "system",
        timestamp: 1705600001000,
        subtype: "init",
      })

      const { result } = renderHook(() => useEventStream())

      expect(result.current.isViewingLatest).toBe(true)
    })

    it("returns isViewingLatest as false when viewing historical session even if viewingSessionId is null", () => {
      // viewingSessionId remains null (would normally mean viewing latest)
      // but selectedSession is set (viewing historical via dropdown)
      mockSelectedSession = {
        id: "session-123",
        createdAt: new Date().toISOString(),
        eventCount: 0,
        events: [],
      }

      const { result } = renderHook(() => useEventStream())

      expect(result.current.isViewingLatest).toBe(false)
      expect(result.current.isViewingHistorical).toBe(true)
    })

    it("returns issue prefix from store", () => {
      useAppStore.getState().setIssuePrefix("rui-")

      const { result } = renderHook(() => useEventStream())

      expect(result.current.issuePrefix).toBe("rui-")
    })
  })

  describe("isRunning calculation", () => {
    it("returns true when status is running", () => {
      useAppStore.getState().setRalphStatus("running")
      const { result } = renderHook(() => useEventStream())
      expect(result.current.isRunning).toBe(true)
    })

    it("returns true when status is starting", () => {
      useAppStore.getState().setRalphStatus("starting")
      const { result } = renderHook(() => useEventStream())
      expect(result.current.isRunning).toBe(true)
    })

    it("returns true when status is stopping_after_current", () => {
      useAppStore.getState().setRalphStatus("stopping_after_current")
      const { result } = renderHook(() => useEventStream())
      expect(result.current.isRunning).toBe(true)
    })

    it("returns false when status is stopped", () => {
      useAppStore.getState().setRalphStatus("stopped")
      const { result } = renderHook(() => useEventStream())
      expect(result.current.isRunning).toBe(false)
    })

    it("returns false when status is paused", () => {
      useAppStore.getState().setRalphStatus("paused")
      const { result } = renderHook(() => useEventStream())
      expect(result.current.isRunning).toBe(false)
    })
  })

  describe("session task detection", () => {
    it("returns task from ralph_task_started event with title from store", () => {
      // Add task to store for title lookup
      useAppStore.getState().setTasks([
        {
          id: "rui-123",
          title: "Fix the bug",
          status: "in_progress",
        },
      ])
      useAppStore.getState().addEvent({
        type: "ralph_task_started",
        timestamp: 1705600000000,
        taskId: "rui-123",
      })

      const { result } = renderHook(() => useEventStream())

      expect(result.current.sessionTask).toEqual({
        id: "rui-123",
        title: "Fix the bug",
      })
    })

    it("falls back to taskId as title when no taskId in event", () => {
      // ralph_task_started without taskId results in null being extracted
      useAppStore.getState().addEvent({
        type: "ralph_task_started",
        timestamp: 1705600000000,
        // No taskId in event
      })

      const { result } = renderHook(() => useEventStream())

      // No task ID found, so sessionTask should be null
      expect(result.current.sessionTask).toBeNull()
    })

    it("falls back to taskId when task not found in store", () => {
      useAppStore.getState().addEvent({
        type: "ralph_task_started",
        timestamp: 1705600000000,
        taskId: "rui-123",
      })

      const { result } = renderHook(() => useEventStream())

      // Falls back to showing the ID as the title
      expect(result.current.sessionTask).toEqual({
        id: "rui-123",
        title: "rui-123",
      })
    })

    it("looks up task title from store when event has taskId", () => {
      useAppStore.getState().setTasks([
        {
          id: "rui-123",
          title: "Task from store",
          status: "in_progress",
        },
      ])
      useAppStore.getState().addEvent({
        type: "ralph_task_started",
        timestamp: 1705600000000,
        taskId: "rui-123",
      })

      const { result } = renderHook(() => useEventStream())

      expect(result.current.sessionTask).toEqual({
        id: "rui-123",
        title: "Task from store",
      })
    })

    it("falls back to in-progress task from store when no ralph_task_started event", () => {
      useAppStore.getState().setTasks([
        {
          id: "rui-456",
          title: "In progress task",
          status: "in_progress",
        },
      ])
      useAppStore.getState().addEvent({
        type: "user_message",
        timestamp: 1705600000000,
        message: "Hello",
      })

      const { result } = renderHook(() => useEventStream())

      expect(result.current.sessionTask).toEqual({
        id: "rui-456",
        title: "In progress task",
      })
    })

    it("falls back to instance currentTaskId when no event or in-progress task", () => {
      useAppStore.getState().hydrateInstances([
        {
          id: DEFAULT_INSTANCE_ID,
          name: "Default",
          agentName: "Ralph",
          status: "running",
          worktreePath: null,
          branch: null,
          currentTaskId: "rui-789",
          createdAt: Date.now(),
          mergeConflict: null,
        },
      ])

      const { result } = renderHook(() => useEventStream())

      // Title falls back to the task ID since task not in store
      expect(result.current.sessionTask).toEqual({
        id: "rui-789",
        title: "rui-789",
      })
    })

    it("returns null when no task information available", () => {
      const { result } = renderHook(() => useEventStream())
      expect(result.current.sessionTask).toBe(null)
    })

    it("uses task from historical session metadata", () => {
      // Add task to store for title lookup
      useAppStore.getState().setTasks([
        {
          id: "rui-historical",
          title: "Historical task title",
          status: "closed",
        },
      ])

      mockSelectedSession = {
        id: "session-123",
        createdAt: new Date().toISOString(),
        eventCount: 0,
        events: [],
        metadata: {
          taskId: "rui-historical",
        },
      }

      const { result } = renderHook(() => useEventStream())

      expect(result.current.sessionTask).toEqual({
        id: "rui-historical",
        title: "Historical task title",
      })
    })

    it("uses taskId as title fallback when historical metadata has only taskId", () => {
      mockSelectedSession = {
        id: "session-123",
        createdAt: new Date().toISOString(),
        eventCount: 0,
        events: [],
        metadata: {
          taskId: "rui-999",
        },
      }

      const { result } = renderHook(() => useEventStream())

      expect(result.current.sessionTask).toEqual({
        id: "rui-999",
        title: "rui-999",
      })
    })

    it("historical metadata takes precedence over events in session", () => {
      mockSelectedSession = {
        id: "session-123",
        createdAt: new Date().toISOString(),
        eventCount: 1,
        events: [
          {
            type: "ralph_task_started",
            timestamp: 1705600000000,
            taskId: "event-task",
          },
        ],
        metadata: {
          taskId: "metadata-task",
          title: "Metadata Task",
        },
      }

      // Add task to store for title lookup
      useAppStore.getState().setTasks([
        {
          id: "metadata-task",
          title: "Metadata Task",
          status: "in_progress",
        },
      ])

      const { result } = renderHook(() => useEventStream())

      // Should use metadata, not event
      expect(result.current.sessionTask).toEqual({
        id: "metadata-task",
        title: "Metadata Task",
      })
    })
  })

  describe("navigation actions", () => {
    it("provides selectSessionHistory action", () => {
      const { result } = renderHook(() => useEventStream())

      // The navigation object should have selectSessionHistory
      expect(result.current.navigation.selectSessionHistory).toBeDefined()
      expect(typeof result.current.navigation.selectSessionHistory).toBe("function")
    })

    it("provides returnToLive action", () => {
      const { result } = renderHook(() => useEventStream())

      // The navigation object should have returnToLive
      expect(result.current.navigation.returnToLive).toBeDefined()
      expect(typeof result.current.navigation.returnToLive).toBe("function")
    })

    it("selectSessionHistory calls loadSessionEvents with the correct session ID", () => {
      const { result } = renderHook(() => useEventStream())

      result.current.navigation.selectSessionHistory("session-123")

      expect(mockLoadSessionEvents).toHaveBeenCalledTimes(1)
      expect(mockLoadSessionEvents).toHaveBeenCalledWith("session-123")
    })

    it("returnToLive calls clearSelectedSession", () => {
      const { result } = renderHook(() => useEventStream())

      // Clear the mount-time call (URL is "/" so clearSelectedSession is called on mount)
      mockClearSelectedSession.mockClear()

      result.current.navigation.returnToLive()

      expect(mockClearSelectedSession).toHaveBeenCalledTimes(1)
    })
  })

  describe("previous/next navigation", () => {
    // Sessions are sorted newest-first: [newest, ..., oldest]
    const threeSessions = [
      { id: "session-c", createdAt: "2024-01-20T00:00:00Z", eventCount: 1 },
      { id: "session-b", createdAt: "2024-01-19T00:00:00Z", eventCount: 1 },
      { id: "session-a", createdAt: "2024-01-18T00:00:00Z", eventCount: 1 },
    ]

    describe("hasPrevious", () => {
      it("is true when viewing live and sessions exist", () => {
        mockSessions = threeSessions
        mockSelectedSession = null

        const { result } = renderHook(() => useEventStream())

        expect(result.current.navigation.hasPrevious).toBe(true)
      })

      it("is false when viewing live and no sessions exist", () => {
        mockSessions = []
        mockSelectedSession = null

        const { result } = renderHook(() => useEventStream())

        expect(result.current.navigation.hasPrevious).toBe(false)
      })

      it("is true when viewing a historical session that is not the oldest", () => {
        mockSessions = threeSessions
        mockSelectedSession = {
          id: "session-b",
          createdAt: "2024-01-19T00:00:00Z",
          eventCount: 1,
          events: [],
        }

        const { result } = renderHook(() => useEventStream())

        // session-b is at index 1, sessions.length - 1 is 2, so 1 < 2 => true
        expect(result.current.navigation.hasPrevious).toBe(true)
      })

      it("is false when viewing the oldest historical session", () => {
        mockSessions = threeSessions
        mockSelectedSession = {
          id: "session-a",
          createdAt: "2024-01-18T00:00:00Z",
          eventCount: 1,
          events: [],
        }

        const { result } = renderHook(() => useEventStream())

        // session-a is at index 2, sessions.length - 1 is 2, so 2 < 2 => false
        expect(result.current.navigation.hasPrevious).toBe(false)
      })
    })

    describe("hasNext", () => {
      it("is true when viewing any historical session", () => {
        mockSessions = threeSessions
        mockSelectedSession = {
          id: "session-a",
          createdAt: "2024-01-18T00:00:00Z",
          eventCount: 1,
          events: [],
        }

        const { result } = renderHook(() => useEventStream())

        expect(result.current.navigation.hasNext).toBe(true)
      })

      it("is false when viewing live", () => {
        mockSessions = threeSessions
        mockSelectedSession = null

        const { result } = renderHook(() => useEventStream())

        expect(result.current.navigation.hasNext).toBe(false)
      })
    })

    describe("goToPrevious", () => {
      it("from live, navigates to the most recent historical session", () => {
        mockSessions = threeSessions
        mockSelectedSession = null

        const { result } = renderHook(() => useEventStream())
        result.current.navigation.goToPrevious()

        expect(mockLoadSessionEvents).toHaveBeenCalledWith("session-c")
      })

      it("from a historical session, navigates to the next older session", () => {
        mockSessions = threeSessions
        mockSelectedSession = {
          id: "session-c",
          createdAt: "2024-01-20T00:00:00Z",
          eventCount: 1,
          events: [],
        }

        const { result } = renderHook(() => useEventStream())
        result.current.navigation.goToPrevious()

        // session-c is index 0, next older is index 1 => session-b
        expect(mockLoadSessionEvents).toHaveBeenCalledWith("session-b")
      })

      it("does nothing when viewing the oldest session", () => {
        mockSessions = threeSessions
        mockSelectedSession = {
          id: "session-a",
          createdAt: "2024-01-18T00:00:00Z",
          eventCount: 1,
          events: [],
        }

        const { result } = renderHook(() => useEventStream())
        result.current.navigation.goToPrevious()

        // session-a is index 2, next would be index 3 which is >= sessions.length
        expect(mockLoadSessionEvents).not.toHaveBeenCalled()
      })

      it("does nothing when viewing live and no sessions exist", () => {
        mockSessions = []
        mockSelectedSession = null

        const { result } = renderHook(() => useEventStream())
        result.current.navigation.goToPrevious()

        expect(mockLoadSessionEvents).not.toHaveBeenCalled()
      })
    })

    describe("goToNext", () => {
      it("from the most recent historical session, returns to live", () => {
        mockSessions = threeSessions
        mockSelectedSession = {
          id: "session-c",
          createdAt: "2024-01-20T00:00:00Z",
          eventCount: 1,
          events: [],
        }

        const { result } = renderHook(() => useEventStream())
        // Clear any calls from mount effects before testing navigation action
        mockClearSelectedSession.mockClear()
        mockLoadSessionEvents.mockClear()

        result.current.navigation.goToNext()

        // session-c is index 0, which is <= 0, so it should return to live
        expect(mockClearSelectedSession).toHaveBeenCalledTimes(1)
        expect(mockLoadSessionEvents).not.toHaveBeenCalled()
      })

      it("from an older historical session, navigates to the next newer session", () => {
        mockSessions = threeSessions
        mockSelectedSession = {
          id: "session-a",
          createdAt: "2024-01-18T00:00:00Z",
          eventCount: 1,
          events: [],
        }

        const { result } = renderHook(() => useEventStream())
        result.current.navigation.goToNext()

        // session-a is index 2, next newer is index 1 => session-b
        expect(mockLoadSessionEvents).toHaveBeenCalledWith("session-b")
      })

      it("from the middle session, navigates to the newest historical session", () => {
        mockSessions = threeSessions
        mockSelectedSession = {
          id: "session-b",
          createdAt: "2024-01-19T00:00:00Z",
          eventCount: 1,
          events: [],
        }

        const { result } = renderHook(() => useEventStream())
        result.current.navigation.goToNext()

        // session-b is index 1, next newer is index 0 => session-c
        expect(mockLoadSessionEvents).toHaveBeenCalledWith("session-c")
      })

      it("does nothing when viewing live", () => {
        mockSessions = threeSessions
        mockSelectedSession = null

        const { result } = renderHook(() => useEventStream())
        // Clear any calls from mount effects before testing navigation action
        mockClearSelectedSession.mockClear()
        mockLoadSessionEvents.mockClear()

        result.current.navigation.goToNext()

        expect(mockLoadSessionEvents).not.toHaveBeenCalled()
        expect(mockClearSelectedSession).not.toHaveBeenCalled()
      })
    })
  })

  describe("historical session viewing", () => {
    it("returns isViewingHistorical as false when no session selected", () => {
      const { result } = renderHook(() => useEventStream())

      expect(result.current.isViewingHistorical).toBe(false)
    })

    it("returns isLoadingHistoricalEvents from useSessions", () => {
      const { result } = renderHook(() => useEventStream())

      // Should be false by default (from mock)
      expect(result.current.isLoadingHistoricalEvents).toBe(false)
    })

    it("returns isViewingHistorical as true when selectedSession is not null", () => {
      mockSelectedSession = {
        id: "session-123",
        createdAt: new Date().toISOString(),
        eventCount: 1,
        events: [{ type: "user_message", timestamp: 1705600000000, message: "Historical message" }],
      }

      const { result } = renderHook(() => useEventStream())

      expect(result.current.isViewingHistorical).toBe(true)
    })

    it("uses historical events when selectedSession is set", () => {
      // Add a live event to the store
      useAppStore.getState().addEvent({
        type: "user_message",
        timestamp: 1705600001000,
        message: "Live message",
      })

      // Set up a historical session with different events
      mockSelectedSession = {
        id: "session-123",
        createdAt: new Date().toISOString(),
        eventCount: 2,
        events: [
          { type: "user_message", timestamp: 1705600000000, message: "Historical message 1" },
          { type: "user_message", timestamp: 1705600000500, message: "Historical message 2" },
        ],
      }

      const { result } = renderHook(() => useEventStream())

      // Should return historical events, not live events
      expect(result.current.sessionEvents).toHaveLength(2)
      expect(result.current.sessionEvents[0]).toMatchObject({
        type: "user_message",
        message: "Historical message 1",
      })
      expect(result.current.sessionEvents[1]).toMatchObject({
        type: "user_message",
        message: "Historical message 2",
      })
    })

    it("returns currentSessionId from selectedSession", () => {
      mockSelectedSession = {
        id: "session-456",
        createdAt: new Date().toISOString(),
        eventCount: 0,
        events: [],
      }

      const { result } = renderHook(() => useEventStream())

      expect(result.current.currentSessionId).toBe("session-456")
    })

    it("returns empty sessionEvents while loading historical events", () => {
      // Simulate loading state: no selectedSession yet, but loading is true
      mockIsLoadingEvents = true
      mockSelectedSession = null

      // Add live events that should NOT leak through during loading
      useAppStore.getState().addEvent({
        type: "user_message",
        timestamp: 1705600001000,
        message: "Live message that should not appear",
      })

      const { result } = renderHook(() => useEventStream())

      // Should return empty array, not live events
      expect(result.current.sessionEvents).toEqual([])
      expect(result.current.isLoadingHistoricalEvents).toBe(true)
    })

    it("returns isViewingLatest as false while loading historical events", () => {
      // During loading: viewingSessionId is null, selectedSession is null
      // but isLoadingEvents is true — should NOT be considered "viewing latest"
      mockIsLoadingEvents = true
      mockSelectedSession = null

      const { result } = renderHook(() => useEventStream())

      expect(result.current.isViewingLatest).toBe(false)
      expect(result.current.isLoadingHistoricalEvents).toBe(true)
    })
  })

  describe("instance-specific events", () => {
    it("returns events from specific instance when instanceId is provided", () => {
      // Create a second instance
      useAppStore.getState().createInstance("instance-2", "Second Instance")

      // Add events to the second instance
      useAppStore.getState().addEvent({
        type: "user_message",
        timestamp: 1705600000000,
        message: "Instance 2 message",
      })

      // Switch back to default instance
      useAppStore.getState().setActiveInstanceId(DEFAULT_INSTANCE_ID)

      // Add an event to the default instance
      useAppStore.getState().addEvent({
        type: "user_message",
        timestamp: 1705600001000,
        message: "Default instance message",
      })

      // Render with instanceId pointing to instance-2
      const { result } = renderHook(() => useEventStream({ instanceId: "instance-2" }))

      // Should have instance-2's event
      expect(result.current.sessionEvents).toHaveLength(1)
      expect(result.current.sessionEvents[0]).toMatchObject({
        message: "Instance 2 message",
      })
    })

    it("returns status from specific instance when instanceId is provided", () => {
      // Create a second instance
      useAppStore.getState().createInstance("instance-2", "Second Instance")

      // Set the second instance as running
      useAppStore.getState().setRalphStatus("running")

      // Switch back to default instance (which should be stopped)
      useAppStore.getState().setActiveInstanceId(DEFAULT_INSTANCE_ID)

      // Render with instanceId pointing to the running instance
      const { result } = renderHook(() => useEventStream({ instanceId: "instance-2" }))

      // Should show running status
      expect(result.current.ralphStatus).toBe("running")
      expect(result.current.isRunning).toBe(true)
    })
  })

  describe("containerRef", () => {
    it("provides a ref for the container element", () => {
      const { result } = renderHook(() => useEventStream())
      expect(result.current.containerRef).toBeDefined()
      expect(result.current.containerRef.current).toBe(null)
    })
  })

  describe("URL-based session navigation (popstate)", () => {
    it("calls clearSelectedSession on mount when URL has no session ID", () => {
      // URL is "/" (set in beforeEach)
      renderHook(() => useEventStream())

      // clearSelectedSession should be called during mount because URL is "/"
      expect(mockClearSelectedSession).toHaveBeenCalledTimes(1)
    })

    it("calls loadSessionEvents on mount when URL has a session ID", () => {
      // Set URL to a session path before mounting
      window.history.replaceState(null, "", "/session/session-abc")

      renderHook(() => useEventStream())

      expect(mockLoadSessionEvents).toHaveBeenCalledWith("session-abc")
      // clearSelectedSession should NOT be called since URL has a session ID
      expect(mockClearSelectedSession).not.toHaveBeenCalled()
    })

    it("clears selected session when a popstate event fires with no session ID in URL", () => {
      renderHook(() => useEventStream())

      // Clear mount-time call
      mockClearSelectedSession.mockClear()

      // Simulate the pattern used by goToLatestSession in App.tsx:
      // pushState to "/" then dispatch popstate
      window.history.pushState(null, "", "/")
      window.dispatchEvent(new PopStateEvent("popstate"))

      expect(mockClearSelectedSession).toHaveBeenCalledTimes(1)
    })

    it("loads session events when a popstate event fires with a session ID in URL", () => {
      renderHook(() => useEventStream())

      // Clear mount-time calls
      mockClearSelectedSession.mockClear()
      mockLoadSessionEvents.mockClear()

      // Simulate navigating to a session via URL
      window.history.pushState(null, "", "/session/session-xyz")
      window.dispatchEvent(new PopStateEvent("popstate"))

      expect(mockLoadSessionEvents).toHaveBeenCalledWith("session-xyz")
      expect(mockClearSelectedSession).not.toHaveBeenCalled()
    })

    it("clears selected session on popstate even when no session was previously selected", () => {
      // This tests the "always clear" behavior: clearSelectedSession is called
      // even when selectedSession is already null. This ensures the dispatched
      // popstate from goToLatestSession works without stale closure issues.
      mockSelectedSession = null

      renderHook(() => useEventStream())

      // Mount-time call should have happened even though mockSelectedSession is null
      expect(mockClearSelectedSession).toHaveBeenCalledTimes(1)

      // Clear and fire another popstate
      mockClearSelectedSession.mockClear()
      window.history.pushState(null, "", "/")
      window.dispatchEvent(new PopStateEvent("popstate"))

      // Should still call clearSelectedSession (idempotent)
      expect(mockClearSelectedSession).toHaveBeenCalledTimes(1)
    })

    it("removes popstate and hashchange listeners on unmount", () => {
      const addSpy = vi.spyOn(window, "addEventListener")
      const removeSpy = vi.spyOn(window, "removeEventListener")

      const { unmount } = renderHook(() => useEventStream())

      // Should have added popstate and hashchange listeners
      expect(addSpy).toHaveBeenCalledWith("popstate", expect.any(Function))
      expect(addSpy).toHaveBeenCalledWith("hashchange", expect.any(Function))

      unmount()

      // Should have removed both listeners
      expect(removeSpy).toHaveBeenCalledWith("popstate", expect.any(Function))
      expect(removeSpy).toHaveBeenCalledWith("hashchange", expect.any(Function))

      addSpy.mockRestore()
      removeSpy.mockRestore()
    })
  })
})
