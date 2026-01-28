/**
 * Tests for useStoreHydration hook.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { useStoreHydration } from "./useStoreHydration"
import { eventDatabase } from "@/lib/persistence"
import { useAppStore, selectEvents } from "@/store"
import type { PersistedSession, PersistedTaskChatSession } from "@/lib/persistence"
import type { ChatEvent, TaskChatMessage } from "@/types"

// Mock the eventDatabase
vi.mock("@/lib/persistence", () => ({
  eventDatabase: {
    init: vi.fn().mockResolvedValue(undefined),
    getLatestActiveSession: vi.fn().mockResolvedValue(undefined),
    getLatestActiveSessionForWorkspace: vi.fn().mockResolvedValue(undefined),
    getLatestTaskChatSessionForInstance: vi.fn().mockResolvedValue(undefined),
    getTaskChatSession: vi.fn().mockResolvedValue(undefined),
    getEventsForSession: vi.fn().mockResolvedValue([]),
  },
}))

describe("useStoreHydration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAppStore.getState().reset()
    vi.spyOn(console, "log").mockImplementation(() => {})
    vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    useAppStore.getState().reset()
  })

  it("should initialize database on mount", async () => {
    renderHook(() => useStoreHydration({ instanceId: "default" }))

    await waitFor(() => {
      expect(eventDatabase.init).toHaveBeenCalled()
    })
  })

  it("should set isHydrated to true after hydration completes", async () => {
    const { result } = renderHook(() => useStoreHydration({ instanceId: "default" }))

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true)
    })
  })

  it("should restore events from active session", async () => {
    const mockEvents: ChatEvent[] = [
      { type: "system", timestamp: 1000, subtype: "init" } as any,
      {
        type: "assistant",
        timestamp: 2000,
        message: { content: [{ type: "text", text: "Hello" }] },
      } as any,
    ]

    const mockSession: PersistedSession = {
      id: "default-1000",
      instanceId: "default",
      workspaceId: null,
      startedAt: 1000,
      completedAt: null,
      taskId: null,
      tokenUsage: { input: 100, output: 50 },
      contextWindow: { used: 150, max: 200000 },
      session: { current: 1, total: 1 },
      eventCount: 2,
      lastEventSequence: 1,
      events: mockEvents,
    }

    vi.mocked(eventDatabase.getLatestActiveSession).mockResolvedValue(mockSession)

    const { result } = renderHook(() => useStoreHydration({ instanceId: "default" }))

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true)
    })

    // Check that events were restored (read from instances Map via selector)
    expect(selectEvents(useAppStore.getState())).toEqual(mockEvents)
  })

  it("should restore task chat messages from latest session", async () => {
    const mockMessages: TaskChatMessage[] = [
      { id: "msg-1", role: "user", content: "Hello", timestamp: 1000 },
      { id: "msg-2", role: "assistant", content: "Hi there!", timestamp: 2000 },
    ]

    const mockEvents: ChatEvent[] = [{ type: "user", timestamp: 1000, message: "Hello" } as any]

    const mockSession: PersistedTaskChatSession = {
      id: "default-task-abc-1000",
      taskId: "abc",
      instanceId: "default",
      createdAt: 1000,
      updatedAt: 2000,
      messageCount: 2,
      eventCount: 1,
      lastEventSequence: 0,
      messages: mockMessages,
      events: mockEvents,
    }

    vi.mocked(eventDatabase.getLatestTaskChatSessionForInstance).mockResolvedValue(mockSession)

    const { result } = renderHook(() => useStoreHydration({ instanceId: "default" }))

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true)
    })

    // Check that task chat messages were restored
    expect(useAppStore.getState().taskChatMessages).toEqual(mockMessages)
    expect(useAppStore.getState().taskChatEvents).toEqual(mockEvents)
  })

  it("should handle errors gracefully", async () => {
    const error = new Error("Database error")
    vi.mocked(eventDatabase.init).mockRejectedValue(error)

    const { result } = renderHook(() => useStoreHydration({ instanceId: "default" }))

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true)
      expect(result.current.error).toBe(error)
    })
  })

  it("should not hydrate when disabled", async () => {
    const { result } = renderHook(() =>
      useStoreHydration({ instanceId: "default", enabled: false }),
    )

    expect(result.current.isHydrated).toBe(true)
    expect(eventDatabase.init).not.toHaveBeenCalled()
  })

  it("should only hydrate same instance once", async () => {
    const { rerender } = renderHook(({ instanceId }) => useStoreHydration({ instanceId }), {
      initialProps: { instanceId: "default" },
    })

    await waitFor(() => {
      expect(eventDatabase.init).toHaveBeenCalledTimes(1)
    })

    // Rerender with the same props
    rerender({ instanceId: "default" })

    // Should still only be called once for the same instance
    expect(eventDatabase.init).toHaveBeenCalledTimes(1)
  })

  it("should hydrate when switching to a different instance", async () => {
    const mockEventsDefault: ChatEvent[] = [
      { type: "system", timestamp: 1000, subtype: "init" } as any,
    ]
    const mockEventsOther: ChatEvent[] = [
      { type: "system", timestamp: 2000, subtype: "init" } as any,
      {
        type: "assistant",
        timestamp: 3000,
        message: { content: [{ type: "text", text: "Hi" }] },
      } as any,
    ]

    // Mock session for default instance
    const mockSessionDefault: PersistedSession = {
      id: "default-1000",
      instanceId: "default",
      workspaceId: null,
      startedAt: 1000,
      completedAt: null,
      taskId: null,
      tokenUsage: { input: 100, output: 50 },
      contextWindow: { used: 150, max: 200000 },
      session: { current: 1, total: 1 },
      eventCount: 1,
      lastEventSequence: 0,
      events: mockEventsDefault,
    }

    // Mock session for other instance
    const mockSessionOther: PersistedSession = {
      id: "other-2000",
      instanceId: "other-instance",
      workspaceId: null,
      startedAt: 2000,
      completedAt: null,
      taskId: null,
      tokenUsage: { input: 200, output: 100 },
      contextWindow: { used: 300, max: 200000 },
      session: { current: 2, total: 2 },
      eventCount: 2,
      lastEventSequence: 1,
      events: mockEventsOther,
    }

    // Ensure mocks are fresh (in case previous test didn't clean up properly)
    vi.mocked(eventDatabase.init).mockResolvedValue(undefined)
    vi.mocked(eventDatabase.getLatestActiveSession).mockResolvedValue(mockSessionDefault)
    vi.mocked(eventDatabase.getLatestActiveSessionForWorkspace).mockResolvedValue(undefined)
    vi.mocked(eventDatabase.getLatestTaskChatSessionForInstance).mockResolvedValue(undefined)
    vi.mocked(eventDatabase.getTaskChatSession).mockResolvedValue(undefined)
    vi.mocked(eventDatabase.getEventsForSession).mockResolvedValue([])

    // Hydrate default instance first
    const { result: result1 } = renderHook(() => useStoreHydration({ instanceId: "default" }))

    await waitFor(() => {
      expect(result1.current.isHydrated).toBe(true)
    })

    // Verify hydration happened for default
    expect(eventDatabase.getLatestActiveSession).toHaveBeenCalledWith("default")
    expect(useAppStore.getState().instances.get("default")?.events).toEqual(mockEventsDefault)

    // Create the other instance in the store BEFORE hydrating it
    useAppStore.getState().createInstance("other-instance", "Other")

    // Change mock to return the other session
    vi.mocked(eventDatabase.getLatestActiveSession).mockResolvedValue(mockSessionOther)

    // Now hydrate the other instance with a NEW hook instance
    const { result: result2 } = renderHook(() =>
      useStoreHydration({ instanceId: "other-instance" }),
    )

    // Wait for hydration to complete for other instance
    await waitFor(() => {
      expect(result2.current.isHydrated).toBe(true)
    })

    expect(eventDatabase.getLatestActiveSession).toHaveBeenCalledWith("other-instance")

    // Check that events were restored to the other instance
    expect(useAppStore.getState().instances.get("other-instance")?.events).toEqual(mockEventsOther)

    // Verify init was called twice (once per instance)
    expect(eventDatabase.init).toHaveBeenCalledTimes(2)
  })

  it("should not re-hydrate when switching back to an already-hydrated instance", async () => {
    const mockEventsDefault: ChatEvent[] = [
      { type: "system", timestamp: 1000, subtype: "init" } as any,
    ]

    const mockSessionDefault: PersistedSession = {
      id: "default-1000",
      instanceId: "default",
      workspaceId: null,
      startedAt: 1000,
      completedAt: null,
      taskId: null,
      tokenUsage: { input: 100, output: 50 },
      contextWindow: { used: 150, max: 200000 },
      session: { current: 1, total: 1 },
      eventCount: 1,
      lastEventSequence: 0,
      events: mockEventsDefault,
    }

    vi.mocked(eventDatabase.getLatestActiveSession).mockResolvedValue(mockSessionDefault)

    // Create the other instance in the store
    useAppStore.getState().createInstance("other-instance", "Other")
    // Switch back to default so we start from default
    useAppStore.getState().setActiveInstanceId("default")

    const { result, rerender } = renderHook(({ instanceId }) => useStoreHydration({ instanceId }), {
      initialProps: { instanceId: "default" },
    })

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true)
    })
    expect(eventDatabase.init).toHaveBeenCalledTimes(1)

    // Switch to other instance
    rerender({ instanceId: "other-instance" })

    await waitFor(() => {
      expect(eventDatabase.init).toHaveBeenCalledTimes(2)
    })

    // Switch back to default instance
    rerender({ instanceId: "default" })

    // Wait a tick to ensure no additional hydration is triggered
    await new Promise(resolve => setTimeout(resolve, 10))

    // Should still only have 2 calls (not 3) - already hydrated default, no need to re-hydrate
    expect(eventDatabase.init).toHaveBeenCalledTimes(2)
  })

  it("should not restore events if session has no events", async () => {
    const mockSession: PersistedSession = {
      id: "default-1000",
      instanceId: "default",
      workspaceId: null,
      startedAt: 1000,
      completedAt: null,
      taskId: null,
      tokenUsage: { input: 0, output: 0 },
      contextWindow: { used: 0, max: 200000 },
      session: { current: 0, total: 0 },
      eventCount: 0,
      lastEventSequence: -1,
      events: [],
    }

    vi.mocked(eventDatabase.getLatestActiveSession).mockResolvedValue(mockSession)

    const { result } = renderHook(() => useStoreHydration({ instanceId: "default" }))

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true)
    })

    // Events should remain empty (read from instances Map via selector)
    expect(selectEvents(useAppStore.getState())).toEqual([])
  })

  it("should load task chat events from events store (v7+ schema)", async () => {
    const mockMessages: TaskChatMessage[] = [
      { id: "msg-1", role: "user", content: "Hello", timestamp: 1000 },
      { id: "msg-2", role: "assistant", content: "Hi there!", timestamp: 2000 },
    ]

    // v7+ session has no embedded events
    const mockSession: PersistedTaskChatSession = {
      id: "default-task-abc-1000",
      taskId: "abc",
      instanceId: "default",
      createdAt: 1000,
      updatedAt: 2000,
      messageCount: 2,
      eventCount: 2,
      lastEventSequence: 1,
      messages: mockMessages,
      // No events field (v7+ schema)
    }

    // Events stored separately in events table
    const mockPersistedEvents = [
      {
        id: "default-task-abc-1000-event-0",
        sessionId: "default-task-abc-1000",
        timestamp: 1000,
        eventType: "user",
        event: { type: "user", timestamp: 1000, message: { role: "user", content: "Hello" } },
      },
      {
        id: "default-task-abc-1000-event-1",
        sessionId: "default-task-abc-1000",
        timestamp: 2000,
        eventType: "assistant",
        event: {
          type: "assistant",
          timestamp: 2000,
          message: { content: [{ type: "text", text: "Hi there!" }] },
        },
      },
    ]

    // Set up mocks for this test
    vi.mocked(eventDatabase.init).mockResolvedValue(undefined)
    vi.mocked(eventDatabase.getLatestActiveSession).mockResolvedValue(undefined)
    vi.mocked(eventDatabase.getLatestTaskChatSessionForInstance).mockResolvedValue(mockSession)
    vi.mocked(eventDatabase.getEventsForSession).mockResolvedValue(mockPersistedEvents as any)

    const { result } = renderHook(() => useStoreHydration({ instanceId: "default" }))

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true)
    })

    // Check that task chat messages were restored
    expect(useAppStore.getState().taskChatMessages).toEqual(mockMessages)

    // Check that task chat events were loaded from the events store
    expect(eventDatabase.getEventsForSession).toHaveBeenCalledWith("default-task-abc-1000")
    expect(useAppStore.getState().taskChatEvents).toEqual(mockPersistedEvents.map(pe => pe.event))
  })

  describe("workspace scoping", () => {
    it("should use workspace-scoped query when workspaceId is provided", async () => {
      const mockEvents: ChatEvent[] = [{ type: "system", timestamp: 1000, subtype: "init" } as any]

      const mockSession: PersistedSession = {
        id: "default-1000",
        instanceId: "default",
        workspaceId: "/Users/test/project",
        startedAt: 1000,
        completedAt: null,
        taskId: null,
        tokenUsage: { input: 100, output: 50 },
        contextWindow: { used: 150, max: 200000 },
        session: { current: 1, total: 1 },
        eventCount: 1,
        lastEventSequence: 0,
        events: mockEvents,
      }

      vi.mocked(eventDatabase.getLatestActiveSessionForWorkspace).mockResolvedValue(mockSession)

      const { result } = renderHook(() =>
        useStoreHydration({ instanceId: "default", workspaceId: "/Users/test/project" }),
      )

      await waitFor(() => {
        expect(result.current.isHydrated).toBe(true)
      })

      // Should use workspace-scoped method
      expect(eventDatabase.getLatestActiveSessionForWorkspace).toHaveBeenCalledWith(
        "default",
        "/Users/test/project",
      )
      // Should NOT use the non-scoped method
      expect(eventDatabase.getLatestActiveSession).not.toHaveBeenCalled()

      // Check that events were restored
      expect(selectEvents(useAppStore.getState())).toEqual(mockEvents)
    })

    it("should use non-scoped query when workspaceId is not provided", async () => {
      const mockEvents: ChatEvent[] = [{ type: "system", timestamp: 1000, subtype: "init" } as any]

      const mockSession: PersistedSession = {
        id: "default-1000",
        instanceId: "default",
        workspaceId: null,
        startedAt: 1000,
        completedAt: null,
        taskId: null,
        tokenUsage: { input: 100, output: 50 },
        contextWindow: { used: 150, max: 200000 },
        session: { current: 1, total: 1 },
        eventCount: 1,
        lastEventSequence: 0,
        events: mockEvents,
      }

      vi.mocked(eventDatabase.getLatestActiveSession).mockResolvedValue(mockSession)

      const { result } = renderHook(() => useStoreHydration({ instanceId: "default" }))

      await waitFor(() => {
        expect(result.current.isHydrated).toBe(true)
      })

      // Should use non-scoped method
      expect(eventDatabase.getLatestActiveSession).toHaveBeenCalledWith("default")
      // Should NOT use workspace-scoped method
      expect(eventDatabase.getLatestActiveSessionForWorkspace).not.toHaveBeenCalled()

      // Check that events were restored
      expect(selectEvents(useAppStore.getState())).toEqual(mockEvents)
    })

    it("should use non-scoped query when workspaceId is null", async () => {
      const { result } = renderHook(() =>
        useStoreHydration({ instanceId: "default", workspaceId: null }),
      )

      await waitFor(() => {
        expect(result.current.isHydrated).toBe(true)
      })

      // Should use non-scoped method when workspaceId is null
      expect(eventDatabase.getLatestActiveSession).toHaveBeenCalledWith("default")
      expect(eventDatabase.getLatestActiveSessionForWorkspace).not.toHaveBeenCalled()
    })
  })

  describe("server events coordination", () => {
    it("should skip IndexedDB event restoration when server has already provided events", async () => {
      // Simulate server events already being in the store (from WebSocket connection)
      const serverEvents: ChatEvent[] = [
        { type: "system", timestamp: 1000, subtype: "init", id: "server-event-1" } as any,
        {
          type: "assistant",
          timestamp: 2000,
          message: { content: [{ type: "text", text: "Hello" }] },
          id: "server-event-2",
        } as any,
      ]

      // Set up state as if server already synced
      useAppStore.getState().setEventsForInstance("default", serverEvents)
      useAppStore.getState().setHasInitialSync(true)

      // Mock IndexedDB session with different events
      const indexedDbEvents: ChatEvent[] = [
        { type: "system", timestamp: 500, subtype: "init", id: "idb-event-1" } as any, // older event
      ]

      const mockSession: PersistedSession = {
        id: "default-1000",
        instanceId: "default",
        workspaceId: null,
        startedAt: 500,
        completedAt: null,
        taskId: null,
        tokenUsage: { input: 50, output: 25 },
        contextWindow: { used: 75, max: 200000 },
        session: { current: 1, total: 1 },
        eventCount: 1,
        lastEventSequence: 0,
        events: indexedDbEvents,
      }

      vi.mocked(eventDatabase.getLatestActiveSession).mockResolvedValue(mockSession)

      const { result } = renderHook(() => useStoreHydration({ instanceId: "default" }))

      await waitFor(() => {
        expect(result.current.isHydrated).toBe(true)
      })

      // Events should still be the server events, not overwritten by IndexedDB events
      expect(selectEvents(useAppStore.getState())).toEqual(serverEvents)

      // Console log should indicate skipping
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Skipping event restoration from IndexedDB"),
      )
    })

    it("should restore from IndexedDB when server has not provided events yet", async () => {
      // No server sync yet
      useAppStore.getState().setHasInitialSync(false)

      const indexedDbEvents: ChatEvent[] = [
        { type: "system", timestamp: 500, subtype: "init", id: "idb-event-1" } as any,
      ]

      const mockSession: PersistedSession = {
        id: "default-1000",
        instanceId: "default",
        workspaceId: null,
        startedAt: 500,
        completedAt: null,
        taskId: null,
        tokenUsage: { input: 50, output: 25 },
        contextWindow: { used: 75, max: 200000 },
        session: { current: 1, total: 1 },
        eventCount: 1,
        lastEventSequence: 0,
        events: indexedDbEvents,
      }

      vi.mocked(eventDatabase.getLatestActiveSession).mockResolvedValue(mockSession)

      const { result } = renderHook(() => useStoreHydration({ instanceId: "default" }))

      await waitFor(() => {
        expect(result.current.isHydrated).toBe(true)
      })

      // Events should be restored from IndexedDB
      expect(selectEvents(useAppStore.getState())).toEqual(indexedDbEvents)

      // Console log should indicate restoration
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Restored 1 events from active session"),
      )
    })

    it("should restore from IndexedDB when server synced but has no events", async () => {
      // Server synced but with empty events (fresh start)
      useAppStore.getState().setHasInitialSync(true)
      // Instance exists but has no events (default state)

      const indexedDbEvents: ChatEvent[] = [
        { type: "system", timestamp: 500, subtype: "init", id: "idb-event-1" } as any,
      ]

      const mockSession: PersistedSession = {
        id: "default-1000",
        instanceId: "default",
        workspaceId: null,
        startedAt: 500,
        completedAt: null,
        taskId: null,
        tokenUsage: { input: 50, output: 25 },
        contextWindow: { used: 75, max: 200000 },
        session: { current: 1, total: 1 },
        eventCount: 1,
        lastEventSequence: 0,
        events: indexedDbEvents,
      }

      vi.mocked(eventDatabase.getLatestActiveSession).mockResolvedValue(mockSession)

      const { result } = renderHook(() => useStoreHydration({ instanceId: "default" }))

      await waitFor(() => {
        expect(result.current.isHydrated).toBe(true)
      })

      // Events should be restored from IndexedDB (server had no events)
      expect(selectEvents(useAppStore.getState())).toEqual(indexedDbEvents)

      // Console log should indicate restoration
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Restored 1 events from active session"),
      )
    })
  })
})
