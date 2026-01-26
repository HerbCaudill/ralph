import { renderHook } from "@testing-library/react"
import { describe, it, expect, beforeEach, vi } from "vitest"
import { useEventStream } from "./useEventStream"
import { useAppStore, DEFAULT_INSTANCE_ID } from "@/store"

// Mock useSessions
vi.mock("@/hooks", async importOriginal => {
  const actual = await importOriginal<typeof import("@/hooks")>()
  return {
    ...actual,
    useSessions: vi.fn(() => ({
      sessions: [],
      isLoading: false,
      error: null,
      refresh: vi.fn(),
      loadSessionEvents: vi.fn(),
      selectedSession: null,
      isLoadingEvents: false,
      eventsError: null,
      clearSelectedSession: vi.fn(),
    })),
    useEventLogRouter: vi.fn(() => ({
      navigateToEventLog: vi.fn(),
      closeEventLogViewer: vi.fn(),
      eventLogId: null,
    })),
  }
})

describe("useEventStream", () => {
  beforeEach(() => {
    // Reset store state before each test
    useAppStore.getState().reset()
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
    it("returns task from ralph_task_started event", () => {
      useAppStore.getState().addEvent({
        type: "ralph_task_started",
        timestamp: 1705600000000,
        taskId: "rui-123",
        taskTitle: "Fix the bug",
      })

      const { result } = renderHook(() => useEventStream())

      expect(result.current.sessionTask).toEqual({
        id: "rui-123",
        title: "Fix the bug",
      })
    })

    it("returns task with only title when no taskId in event", () => {
      useAppStore.getState().addEvent({
        type: "ralph_task_started",
        timestamp: 1705600000000,
        taskTitle: "Ad hoc task",
      })

      const { result } = renderHook(() => useEventStream())

      expect(result.current.sessionTask).toEqual({
        id: null,
        title: "Ad hoc task",
      })
    })

    it("looks up task title from store when event has only taskId", () => {
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
          currentTaskTitle: "Restored task",
          createdAt: Date.now(),
          mergeConflict: null,
        },
      ])

      const { result } = renderHook(() => useEventStream())

      expect(result.current.sessionTask).toEqual({
        id: "rui-789",
        title: "Restored task",
      })
    })

    it("returns null when no task information available", () => {
      const { result } = renderHook(() => useEventStream())
      expect(result.current.sessionTask).toBe(null)
    })
  })

  describe("navigation actions", () => {
    it("provides selectSessionHistory action", () => {
      const { result } = renderHook(() => useEventStream())

      // The navigation object should have selectSessionHistory
      expect(result.current.navigation.selectSessionHistory).toBeDefined()
      expect(typeof result.current.navigation.selectSessionHistory).toBe("function")
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
})
