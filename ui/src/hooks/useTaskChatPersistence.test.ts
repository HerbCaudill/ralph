import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import {
  useTaskChatPersistence,
  type UseTaskChatPersistenceOptions,
} from "./useTaskChatPersistence"
import { eventDatabase } from "@/lib/persistence"
import { useAppStore } from "@/store"
import type { ChatEvent, TaskChatMessage } from "@/types"

// Mock the eventDatabase
vi.mock("@/lib/persistence", () => ({
  eventDatabase: {
    init: vi.fn().mockResolvedValue(undefined),
    saveTaskChatSession: vi.fn().mockResolvedValue(undefined),
    saveEvent: vi.fn().mockResolvedValue(undefined),
    deleteTaskChatSession: vi.fn().mockResolvedValue(undefined),
  },
}))

describe("useTaskChatPersistence", () => {
  const createUserMessage = (id: string, content: string): TaskChatMessage => ({
    id,
    role: "user",
    content,
    timestamp: Date.now(),
  })

  const createAssistantMessage = (id: string, content: string): TaskChatMessage => ({
    id,
    role: "assistant",
    content,
    timestamp: Date.now(),
  })

  const createAssistantEvent = (timestamp: number, text: string): ChatEvent => ({
    type: "assistant",
    timestamp,
    message: {
      content: [{ type: "text", text }],
    },
  })

  const createUserEvent = (timestamp: number, text: string): ChatEvent => ({
    type: "user",
    timestamp,
    message: {
      role: "user",
      content: text,
    },
  })

  const defaultOptions: UseTaskChatPersistenceOptions = {
    instanceId: "default",
    messages: [],
    events: [],
    enabled: true,
    isHydrated: true, // Most tests assume hydration is complete
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    // Reset the store to clear any previous session ID
    useAppStore.getState().reset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    // Clean up store after each test
    useAppStore.getState().reset()
  })

  describe("initialization", () => {
    it("initializes the database on mount", async () => {
      renderHook(() => useTaskChatPersistence(defaultOptions))

      // Allow effects to run
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10)
      })

      expect(eventDatabase.init).toHaveBeenCalledTimes(1)
    })

    it("does not initialize when disabled", async () => {
      renderHook(() =>
        useTaskChatPersistence({
          ...defaultOptions,
          enabled: false,
        }),
      )

      // Wait a tick to ensure effect ran
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10)
      })

      expect(eventDatabase.init).not.toHaveBeenCalled()
    })

    it("returns null currentSessionId when no messages or events", () => {
      const { result } = renderHook(() => useTaskChatPersistence(defaultOptions))
      expect(result.current.currentSessionId).toBeNull()
    })
  })

  describe("session creation", () => {
    it("creates a session when messages are added", async () => {
      const messages: TaskChatMessage[] = [createUserMessage("msg-1", "Hello")]
      const events: ChatEvent[] = [createUserEvent(Date.now(), "Hello")]

      const { result } = renderHook(() =>
        useTaskChatPersistence({
          ...defaultOptions,
          messages,
          events,
        }),
      )

      // Allow effects to run
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10)
      })

      expect(result.current.currentSessionId).not.toBeNull()
      expect(result.current.currentSessionId).toMatch(/^default-taskchat-\d+$/)
    })

    it("generates stable session IDs based on instance and timestamp", async () => {
      vi.setSystemTime(new Date(1706123456789))

      const messages: TaskChatMessage[] = [createUserMessage("msg-1", "Hello")]
      const events: ChatEvent[] = [createUserEvent(Date.now(), "Hello")]

      const { result } = renderHook(() =>
        useTaskChatPersistence({
          ...defaultOptions,
          instanceId: "instance-1",
          messages,
          events,
        }),
      )

      // Allow effects to run
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10)
      })

      expect(result.current.currentSessionId).toBe("instance-1-taskchat-1706123456789")
    })
  })

  describe("debounced auto-save", () => {
    it("saves session after debounce interval when events are added", async () => {
      const { rerender } = renderHook(
        (props: UseTaskChatPersistenceOptions) => useTaskChatPersistence(props),
        { initialProps: defaultOptions },
      )

      // Add initial message to create session
      const messages1: TaskChatMessage[] = [createUserMessage("msg-1", "Hello")]
      const events1: ChatEvent[] = [createUserEvent(Date.now(), "Hello")]

      rerender({ ...defaultOptions, messages: messages1, events: events1 })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100) // Not enough time
      })

      expect(eventDatabase.saveTaskChatSession).not.toHaveBeenCalled()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500) // Now enough time
      })

      expect(eventDatabase.saveTaskChatSession).toHaveBeenCalledTimes(1)
    })

    it("resets debounce timer on new events", async () => {
      const { rerender } = renderHook(
        (props: UseTaskChatPersistenceOptions) => useTaskChatPersistence(props),
        { initialProps: defaultOptions },
      )

      // Add first event
      const messages1: TaskChatMessage[] = [createUserMessage("msg-1", "Hello")]
      const events1: ChatEvent[] = [createUserEvent(Date.now(), "Hello")]

      rerender({ ...defaultOptions, messages: messages1, events: events1 })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(300) // Partial wait
      })

      // Add second event - should reset timer
      const events2 = [...events1, createAssistantEvent(Date.now() + 100, "Hi there")]

      rerender({ ...defaultOptions, messages: messages1, events: events2 })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(300) // Another partial wait
      })

      // Should not have saved yet (timer was reset)
      expect(eventDatabase.saveTaskChatSession).not.toHaveBeenCalled()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(300) // Complete the debounce
      })

      expect(eventDatabase.saveTaskChatSession).toHaveBeenCalledTimes(1)
    })
  })

  describe("manual save", () => {
    it("allows manual save of current session", async () => {
      const messages: TaskChatMessage[] = [createUserMessage("msg-1", "Hello")]
      const events: ChatEvent[] = [createUserEvent(Date.now(), "Hello")]

      const { result } = renderHook(() =>
        useTaskChatPersistence({
          ...defaultOptions,
          messages,
          events,
        }),
      )

      // Allow session to be created
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10)
      })

      expect(result.current.currentSessionId).not.toBeNull()

      await act(async () => {
        await result.current.saveCurrentSession()
      })

      // Session data should not include events (v7+ schema - events stored separately)
      expect(eventDatabase.saveTaskChatSession).toHaveBeenCalledWith(
        expect.objectContaining({
          instanceId: "default",
          messages,
        }),
      )
      // Verify events are NOT included in session data
      expect(eventDatabase.saveTaskChatSession).toHaveBeenCalledWith(
        expect.not.objectContaining({
          events: expect.anything(),
        }),
      )
    })

    it("does nothing on manual save when disabled", async () => {
      const messages: TaskChatMessage[] = [createUserMessage("msg-1", "Hello")]

      const { result } = renderHook(() =>
        useTaskChatPersistence({
          ...defaultOptions,
          enabled: false,
          messages,
        }),
      )

      await act(async () => {
        await result.current.saveCurrentSession()
      })

      expect(eventDatabase.saveTaskChatSession).not.toHaveBeenCalled()
    })

    it("cancels pending debounced save on manual save", async () => {
      const messages: TaskChatMessage[] = [createUserMessage("msg-1", "Hello")]
      const events: ChatEvent[] = [createUserEvent(Date.now(), "Hello")]

      const { result, rerender } = renderHook(
        (props: UseTaskChatPersistenceOptions) => useTaskChatPersistence(props),
        { initialProps: { ...defaultOptions, messages, events } },
      )

      // Allow session to be created
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10)
      })

      expect(result.current.currentSessionId).not.toBeNull()

      // Trigger a debounced save
      const events2 = [...events, createAssistantEvent(Date.now() + 100, "Response")]
      rerender({ ...defaultOptions, messages, events: events2 })

      // Manual save before debounce completes
      await act(async () => {
        await result.current.saveCurrentSession()
      })

      expect(eventDatabase.saveTaskChatSession).toHaveBeenCalledTimes(1)

      // Wait for debounce to complete - should not trigger another save
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000)
      })

      expect(eventDatabase.saveTaskChatSession).toHaveBeenCalledTimes(1)
    })
  })

  describe("clear session", () => {
    it("clears the session from IndexedDB", async () => {
      const messages: TaskChatMessage[] = [createUserMessage("msg-1", "Hello")]
      const events: ChatEvent[] = [createUserEvent(Date.now(), "Hello")]

      const { result } = renderHook(() =>
        useTaskChatPersistence({
          ...defaultOptions,
          messages,
          events,
        }),
      )

      // Allow session to be created
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10)
      })

      expect(result.current.currentSessionId).not.toBeNull()
      const sessionId = result.current.currentSessionId

      await act(async () => {
        await result.current.clearSession()
      })

      expect(eventDatabase.deleteTaskChatSession).toHaveBeenCalledWith(sessionId)
      expect(result.current.currentSessionId).toBeNull()
    })

    it("cancels pending debounced save on clear", async () => {
      const messages: TaskChatMessage[] = [createUserMessage("msg-1", "Hello")]
      const events: ChatEvent[] = [createUserEvent(Date.now(), "Hello")]

      const { result, rerender } = renderHook(
        (props: UseTaskChatPersistenceOptions) => useTaskChatPersistence(props),
        { initialProps: { ...defaultOptions, messages, events } },
      )

      // Allow session to be created
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10)
      })

      expect(result.current.currentSessionId).not.toBeNull()

      // Trigger a debounced save
      const events2 = [...events, createAssistantEvent(Date.now() + 100, "Response")]
      rerender({ ...defaultOptions, messages, events: events2 })

      // Clear before debounce completes
      await act(async () => {
        await result.current.clearSession()
      })

      // Wait for debounce to complete - should not trigger save
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000)
      })

      expect(eventDatabase.saveTaskChatSession).not.toHaveBeenCalled()
    })

    it("does nothing on clear when disabled", async () => {
      const { result } = renderHook(() =>
        useTaskChatPersistence({
          ...defaultOptions,
          enabled: false,
        }),
      )

      await act(async () => {
        await result.current.clearSession()
      })

      expect(eventDatabase.deleteTaskChatSession).not.toHaveBeenCalled()
    })
  })

  describe("session stability", () => {
    it("maintains same session when instance ID stays the same", async () => {
      const messages: TaskChatMessage[] = [createUserMessage("msg-1", "Hello")]
      const events: ChatEvent[] = [createUserEvent(Date.now(), "Hello")]

      const { result, rerender } = renderHook(
        (props: UseTaskChatPersistenceOptions) => useTaskChatPersistence(props),
        {
          initialProps: {
            ...defaultOptions,
            messages,
            events,
          },
        },
      )

      // Allow session to be created
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10)
      })

      expect(result.current.currentSessionId).not.toBeNull()
      const firstSessionId = result.current.currentSessionId

      // Add more messages - session should stay the same
      const messages2 = [...messages, createAssistantMessage("msg-2", "Response")]
      const events2 = [...events, createAssistantEvent(Date.now() + 100, "Response")]
      rerender({
        ...defaultOptions,
        messages: messages2,
        events: events2,
      })

      // Allow effects to run
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10)
      })

      // Session ID should remain the same
      expect(result.current.currentSessionId).toBe(firstSessionId)
    })
  })

  describe("disabled state", () => {
    it("does not save when disabled", async () => {
      const messages: TaskChatMessage[] = [createUserMessage("msg-1", "Hello")]
      const events: ChatEvent[] = [createUserEvent(Date.now(), "Hello")]

      renderHook(() =>
        useTaskChatPersistence({
          ...defaultOptions,
          enabled: false,
          messages,
          events,
        }),
      )

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000)
      })

      expect(eventDatabase.saveTaskChatSession).not.toHaveBeenCalled()
    })
  })

  describe("hydration coordination", () => {
    it("blocks session creation until isHydrated is true", async () => {
      const messages: TaskChatMessage[] = [createUserMessage("msg-1", "Hello")]
      const events: ChatEvent[] = [createUserEvent(Date.now(), "Hello")]

      // Start with isHydrated: false
      const { result, rerender } = renderHook(
        (props: UseTaskChatPersistenceOptions) => useTaskChatPersistence(props),
        {
          initialProps: {
            ...defaultOptions,
            messages,
            events,
            isHydrated: false,
          },
        },
      )

      // Allow effects to run
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10)
      })

      // Session should NOT be created yet
      expect(result.current.currentSessionId).toBeNull()
      expect(eventDatabase.saveEvent).not.toHaveBeenCalled()

      // Now simulate hydration completing
      rerender({
        ...defaultOptions,
        messages,
        events,
        isHydrated: true,
      })

      // Allow effects to run
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10)
      })

      // Session should now be created
      expect(result.current.currentSessionId).not.toBeNull()
      expect(result.current.currentSessionId).toMatch(/^default-taskchat-\d+$/)
    })

    it("uses session ID from store when available after hydration", async () => {
      const messages: TaskChatMessage[] = [createUserMessage("msg-1", "Hello")]
      const events: ChatEvent[] = [createUserEvent(Date.now(), "Hello")]
      const storedSessionId = "default-taskchat-1700000000000"

      // Simulate useStoreHydration setting the session ID
      useAppStore.setState({ currentTaskChatSessionId: storedSessionId })

      const { result } = renderHook(() =>
        useTaskChatPersistence({
          ...defaultOptions,
          messages,
          events,
          isHydrated: true, // Hydration complete, session ID already in store
        }),
      )

      // Allow effects to run
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10)
      })

      // Should use the stored session ID, not create a new one
      expect(result.current.currentSessionId).toBe(storedSessionId)
    })

    it("prevents race condition by waiting for hydration before checking store", async () => {
      const messages: TaskChatMessage[] = [createUserMessage("msg-1", "Hello")]
      const events: ChatEvent[] = [createUserEvent(Date.now(), "Hello")]
      const storedSessionId = "default-taskchat-1700000000000"

      // Start with isHydrated: false, no session ID in store yet
      const { result, rerender } = renderHook(
        (props: UseTaskChatPersistenceOptions) => useTaskChatPersistence(props),
        {
          initialProps: {
            ...defaultOptions,
            messages,
            events,
            isHydrated: false,
          },
        },
      )

      // Allow effects to run
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10)
      })

      // No session created yet
      expect(result.current.currentSessionId).toBeNull()

      // Simulate useStoreHydration completing and setting session ID
      useAppStore.setState({ currentTaskChatSessionId: storedSessionId })

      // Now mark hydration as complete
      rerender({
        ...defaultOptions,
        messages,
        events,
        isHydrated: true,
      })

      // Allow effects to run
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10)
      })

      // Should use the hydrated session ID
      expect(result.current.currentSessionId).toBe(storedSessionId)
    })
  })

  describe("session data", () => {
    it("includes correct metadata in saved session (v7+ schema - events stored separately)", async () => {
      vi.setSystemTime(new Date(1706123456789))

      const messages: TaskChatMessage[] = [
        createUserMessage("msg-1", "Hello"),
        createAssistantMessage("msg-2", "Hi there"),
      ]
      const events: ChatEvent[] = [
        createUserEvent(1706123456789, "Hello"),
        createAssistantEvent(1706123456790, "Hi there"),
      ]

      const { result } = renderHook(() =>
        useTaskChatPersistence({
          ...defaultOptions,
          instanceId: "test-instance",
          messages,
          events,
        }),
      )

      // Allow session to be created and events to be saved
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10)
      })

      expect(result.current.currentSessionId).not.toBeNull()

      await act(async () => {
        await result.current.saveCurrentSession()
      })

      // Session metadata should not include events (v7+ schema)
      expect(eventDatabase.saveTaskChatSession).toHaveBeenCalledWith(
        expect.objectContaining({
          instanceId: "test-instance",
          messageCount: 2,
          eventCount: 2,
          lastEventSequence: 1,
          messages,
        }),
      )
      // Verify events are NOT included in session data
      expect(eventDatabase.saveTaskChatSession).toHaveBeenCalledWith(
        expect.not.objectContaining({
          events: expect.anything(),
        }),
      )

      // Events should be saved separately to the events store
      expect(eventDatabase.saveEvent).toHaveBeenCalledTimes(2)
      expect(eventDatabase.saveEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: result.current.currentSessionId,
          eventType: "user",
        }),
      )
      expect(eventDatabase.saveEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: result.current.currentSessionId,
          eventType: "assistant",
        }),
      )
    })
  })

  describe("event deduplication (ID-based tracking)", () => {
    it("does not re-save events that have already been saved", async () => {
      const events1: ChatEvent[] = [createUserEvent(1706123456789, "Hello")]

      const { rerender } = renderHook(
        (props: UseTaskChatPersistenceOptions) => useTaskChatPersistence(props),
        { initialProps: { ...defaultOptions, messages: [], events: events1 } },
      )

      // Allow session to be created and first event to be saved
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10)
      })

      expect(eventDatabase.saveEvent).toHaveBeenCalledTimes(1)

      // Re-render with the same events (simulating React re-render or HMR)
      rerender({ ...defaultOptions, messages: [], events: events1 })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10)
      })

      // Should still be only 1 call - the event was already saved
      expect(eventDatabase.saveEvent).toHaveBeenCalledTimes(1)
    })

    it("uses server-assigned event IDs when available", async () => {
      const serverAssignedId = "server-uuid-12345"
      const eventWithId: ChatEvent = {
        id: serverAssignedId,
        type: "user",
        timestamp: 1706123456789,
        message: { role: "user", content: "Hello" },
      }

      renderHook(() =>
        useTaskChatPersistence({
          ...defaultOptions,
          messages: [],
          events: [eventWithId],
        }),
      )

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10)
      })

      // Should use the server-assigned ID
      expect(eventDatabase.saveEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          id: serverAssignedId,
        }),
      )
    })

    it("generates stable fallback IDs based on content (not array index)", async () => {
      const timestamp = 1706123456789
      const events: ChatEvent[] = [createUserEvent(timestamp, "Hello")]

      const { result } = renderHook(() =>
        useTaskChatPersistence({
          ...defaultOptions,
          messages: [],
          events,
        }),
      )

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10)
      })

      const sessionId = result.current.currentSessionId
      // Fallback ID format: "{sessionId}-{timestamp}-{type}-{contentHash}"
      // Content hash ensures uniqueness even for same timestamp+type
      expect(eventDatabase.saveEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.stringMatching(new RegExp(`^${sessionId}-${timestamp}-user-[a-z0-9]+$`)),
        }),
      )
    })

    it("generates different IDs for events with same timestamp and type but different content", async () => {
      // Clear mocks for this specific test
      vi.mocked(eventDatabase.saveEvent).mockClear()

      // Two events at the same timestamp with same type but different content
      const timestamp = 1706123456789
      const event1: ChatEvent = {
        type: "tool_use",
        timestamp,
        tool: "Read",
        input: { file: "foo.txt" },
      }
      const event2: ChatEvent = {
        type: "tool_use",
        timestamp,
        tool: "Write",
        input: { file: "bar.txt" },
      }

      renderHook(() =>
        useTaskChatPersistence({
          ...defaultOptions,
          messages: [],
          events: [event1, event2],
        }),
      )

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10)
      })

      // Collect all unique IDs that were saved
      const calls = vi.mocked(eventDatabase.saveEvent).mock.calls
      const savedIds = new Set(calls.map(call => call[0].id))

      // Should have exactly 2 unique IDs (events have different content hashes)
      expect(savedIds.size).toBe(2)

      // Both IDs should be distinct (content-based hashing distinguishes them)
      const idsArray = Array.from(savedIds)
      expect(idsArray[0]).not.toBe(idsArray[1])
    })

    it("correctly saves new events added to the array", async () => {
      const events1: ChatEvent[] = [createUserEvent(1706123456789, "Hello")]

      const { rerender } = renderHook(
        (props: UseTaskChatPersistenceOptions) => useTaskChatPersistence(props),
        { initialProps: { ...defaultOptions, messages: [], events: events1 } },
      )

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10)
      })

      expect(eventDatabase.saveEvent).toHaveBeenCalledTimes(1)

      // Add a new event
      const events2 = [...events1, createAssistantEvent(1706123456790, "Hi there")]
      rerender({ ...defaultOptions, messages: [], events: events2 })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10)
      })

      // Should have saved 2 events total (1 original + 1 new)
      expect(eventDatabase.saveEvent).toHaveBeenCalledTimes(2)
    })
  })
})
