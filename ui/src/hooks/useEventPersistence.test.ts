import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useEventPersistence, type UseEventPersistenceOptions } from "./useEventPersistence"
import { eventDatabase } from "@/lib/persistence"
import type { ChatEvent } from "@/types"

// Mock the eventDatabase
vi.mock("@/lib/persistence", () => ({
  eventDatabase: {
    init: vi.fn().mockResolvedValue(undefined),
    saveEvent: vi.fn().mockResolvedValue(undefined),
    saveEvents: vi.fn().mockResolvedValue(undefined),
  },
}))

describe("useEventPersistence", () => {
  const createSystemInitEvent = (timestamp: number): ChatEvent => ({
    type: "system",
    timestamp,
    subtype: "init",
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
      content: text,
    },
  })

  const defaultOptions: UseEventPersistenceOptions = {
    sessionId: "test-session-123",
    events: [],
    workspaceId: "test-workspace",
    enabled: true,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("initialization", () => {
    it("initializes the database on mount", async () => {
      renderHook(() => useEventPersistence(defaultOptions))

      await waitFor(() => {
        expect(eventDatabase.init).toHaveBeenCalledTimes(1)
      })
    })

    it("does not initialize when disabled", async () => {
      renderHook(() =>
        useEventPersistence({
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

    it("returns zero persistedEventCount when no events", () => {
      const { result } = renderHook(() => useEventPersistence(defaultOptions))
      expect(result.current.persistedEventCount).toBe(0)
    })
  })

  describe("event saving", () => {
    it("saves events when they arrive", async () => {
      const timestamp = Date.now()
      const events: ChatEvent[] = [
        createSystemInitEvent(timestamp),
        createAssistantEvent(timestamp + 100, "Hello"),
      ]

      const { rerender } = renderHook(
        (props: UseEventPersistenceOptions) => useEventPersistence(props),
        { initialProps: defaultOptions },
      )

      // Add events
      rerender({ ...defaultOptions, events })

      await waitFor(() => {
        expect(eventDatabase.saveEvent).toHaveBeenCalledTimes(2)
      })

      // Check the first saved event
      const firstCall = vi.mocked(eventDatabase.saveEvent).mock.calls[0]?.[0]
      expect(firstCall).toMatchObject({
        id: "test-session-123-event-0",
        sessionId: "test-session-123",
        eventType: "system",
      })

      // Check the second saved event
      const secondCall = vi.mocked(eventDatabase.saveEvent).mock.calls[1]?.[0]
      expect(secondCall).toMatchObject({
        id: "test-session-123-event-1",
        sessionId: "test-session-123",
        eventType: "assistant",
      })
    })

    it("only saves new events on subsequent updates", async () => {
      const timestamp = Date.now()
      const initialEvents: ChatEvent[] = [createSystemInitEvent(timestamp)]
      const updatedEvents: ChatEvent[] = [
        ...initialEvents,
        createAssistantEvent(timestamp + 100, "Hello"),
        createUserEvent(timestamp + 200, "Hi there"),
      ]

      const { rerender } = renderHook(
        (props: UseEventPersistenceOptions) => useEventPersistence(props),
        { initialProps: { ...defaultOptions, events: initialEvents } },
      )

      // Wait for initial save
      await waitFor(() => {
        expect(eventDatabase.saveEvent).toHaveBeenCalledTimes(1)
      })

      vi.clearAllMocks()

      // Add more events
      rerender({ ...defaultOptions, events: updatedEvents })

      await waitFor(() => {
        expect(eventDatabase.saveEvent).toHaveBeenCalledTimes(2)
      })

      // Should only save the new events (indices 1 and 2)
      const calls = vi.mocked(eventDatabase.saveEvent).mock.calls
      expect(calls[0]?.[0]?.id).toBe("test-session-123-event-1")
      expect(calls[1]?.[0]?.id).toBe("test-session-123-event-2")
    })

    it("resets event count when session changes", async () => {
      const timestamp = Date.now()
      const events1: ChatEvent[] = [createSystemInitEvent(timestamp)]
      const events2: ChatEvent[] = [createSystemInitEvent(timestamp + 1000)]

      const { rerender } = renderHook(
        (props: UseEventPersistenceOptions) => useEventPersistence(props),
        { initialProps: { ...defaultOptions, events: events1 } },
      )

      // Wait for initial save
      await waitFor(() => {
        expect(eventDatabase.saveEvent).toHaveBeenCalledTimes(1)
      })

      vi.clearAllMocks()

      // Change session
      rerender({
        ...defaultOptions,
        sessionId: "test-session-456",
        events: events2,
      })

      await waitFor(() => {
        expect(eventDatabase.saveEvent).toHaveBeenCalledTimes(1)
      })

      // Should save with new session ID and reset index to 0
      const call = vi.mocked(eventDatabase.saveEvent).mock.calls[0]?.[0]
      expect(call?.id).toBe("test-session-456-event-0")
      expect(call?.sessionId).toBe("test-session-456")
    })

    it("uses Date.now() as fallback when event has no timestamp", async () => {
      const beforeTime = Date.now()

      const eventWithoutTimestamp = {
        type: "system",
        subtype: "init",
      } as unknown as ChatEvent

      const { rerender } = renderHook(
        (props: UseEventPersistenceOptions) => useEventPersistence(props),
        { initialProps: defaultOptions },
      )

      rerender({ ...defaultOptions, events: [eventWithoutTimestamp] })

      const afterTime = Date.now()

      await waitFor(() => {
        expect(eventDatabase.saveEvent).toHaveBeenCalledTimes(1)
      })

      const savedEvent = vi.mocked(eventDatabase.saveEvent).mock.calls[0]?.[0]
      expect(savedEvent?.timestamp).toBeGreaterThanOrEqual(beforeTime)
      expect(savedEvent?.timestamp).toBeLessThanOrEqual(afterTime)
    })
  })

  describe("disabled state", () => {
    it("does not save events when disabled", async () => {
      const timestamp = Date.now()
      const events: ChatEvent[] = [createSystemInitEvent(timestamp)]

      const { rerender } = renderHook(
        (props: UseEventPersistenceOptions) => useEventPersistence(props),
        { initialProps: { ...defaultOptions, enabled: false } },
      )

      rerender({ ...defaultOptions, enabled: false, events })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
      })

      expect(eventDatabase.saveEvent).not.toHaveBeenCalled()
    })

    it("does not save events when sessionId is null", async () => {
      const timestamp = Date.now()
      const events: ChatEvent[] = [createSystemInitEvent(timestamp)]

      const { rerender } = renderHook(
        (props: UseEventPersistenceOptions) => useEventPersistence(props),
        { initialProps: { ...defaultOptions, sessionId: null } },
      )

      rerender({ ...defaultOptions, sessionId: null, events })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
      })

      expect(eventDatabase.saveEvent).not.toHaveBeenCalled()
    })
  })

  describe("batch saving", () => {
    it("saves events in batch via saveEvents method", async () => {
      const timestamp = Date.now()
      const events: ChatEvent[] = [
        createSystemInitEvent(timestamp),
        createAssistantEvent(timestamp + 100, "Hello"),
        createUserEvent(timestamp + 200, "Hi there"),
      ]

      const { result } = renderHook(() =>
        useEventPersistence({
          ...defaultOptions,
          events: [],
        }),
      )

      await act(async () => {
        await result.current.saveEvents(events, 0)
      })

      expect(eventDatabase.saveEvents).toHaveBeenCalledTimes(1)

      const savedEvents = vi.mocked(eventDatabase.saveEvents).mock.calls[0]?.[0]
      expect(savedEvents).toHaveLength(3)
      expect(savedEvents?.[0]?.id).toBe("test-session-123-event-0")
      expect(savedEvents?.[1]?.id).toBe("test-session-123-event-1")
      expect(savedEvents?.[2]?.id).toBe("test-session-123-event-2")
    })

    it("saves batch starting from specified index", async () => {
      const timestamp = Date.now()
      const events: ChatEvent[] = [
        createAssistantEvent(timestamp, "Message 5"),
        createUserEvent(timestamp + 100, "Message 6"),
      ]

      const { result } = renderHook(() =>
        useEventPersistence({
          ...defaultOptions,
          events: [],
        }),
      )

      await act(async () => {
        await result.current.saveEvents(events, 5)
      })

      const savedEvents = vi.mocked(eventDatabase.saveEvents).mock.calls[0]?.[0]
      expect(savedEvents?.[0]?.id).toBe("test-session-123-event-5")
      expect(savedEvents?.[1]?.id).toBe("test-session-123-event-6")
    })

    it("does nothing on batch save when disabled", async () => {
      const timestamp = Date.now()
      const events: ChatEvent[] = [createSystemInitEvent(timestamp)]

      const { result } = renderHook(() =>
        useEventPersistence({
          ...defaultOptions,
          enabled: false,
        }),
      )

      await act(async () => {
        await result.current.saveEvents(events, 0)
      })

      expect(eventDatabase.saveEvents).not.toHaveBeenCalled()
    })

    it("does nothing on batch save when sessionId is null", async () => {
      const timestamp = Date.now()
      const events: ChatEvent[] = [createSystemInitEvent(timestamp)]

      const { result } = renderHook(() =>
        useEventPersistence({
          ...defaultOptions,
          sessionId: null,
        }),
      )

      await act(async () => {
        await result.current.saveEvents(events, 0)
      })

      expect(eventDatabase.saveEvents).not.toHaveBeenCalled()
    })

    it("does nothing on batch save with empty events array", async () => {
      const { result } = renderHook(() => useEventPersistence(defaultOptions))

      await act(async () => {
        await result.current.saveEvents([], 0)
      })

      expect(eventDatabase.saveEvents).not.toHaveBeenCalled()
    })
  })

  describe("event type extraction", () => {
    it("extracts event type from system events", async () => {
      const { rerender } = renderHook(
        (props: UseEventPersistenceOptions) => useEventPersistence(props),
        { initialProps: defaultOptions },
      )

      rerender({
        ...defaultOptions,
        events: [createSystemInitEvent(Date.now())],
      })

      await waitFor(() => {
        expect(eventDatabase.saveEvent).toHaveBeenCalled()
      })

      const savedEvent = vi.mocked(eventDatabase.saveEvent).mock.calls[0]?.[0]
      expect(savedEvent?.eventType).toBe("system")
    })

    it("extracts event type from assistant events", async () => {
      const { rerender } = renderHook(
        (props: UseEventPersistenceOptions) => useEventPersistence(props),
        { initialProps: defaultOptions },
      )

      rerender({
        ...defaultOptions,
        events: [createAssistantEvent(Date.now(), "Hello")],
      })

      await waitFor(() => {
        expect(eventDatabase.saveEvent).toHaveBeenCalled()
      })

      const savedEvent = vi.mocked(eventDatabase.saveEvent).mock.calls[0]?.[0]
      expect(savedEvent?.eventType).toBe("assistant")
    })

    it("falls back to unknown for events without type", async () => {
      const eventWithoutType = {} as unknown as ChatEvent

      const { rerender } = renderHook(
        (props: UseEventPersistenceOptions) => useEventPersistence(props),
        { initialProps: defaultOptions },
      )

      rerender({
        ...defaultOptions,
        events: [eventWithoutType],
      })

      await waitFor(() => {
        expect(eventDatabase.saveEvent).toHaveBeenCalled()
      })

      const savedEvent = vi.mocked(eventDatabase.saveEvent).mock.calls[0]?.[0]
      expect(savedEvent?.eventType).toBe("unknown")
    })
  })

  describe("error handling", () => {
    it("logs error but continues when saveEvent fails", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
      vi.mocked(eventDatabase.saveEvent).mockRejectedValueOnce(new Error("Save failed"))

      const { rerender } = renderHook(
        (props: UseEventPersistenceOptions) => useEventPersistence(props),
        { initialProps: defaultOptions },
      )

      rerender({
        ...defaultOptions,
        events: [createSystemInitEvent(Date.now())],
      })

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          "[useEventPersistence] Failed to save event:",
          expect.any(Error),
          expect.objectContaining({
            eventIndex: expect.any(Number),
            sessionId: expect.any(String),
            eventType: expect.any(String),
          }),
        )
      })

      consoleSpy.mockRestore()
    })

    it("logs error but continues when saveEvents batch fails", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
      vi.mocked(eventDatabase.saveEvents).mockRejectedValueOnce(new Error("Batch save failed"))

      const { result } = renderHook(() => useEventPersistence(defaultOptions))

      await act(async () => {
        await result.current.saveEvents([createSystemInitEvent(Date.now())], 0)
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        "[useEventPersistence] Failed to save events batch:",
        expect.any(Error),
      )

      consoleSpy.mockRestore()
    })
  })
})
