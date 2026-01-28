import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useSessionPersistence, type UseSessionPersistenceOptions } from "./useSessionPersistence"
import { eventDatabase } from "@/lib/persistence"
import type { ChatEvent, TokenUsage, ContextWindow, SessionInfo } from "@/types"

// Mock the eventDatabase
vi.mock("@/lib/persistence", () => ({
  eventDatabase: {
    init: vi.fn().mockResolvedValue(undefined),
    saveSession: vi.fn().mockResolvedValue(undefined),
    deleteSession: vi.fn().mockResolvedValue(undefined),
  },
}))

// Mock the ralphConnection module to verify session ID sync
const mockSetRalphConnectionSessionId = vi.fn()
vi.mock("@/lib/ralphConnection", () => ({
  setCurrentSessionId: (instanceId: string, sessionId: string) =>
    mockSetRalphConnectionSessionId(instanceId, sessionId),
}))

describe("useSessionPersistence", () => {
  const mockTokenUsage: TokenUsage = { input: 1000, output: 500 }
  const mockContextWindow: ContextWindow = { used: 5000, max: 200000 }
  const mockSession: SessionInfo = { current: 1, total: 5 }

  const createSystemInitEvent = (timestamp: number): ChatEvent => ({
    type: "system",
    timestamp,
    subtype: "init",
  })

  const createRalphSessionStartEvent = (
    timestamp: number,
    sessionId: string,
    session: number = 1,
  ): ChatEvent =>
    ({
      type: "ralph_session_start",
      timestamp,
      sessionId,
      session,
      totalSessions: 5,
    }) as ChatEvent

  const createAssistantEvent = (timestamp: number, text: string): ChatEvent => ({
    type: "assistant",
    timestamp,
    message: {
      content: [{ type: "text", text }],
    },
  })

  const createRalphTaskStartedEvent = (timestamp: number, taskId: string): ChatEvent => ({
    type: "ralph_task_started",
    timestamp,
    taskId,
  })

  const createRalphTaskCompletedEvent = (timestamp: number): ChatEvent => ({
    type: "ralph_task_completed",
    timestamp,
  })

  const defaultOptions: UseSessionPersistenceOptions = {
    instanceId: "default",
    events: [],
    tokenUsage: mockTokenUsage,
    contextWindow: mockContextWindow,
    session: mockSession,
    enabled: true,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockSetRalphConnectionSessionId.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("initialization", () => {
    it("initializes the database on mount", async () => {
      renderHook(() => useSessionPersistence(defaultOptions))

      await waitFor(() => {
        expect(eventDatabase.init).toHaveBeenCalledTimes(1)
      })
    })

    it("does not initialize when disabled", async () => {
      renderHook(() =>
        useSessionPersistence({
          ...defaultOptions,
          enabled: false,
        }),
      )

      // Wait a tick to ensure effect ran
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })

      expect(eventDatabase.init).not.toHaveBeenCalled()
    })

    it("returns null currentSessionId when no events", () => {
      const { result } = renderHook(() => useSessionPersistence(defaultOptions))
      expect(result.current.currentSessionId).toBeNull()
    })
  })

  describe("session detection", () => {
    it("detects a new session on system init event", async () => {
      const timestamp = Date.now()
      const events: ChatEvent[] = [createSystemInitEvent(timestamp)]

      const { result } = renderHook(() =>
        useSessionPersistence({
          ...defaultOptions,
          events,
        }),
      )

      await waitFor(() => {
        expect(result.current.currentSessionId).toBe(`default-${timestamp}`)
      })
    })

    it("saves session immediately when detected so it appears in history", async () => {
      const timestamp = Date.now()
      const events: ChatEvent[] = [createSystemInitEvent(timestamp)]

      renderHook(() =>
        useSessionPersistence({
          ...defaultOptions,
          events,
        }),
      )

      // Session should be saved immediately when detected (not waiting for completion)
      await waitFor(() => {
        expect(eventDatabase.saveSession).toHaveBeenCalled()
      })

      const savedSession = vi.mocked(eventDatabase.saveSession).mock.calls[0]?.[0]
      expect(savedSession?.id).toBe(`default-${timestamp}`)
      expect(savedSession?.completedAt).toBeNull() // Not completed yet
      expect(savedSession?.eventCount).toBe(1) // Just the init event
    })

    it("uses Date.now() as fallback when boundary event has no timestamp", async () => {
      // Create a system init event without a timestamp (simulates the bug scenario)
      // Use 'unknown' cast to bypass TypeScript's type checking since we're simulating
      // the runtime scenario where SDK events don't include timestamps
      const eventWithoutTimestamp = {
        type: "system",
        subtype: "init",
      } as unknown as ChatEvent

      const beforeTime = Date.now()

      const { result } = renderHook(() =>
        useSessionPersistence({
          ...defaultOptions,
          events: [eventWithoutTimestamp],
        }),
      )

      const afterTime = Date.now()

      await waitFor(() => {
        expect(result.current.currentSessionId).not.toBeNull()
        // The ID should be generated with a fallback timestamp
        expect(result.current.currentSessionId).toMatch(/^default-\d+$/)
        // Extract the timestamp from the ID
        const idTimestamp = parseInt(result.current.currentSessionId!.split("-")[1], 10)
        // The fallback timestamp should be between beforeTime and afterTime
        expect(idTimestamp).toBeGreaterThanOrEqual(beforeTime)
        expect(idTimestamp).toBeLessThanOrEqual(afterTime)
      })
    })

    it("uses Date.now() as fallback when boundary event has timestamp of 0", async () => {
      // Create a system init event with timestamp=0 (falsy but not nullish)
      const eventWithZeroTimestamp = {
        type: "system",
        subtype: "init",
        timestamp: 0,
      } as unknown as ChatEvent

      const beforeTime = Date.now()

      const { result } = renderHook(() =>
        useSessionPersistence({
          ...defaultOptions,
          events: [eventWithZeroTimestamp],
        }),
      )

      const afterTime = Date.now()

      await waitFor(() => {
        expect(result.current.currentSessionId).not.toBeNull()
        // The ID should be generated with a fallback timestamp (not 0)
        expect(result.current.currentSessionId).toMatch(/^default-\d+$/)
        // Extract the timestamp from the ID
        const idTimestamp = parseInt(result.current.currentSessionId!.split("-")[1], 10)
        // The fallback timestamp should be between beforeTime and afterTime (not 0)
        expect(idTimestamp).toBeGreaterThanOrEqual(beforeTime)
        expect(idTimestamp).toBeLessThanOrEqual(afterTime)
        expect(idTimestamp).not.toBe(0)
      })
    })

    it("generates stable session IDs based on instance and timestamp", async () => {
      const timestamp = 1706123456789

      const { result: result1 } = renderHook(() =>
        useSessionPersistence({
          ...defaultOptions,
          instanceId: "instance-1",
          events: [createSystemInitEvent(timestamp)],
        }),
      )

      const { result: result2 } = renderHook(() =>
        useSessionPersistence({
          ...defaultOptions,
          instanceId: "instance-2",
          events: [createSystemInitEvent(timestamp)],
        }),
      )

      await waitFor(() => {
        expect(result1.current.currentSessionId).toBe("instance-1-1706123456789")
        expect(result2.current.currentSessionId).toBe("instance-2-1706123456789")
      })
    })
  })

  describe("server-generated session IDs (bug r-tufi7.2)", () => {
    it("uses server-generated sessionId from ralph_session_start event", async () => {
      const timestamp = Date.now()
      const serverSessionId = "550e8400-e29b-41d4-a716-446655440000"
      const events: ChatEvent[] = [createRalphSessionStartEvent(timestamp, serverSessionId)]

      const { result } = renderHook(() =>
        useSessionPersistence({
          ...defaultOptions,
          events,
        }),
      )

      await waitFor(() => {
        expect(result.current.currentSessionId).toBe(serverSessionId)
      })
    })

    it("syncs server-generated sessionId to ralphConnection", async () => {
      const timestamp = Date.now()
      const serverSessionId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
      const events: ChatEvent[] = [createRalphSessionStartEvent(timestamp, serverSessionId)]

      renderHook(() =>
        useSessionPersistence({
          ...defaultOptions,
          instanceId: "test-instance",
          events,
        }),
      )

      await waitFor(() => {
        expect(mockSetRalphConnectionSessionId).toHaveBeenCalledWith(
          "test-instance",
          serverSessionId,
        )
      })
    })

    it("saves session with server-generated sessionId", async () => {
      const timestamp = Date.now()
      const serverSessionId = "server-uuid-12345"
      const events: ChatEvent[] = [createRalphSessionStartEvent(timestamp, serverSessionId)]

      renderHook(() =>
        useSessionPersistence({
          ...defaultOptions,
          events,
        }),
      )

      await waitFor(() => {
        expect(eventDatabase.saveSession).toHaveBeenCalled()
      })

      const savedSession = vi.mocked(eventDatabase.saveSession).mock.calls[0]?.[0]
      expect(savedSession?.id).toBe(serverSessionId)
    })

    it("falls back to generated ID when sessionId is missing from ralph_session_start", async () => {
      const timestamp = Date.now()
      // Create a ralph_session_start event WITHOUT sessionId (backward compatibility)
      const eventWithoutSessionId = {
        type: "ralph_session_start",
        timestamp,
        session: 1,
        totalSessions: 5,
      } as ChatEvent

      const { result } = renderHook(() =>
        useSessionPersistence({
          ...defaultOptions,
          instanceId: "fallback-test",
          events: [eventWithoutSessionId],
        }),
      )

      await waitFor(() => {
        // Should fall back to the generated format: instanceId-timestamp
        expect(result.current.currentSessionId).toBe(`fallback-test-${timestamp}`)
      })
    })

    it("handles multiple sessions with different server-generated IDs", async () => {
      const startTime1 = Date.now()
      const startTime2 = startTime1 + 1000
      const sessionId1 = "session-uuid-1"
      const sessionId2 = "session-uuid-2"

      const { rerender, result } = renderHook(
        (props: UseSessionPersistenceOptions) => useSessionPersistence(props),
        { initialProps: { ...defaultOptions, events: [] as ChatEvent[] } },
      )

      // First session with server sessionId
      rerender({
        ...defaultOptions,
        events: [
          createRalphSessionStartEvent(startTime1, sessionId1, 1),
          createRalphTaskStartedEvent(startTime1 + 50, "task-1"),
          createAssistantEvent(startTime1 + 100, "First session"),
        ] as ChatEvent[],
      })

      await waitFor(() => {
        expect(result.current.currentSessionId).toBe(sessionId1)
      })

      // Second session starts with a different server sessionId
      rerender({
        ...defaultOptions,
        events: [
          createRalphSessionStartEvent(startTime1, sessionId1, 1),
          createRalphTaskStartedEvent(startTime1 + 50, "task-1"),
          createAssistantEvent(startTime1 + 100, "First session"),
          createRalphSessionStartEvent(startTime2, sessionId2, 2),
        ] as ChatEvent[],
      })

      await waitFor(() => {
        expect(result.current.currentSessionId).toBe(sessionId2)
      })

      // Both session IDs should have been synced to ralphConnection
      expect(mockSetRalphConnectionSessionId).toHaveBeenCalledWith("default", sessionId1)
      expect(mockSetRalphConnectionSessionId).toHaveBeenCalledWith("default", sessionId2)
    })

    it("prefers server sessionId over timestamp-based ID in same event", async () => {
      const timestamp = Date.now()
      const serverSessionId = "explicit-server-id"

      // ralph_session_start events have both timestamp and sessionId
      // The server-generated sessionId should take precedence
      const { result } = renderHook(() =>
        useSessionPersistence({
          ...defaultOptions,
          events: [createRalphSessionStartEvent(timestamp, serverSessionId)],
        }),
      )

      await waitFor(() => {
        expect(result.current.currentSessionId).toBe(serverSessionId)
        // NOT "default-{timestamp}"
        expect(result.current.currentSessionId).not.toMatch(/^default-\d+$/)
      })
    })
  })

  describe("auto-save on session end", () => {
    it("saves session on ralph_task_completed event", async () => {
      const startTime = Date.now()
      const events: ChatEvent[] = [
        createSystemInitEvent(startTime),
        createRalphTaskStartedEvent(startTime + 100, "task-1"),
        createAssistantEvent(startTime + 200, "Working on the task..."),
        createRalphTaskCompletedEvent(startTime + 300),
      ]

      const { rerender } = renderHook(
        (props: UseSessionPersistenceOptions) => useSessionPersistence(props),
        { initialProps: { ...defaultOptions, events: [] as ChatEvent[] } },
      )

      // Add events one by one
      for (let i = 1; i <= events.length; i++) {
        rerender({ ...defaultOptions, events: events.slice(0, i) as ChatEvent[] })
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
        })
      }

      await waitFor(() => {
        expect(eventDatabase.saveSession).toHaveBeenCalled()
      })

      // Check the saved data - v3 schema: metadata only, no events
      // Session is saved twice: once when it starts (completedAt: null) and once when it completes (completedAt: timestamp)
      // We need to check the LAST call which should have completedAt set
      const mockCalls = vi.mocked(eventDatabase.saveSession).mock.calls
      const savedSession = mockCalls[mockCalls.length - 1]?.[0]
      expect(savedSession).toBeDefined()
      expect(savedSession?.instanceId).toBe("default")
      expect(savedSession?.completedAt).not.toBeNull()
      expect(savedSession?.eventCount).toBe(events.length)
      // Events are not included in v3 schema - they're persisted separately in ralphConnection.ts
      expect(savedSession?.events).toBeUndefined()
    })

    it("saves session on COMPLETE promise signal when session has a task", async () => {
      const startTime = Date.now()
      // Include a task so this session is NOT filtered out
      const events: ChatEvent[] = [
        createSystemInitEvent(startTime),
        createRalphTaskStartedEvent(startTime + 50, "task-1"),
        createAssistantEvent(startTime + 100, "Working on it..."),
        createAssistantEvent(startTime + 200, "Done! <promise>COMPLETE</promise>"),
      ]

      const { rerender } = renderHook(
        (props: UseSessionPersistenceOptions) => useSessionPersistence(props),
        { initialProps: { ...defaultOptions, events: [] as ChatEvent[] } },
      )

      // Add events progressively
      for (let i = 1; i <= events.length; i++) {
        rerender({ ...defaultOptions, events: events.slice(0, i) as ChatEvent[] })
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
        })
      }

      await waitFor(() => {
        expect(eventDatabase.saveSession).toHaveBeenCalled()
      })

      // Session is saved twice: once when it starts and once when it completes
      // Check the LAST call which should have completedAt set
      const mockCalls = vi.mocked(eventDatabase.saveSession).mock.calls
      const savedSession = mockCalls[mockCalls.length - 1]?.[0]
      expect(savedSession?.completedAt).not.toBeNull()
    })
  })

  describe("auto-save on session boundary", () => {
    it("saves previous session when new session starts", async () => {
      const startTime1 = Date.now()
      const startTime2 = startTime1 + 1000

      const { rerender } = renderHook(
        (props: UseSessionPersistenceOptions) => useSessionPersistence(props),
        { initialProps: { ...defaultOptions, events: [] as ChatEvent[] } },
      )

      // First session - must have a task and >= 3 events to not be filtered
      rerender({
        ...defaultOptions,
        events: [
          createSystemInitEvent(startTime1),
          createRalphTaskStartedEvent(startTime1 + 50, "task-1"),
          createAssistantEvent(startTime1 + 100, "First session"),
        ] as ChatEvent[],
      })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      // Second session starts - should save the first as complete
      rerender({
        ...defaultOptions,
        events: [
          createSystemInitEvent(startTime1),
          createRalphTaskStartedEvent(startTime1 + 50, "task-1"),
          createAssistantEvent(startTime1 + 100, "First session"),
          createSystemInitEvent(startTime2),
        ] as ChatEvent[],
      })

      await waitFor(() => {
        expect(eventDatabase.saveSession).toHaveBeenCalled()
      })

      // Sessions are saved multiple times:
      // 1. Session 1 starts (completedAt: null)
      // 2. Session 1 completes when session 2 starts (completedAt: timestamp)
      // 3. Session 2 starts (completedAt: null)
      // Find the save where session 1 is marked as complete
      const mockCalls = vi.mocked(eventDatabase.saveSession).mock.calls
      const session1CompletedSave = mockCalls.find(
        call => call[0]?.id === `default-${startTime1}` && call[0]?.completedAt !== null,
      )
      expect(session1CompletedSave).toBeDefined()
      expect(session1CompletedSave?.[0]?.completedAt).not.toBeNull()
    })
  })

  describe("task info extraction", () => {
    it("extracts task info from ralph_task_started events", async () => {
      const startTime = Date.now()
      const events: ChatEvent[] = [
        createSystemInitEvent(startTime),
        createRalphTaskStartedEvent(startTime + 100, "r-abc123"),
        createRalphTaskCompletedEvent(startTime + 200),
      ]

      const { rerender } = renderHook(
        (props: UseSessionPersistenceOptions) => useSessionPersistence(props),
        { initialProps: { ...defaultOptions, events: [] as ChatEvent[] } },
      )

      for (let i = 1; i <= events.length; i++) {
        rerender({ ...defaultOptions, events: events.slice(0, i) as ChatEvent[] })
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
        })
      }

      await waitFor(() => {
        expect(eventDatabase.saveSession).toHaveBeenCalled()
      })

      // Session is saved multiple times as events arrive. The final save (on completion)
      // should have the task ID extracted from the ralph_task_started event.
      const mockCalls = vi.mocked(eventDatabase.saveSession).mock.calls
      const savedSession = mockCalls[mockCalls.length - 1]?.[0]
      expect(savedSession?.taskId).toBe("r-abc123")
    })
  })

  describe("manual save", () => {
    it("allows manual save of current session", async () => {
      const startTime = Date.now()
      const events: ChatEvent[] = [
        createSystemInitEvent(startTime),
        createAssistantEvent(startTime + 100, "Working..."),
      ]

      const { result } = renderHook(() =>
        useSessionPersistence({
          ...defaultOptions,
          events,
        }),
      )

      await waitFor(() => {
        expect(result.current.currentSessionId).toBe(`default-${startTime}`)
      })

      await act(async () => {
        await result.current.saveCurrentSession()
      })

      expect(eventDatabase.saveSession).toHaveBeenCalledWith(
        expect.objectContaining({
          id: `default-${startTime}`,
          instanceId: "default",
          completedAt: null, // Manual save doesn't mark as complete
          eventCount: events.length,
          // Events are not included in v3 schema
        }),
      )
      // Verify events are NOT included
      const savedSession = vi.mocked(eventDatabase.saveSession).mock.calls[0]?.[0]
      expect(savedSession?.events).toBeUndefined()
    })

    it("does nothing on manual save when disabled", async () => {
      const { result } = renderHook(() =>
        useSessionPersistence({
          ...defaultOptions,
          enabled: false,
          events: [createSystemInitEvent(Date.now())],
        }),
      )

      await act(async () => {
        await result.current.saveCurrentSession()
      })

      expect(eventDatabase.saveSession).not.toHaveBeenCalled()
    })
  })

  describe("disabled state", () => {
    it("does not save when disabled", async () => {
      const startTime = Date.now()
      const events: ChatEvent[] = [
        createSystemInitEvent(startTime),
        createRalphTaskCompletedEvent(startTime + 100),
      ]

      const { rerender } = renderHook(
        (props: UseSessionPersistenceOptions) => useSessionPersistence(props),
        {
          initialProps: {
            ...defaultOptions,
            enabled: false,
            events: [] as ChatEvent[],
          },
        },
      )

      rerender({ ...defaultOptions, enabled: false, events: events as ChatEvent[] })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
      })

      expect(eventDatabase.saveSession).not.toHaveBeenCalled()
    })
  })

  describe("no periodic saves (v3 schema)", () => {
    it("saves once when session starts but not periodically as events arrive", async () => {
      const startTime = Date.now()

      // Create 15 events (1 init + 14 assistant messages) - no completion event
      const events: ChatEvent[] = [
        createSystemInitEvent(startTime),
        ...Array.from({ length: 14 }, (_, i) =>
          createAssistantEvent(startTime + (i + 1) * 100, `Message ${i + 1}`),
        ),
      ]

      const { rerender } = renderHook(
        (props: UseSessionPersistenceOptions) => useSessionPersistence(props),
        { initialProps: { ...defaultOptions, events: [] as ChatEvent[] } },
      )

      // Add events one at a time
      for (let i = 1; i <= events.length; i++) {
        rerender({ ...defaultOptions, events: events.slice(0, i) as ChatEvent[] })
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 5))
        })
      }

      // Wait a bit to ensure no delayed saves
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
      })

      // Session should be saved exactly once when it starts (so it appears in history)
      // After that, events are persisted separately in ralphConnection.ts
      // No periodic saves happen during the session
      expect(eventDatabase.saveSession).toHaveBeenCalledTimes(1)

      // The saved session should have the initial event count (just the init event)
      const savedSession = vi.mocked(eventDatabase.saveSession).mock.calls[0]?.[0]
      expect(savedSession?.completedAt).toBeNull() // Not completed
      expect(savedSession?.eventCount).toBe(1) // Just the init event at time of first save
    })
  })

  describe("workspaceId", () => {
    it("includes workspaceId in saved session metadata", async () => {
      const startTime = Date.now()
      const events: ChatEvent[] = [
        createSystemInitEvent(startTime),
        createRalphTaskCompletedEvent(startTime + 100),
      ]

      const { rerender } = renderHook(
        (props: UseSessionPersistenceOptions) => useSessionPersistence(props),
        {
          initialProps: {
            ...defaultOptions,
            workspaceId: "/path/to/workspace",
            events: [] as ChatEvent[],
          },
        },
      )

      // Add events
      for (let i = 1; i <= events.length; i++) {
        rerender({
          ...defaultOptions,
          workspaceId: "/path/to/workspace",
          events: events.slice(0, i) as ChatEvent[],
        })
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
        })
      }

      await waitFor(() => {
        expect(eventDatabase.saveSession).toHaveBeenCalled()
      })

      const savedSession = vi.mocked(eventDatabase.saveSession).mock.calls[0]?.[0]
      expect(savedSession?.workspaceId).toBe("/path/to/workspace")
    })

    it("defaults workspaceId to null when not provided", async () => {
      const startTime = Date.now()
      const events: ChatEvent[] = [
        createSystemInitEvent(startTime),
        createRalphTaskCompletedEvent(startTime + 100),
      ]

      const { rerender } = renderHook(
        (props: UseSessionPersistenceOptions) => useSessionPersistence(props),
        { initialProps: { ...defaultOptions, events: [] as ChatEvent[] } },
      )

      // Add events
      for (let i = 1; i <= events.length; i++) {
        rerender({ ...defaultOptions, events: events.slice(0, i) as ChatEvent[] })
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
        })
      }

      await waitFor(() => {
        expect(eventDatabase.saveSession).toHaveBeenCalled()
      })

      const savedSession = vi.mocked(eventDatabase.saveSession).mock.calls[0]?.[0]
      expect(savedSession?.workspaceId).toBeNull()
    })
  })

  describe("ralphConnection session ID sync (bug r-tufi7.1)", () => {
    it("syncs session ID to ralphConnection when a new session is detected", async () => {
      const timestamp = Date.now()
      const events: ChatEvent[] = [createSystemInitEvent(timestamp)]

      renderHook(() =>
        useSessionPersistence({
          ...defaultOptions,
          instanceId: "test-instance",
          events,
        }),
      )

      await waitFor(() => {
        expect(mockSetRalphConnectionSessionId).toHaveBeenCalledWith(
          "test-instance",
          `test-instance-${timestamp}`,
        )
      })
    })

    it("syncs session ID for each new session boundary", async () => {
      const startTime1 = Date.now()
      const startTime2 = startTime1 + 1000

      const { rerender } = renderHook(
        (props: UseSessionPersistenceOptions) => useSessionPersistence(props),
        {
          initialProps: { ...defaultOptions, instanceId: "instance-x", events: [] as ChatEvent[] },
        },
      )

      // First session
      rerender({
        ...defaultOptions,
        instanceId: "instance-x",
        events: [
          createSystemInitEvent(startTime1),
          createRalphTaskStartedEvent(startTime1 + 50, "task-1"),
          createAssistantEvent(startTime1 + 100, "First session"),
        ] as ChatEvent[],
      })

      await waitFor(() => {
        expect(mockSetRalphConnectionSessionId).toHaveBeenCalledWith(
          "instance-x",
          `instance-x-${startTime1}`,
        )
      })

      mockSetRalphConnectionSessionId.mockClear()

      // Second session starts - should sync the new session ID
      rerender({
        ...defaultOptions,
        instanceId: "instance-x",
        events: [
          createSystemInitEvent(startTime1),
          createRalphTaskStartedEvent(startTime1 + 50, "task-1"),
          createAssistantEvent(startTime1 + 100, "First session"),
          createSystemInitEvent(startTime2),
        ] as ChatEvent[],
      })

      await waitFor(() => {
        expect(mockSetRalphConnectionSessionId).toHaveBeenCalledWith(
          "instance-x",
          `instance-x-${startTime2}`,
        )
      })
    })

    it("uses the same instanceId when syncing to ralphConnection", async () => {
      const timestamp = 1706123456789

      renderHook(() =>
        useSessionPersistence({
          ...defaultOptions,
          instanceId: "my-specific-instance",
          events: [createSystemInitEvent(timestamp)],
        }),
      )

      await waitFor(() => {
        expect(mockSetRalphConnectionSessionId).toHaveBeenCalledTimes(1)
        const [instanceId, sessionId] = mockSetRalphConnectionSessionId.mock.calls[0]
        expect(instanceId).toBe("my-specific-instance")
        expect(sessionId).toBe("my-specific-instance-1706123456789")
      })
    })
  })

  describe("empty session filtering", () => {
    it("filters sessions that end with COMPLETE signal and have no task", async () => {
      const startTime = Date.now()
      // This session has no task - just startup and COMPLETE signal
      const events: ChatEvent[] = [
        createSystemInitEvent(startTime),
        createAssistantEvent(startTime + 100, "Checking for work..."),
        createAssistantEvent(startTime + 200, "No work found. <promise>COMPLETE</promise>"),
      ]

      const { rerender } = renderHook(
        (props: UseSessionPersistenceOptions) => useSessionPersistence(props),
        { initialProps: { ...defaultOptions, events: [] as ChatEvent[] } },
      )

      // Add events progressively
      for (let i = 1; i <= events.length; i++) {
        rerender({ ...defaultOptions, events: events.slice(0, i) as ChatEvent[] })
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
        })
      }

      // Wait for the session to be processed
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
      })

      // The session should be deleted (filtered out) since it ended with COMPLETE and has no task
      expect(eventDatabase.deleteSession).toHaveBeenCalledWith(`default-${startTime}`)
    })

    it("does not filter sessions that end with ralph_task_completed", async () => {
      const startTime = Date.now()
      const events: ChatEvent[] = [
        createSystemInitEvent(startTime),
        createRalphTaskStartedEvent(startTime + 100, "task-1"),
        createAssistantEvent(startTime + 200, "Working on the task..."),
        createRalphTaskCompletedEvent(startTime + 300),
      ]

      const { rerender } = renderHook(
        (props: UseSessionPersistenceOptions) => useSessionPersistence(props),
        { initialProps: { ...defaultOptions, events: [] as ChatEvent[] } },
      )

      // Add events progressively
      for (let i = 1; i <= events.length; i++) {
        rerender({ ...defaultOptions, events: events.slice(0, i) as ChatEvent[] })
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
        })
      }

      // Wait for the session to be processed
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
      })

      // The session should be saved (not filtered) because it has a task
      expect(eventDatabase.deleteSession).not.toHaveBeenCalled()
      expect(eventDatabase.saveSession).toHaveBeenCalled()

      // Verify the final save has the task ID
      const mockCalls = vi.mocked(eventDatabase.saveSession).mock.calls
      const finalSave = mockCalls[mockCalls.length - 1]?.[0]
      expect(finalSave?.taskId).toBe("task-1")
    })

    it("filters sessions with very few events (< 3)", async () => {
      const startTime1 = Date.now()
      const startTime2 = startTime1 + 1000

      const { rerender } = renderHook(
        (props: UseSessionPersistenceOptions) => useSessionPersistence(props),
        { initialProps: { ...defaultOptions, events: [] as ChatEvent[] } },
      )

      // First session with only 2 events (should be filtered)
      rerender({
        ...defaultOptions,
        events: [createSystemInitEvent(startTime1), createAssistantEvent(startTime1 + 50, "Hi")],
      })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      // Start second session - should trigger save/filter of first
      rerender({
        ...defaultOptions,
        events: [
          createSystemInitEvent(startTime1),
          createAssistantEvent(startTime1 + 50, "Hi"),
          createSystemInitEvent(startTime2),
        ],
      })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
      })

      // First session should be deleted because it has < 3 events
      expect(eventDatabase.deleteSession).toHaveBeenCalledWith(`default-${startTime1}`)
    })

    it("filters empty session when new session starts", async () => {
      const startTime1 = Date.now()
      const startTime2 = startTime1 + 1000

      const { rerender } = renderHook(
        (props: UseSessionPersistenceOptions) => useSessionPersistence(props),
        { initialProps: { ...defaultOptions, events: [] as ChatEvent[] } },
      )

      // First session - empty (no task, ends with COMPLETE)
      const firstSessionEvents: ChatEvent[] = [
        createSystemInitEvent(startTime1),
        createAssistantEvent(startTime1 + 100, "Checking for work..."),
        createAssistantEvent(startTime1 + 200, "No tasks. <promise>COMPLETE</promise>"),
      ]

      rerender({ ...defaultOptions, events: firstSessionEvents })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      // Start second session
      rerender({
        ...defaultOptions,
        events: [...firstSessionEvents, createSystemInitEvent(startTime2)],
      })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
      })

      // First session should be deleted
      expect(eventDatabase.deleteSession).toHaveBeenCalledWith(`default-${startTime1}`)
    })

    it("does not filter sessions with a task even if they end with COMPLETE", async () => {
      const startTime = Date.now()
      // This session has a task started event, even though it also has COMPLETE signal
      const events: ChatEvent[] = [
        createSystemInitEvent(startTime),
        createRalphTaskStartedEvent(startTime + 100, "task-1"),
        createAssistantEvent(startTime + 200, "Done. <promise>COMPLETE</promise>"),
      ]

      const { rerender } = renderHook(
        (props: UseSessionPersistenceOptions) => useSessionPersistence(props),
        { initialProps: { ...defaultOptions, events: [] as ChatEvent[] } },
      )

      // Add events progressively
      for (let i = 1; i <= events.length; i++) {
        rerender({ ...defaultOptions, events: events.slice(0, i) as ChatEvent[] })
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
        })
      }

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
      })

      // The session should NOT be deleted because it has a task
      expect(eventDatabase.deleteSession).not.toHaveBeenCalled()
    })
  })
})
