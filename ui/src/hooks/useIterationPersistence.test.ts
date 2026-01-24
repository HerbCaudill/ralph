import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import {
  useIterationPersistence,
  type UseIterationPersistenceOptions,
} from "./useIterationPersistence"
import { eventDatabase } from "@/lib/persistence"
import type { ChatEvent, TokenUsage, ContextWindow, IterationInfo } from "@/types"

// Mock the eventDatabase
vi.mock("@/lib/persistence", () => ({
  eventDatabase: {
    init: vi.fn().mockResolvedValue(undefined),
    saveIteration: vi.fn().mockResolvedValue(undefined),
  },
}))

describe("useIterationPersistence", () => {
  const mockTokenUsage: TokenUsage = { input: 1000, output: 500 }
  const mockContextWindow: ContextWindow = { used: 5000, max: 200000 }
  const mockIteration: IterationInfo = { current: 1, total: 5 }

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

  const createRalphTaskStartedEvent = (
    timestamp: number,
    taskId: string,
    taskTitle: string,
  ): ChatEvent => ({
    type: "ralph_task_started",
    timestamp,
    taskId,
    taskTitle,
  })

  const createRalphTaskCompletedEvent = (timestamp: number): ChatEvent => ({
    type: "ralph_task_completed",
    timestamp,
  })

  const defaultOptions: UseIterationPersistenceOptions = {
    instanceId: "default",
    events: [],
    tokenUsage: mockTokenUsage,
    contextWindow: mockContextWindow,
    iteration: mockIteration,
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
      renderHook(() => useIterationPersistence(defaultOptions))

      await waitFor(() => {
        expect(eventDatabase.init).toHaveBeenCalledTimes(1)
      })
    })

    it("does not initialize when disabled", async () => {
      renderHook(() =>
        useIterationPersistence({
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

    it("returns null currentIterationId when no events", () => {
      const { result } = renderHook(() => useIterationPersistence(defaultOptions))
      expect(result.current.currentIterationId).toBeNull()
    })
  })

  describe("iteration detection", () => {
    it("detects a new iteration on system init event", async () => {
      const timestamp = Date.now()
      const events: ChatEvent[] = [createSystemInitEvent(timestamp)]

      const { result } = renderHook(() =>
        useIterationPersistence({
          ...defaultOptions,
          events,
        }),
      )

      await waitFor(() => {
        expect(result.current.currentIterationId).toBe(`default-${timestamp}`)
      })
    })

    it("generates stable iteration IDs based on instance and timestamp", async () => {
      const timestamp = 1706123456789

      const { result: result1 } = renderHook(() =>
        useIterationPersistence({
          ...defaultOptions,
          instanceId: "instance-1",
          events: [createSystemInitEvent(timestamp)],
        }),
      )

      const { result: result2 } = renderHook(() =>
        useIterationPersistence({
          ...defaultOptions,
          instanceId: "instance-2",
          events: [createSystemInitEvent(timestamp)],
        }),
      )

      await waitFor(() => {
        expect(result1.current.currentIterationId).toBe("instance-1-1706123456789")
        expect(result2.current.currentIterationId).toBe("instance-2-1706123456789")
      })
    })
  })

  describe("auto-save on iteration end", () => {
    it("saves iteration on ralph_task_completed event", async () => {
      const startTime = Date.now()
      const events: ChatEvent[] = [
        createSystemInitEvent(startTime),
        createRalphTaskStartedEvent(startTime + 100, "task-1", "Test Task"),
        createAssistantEvent(startTime + 200, "Working on the task..."),
        createRalphTaskCompletedEvent(startTime + 300),
      ]

      const { rerender } = renderHook(
        (props: UseIterationPersistenceOptions) => useIterationPersistence(props),
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
        expect(eventDatabase.saveIteration).toHaveBeenCalled()
      })

      // Check the saved data
      const savedIteration = vi.mocked(eventDatabase.saveIteration).mock.calls[0]?.[0]
      expect(savedIteration).toBeDefined()
      expect(savedIteration?.instanceId).toBe("default")
      expect(savedIteration?.completedAt).not.toBeNull()
      expect(savedIteration?.events).toHaveLength(events.length)
    })

    it("saves iteration on COMPLETE promise signal", async () => {
      const startTime = Date.now()
      const events: ChatEvent[] = [
        createSystemInitEvent(startTime),
        createAssistantEvent(startTime + 100, "Working on it..."),
        createAssistantEvent(startTime + 200, "Done! <promise>COMPLETE</promise>"),
      ]

      const { rerender } = renderHook(
        (props: UseIterationPersistenceOptions) => useIterationPersistence(props),
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
        expect(eventDatabase.saveIteration).toHaveBeenCalled()
      })

      const savedIteration = vi.mocked(eventDatabase.saveIteration).mock.calls[0]?.[0]
      expect(savedIteration?.completedAt).not.toBeNull()
    })
  })

  describe("auto-save on iteration boundary", () => {
    it("saves previous iteration when new iteration starts", async () => {
      const startTime1 = Date.now()
      const startTime2 = startTime1 + 1000

      const { rerender } = renderHook(
        (props: UseIterationPersistenceOptions) => useIterationPersistence(props),
        { initialProps: { ...defaultOptions, events: [] as ChatEvent[] } },
      )

      // First iteration
      rerender({
        ...defaultOptions,
        events: [
          createSystemInitEvent(startTime1),
          createAssistantEvent(startTime1 + 100, "First iteration"),
        ] as ChatEvent[],
      })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      // Second iteration starts - should save the first
      rerender({
        ...defaultOptions,
        events: [
          createSystemInitEvent(startTime1),
          createAssistantEvent(startTime1 + 100, "First iteration"),
          createSystemInitEvent(startTime2),
        ] as ChatEvent[],
      })

      await waitFor(() => {
        expect(eventDatabase.saveIteration).toHaveBeenCalled()
      })

      const savedIteration = vi.mocked(eventDatabase.saveIteration).mock.calls[0]?.[0]
      expect(savedIteration?.id).toBe(`default-${startTime1}`)
      expect(savedIteration?.completedAt).not.toBeNull()
    })
  })

  describe("task info extraction", () => {
    it("extracts task info from ralph_task_started events", async () => {
      const startTime = Date.now()
      const events: ChatEvent[] = [
        createSystemInitEvent(startTime),
        createRalphTaskStartedEvent(startTime + 100, "r-abc123", "Fix the bug"),
        createRalphTaskCompletedEvent(startTime + 200),
      ]

      const { rerender } = renderHook(
        (props: UseIterationPersistenceOptions) => useIterationPersistence(props),
        { initialProps: { ...defaultOptions, events: [] as ChatEvent[] } },
      )

      for (let i = 1; i <= events.length; i++) {
        rerender({ ...defaultOptions, events: events.slice(0, i) as ChatEvent[] })
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
        })
      }

      await waitFor(() => {
        expect(eventDatabase.saveIteration).toHaveBeenCalled()
      })

      const savedIteration = vi.mocked(eventDatabase.saveIteration).mock.calls[0]?.[0]
      expect(savedIteration?.taskId).toBe("r-abc123")
      expect(savedIteration?.taskTitle).toBe("Fix the bug")
    })
  })

  describe("manual save", () => {
    it("allows manual save of current iteration", async () => {
      const startTime = Date.now()
      const events: ChatEvent[] = [
        createSystemInitEvent(startTime),
        createAssistantEvent(startTime + 100, "Working..."),
      ]

      const { result } = renderHook(() =>
        useIterationPersistence({
          ...defaultOptions,
          events,
        }),
      )

      await waitFor(() => {
        expect(result.current.currentIterationId).toBe(`default-${startTime}`)
      })

      await act(async () => {
        await result.current.saveCurrentIteration()
      })

      expect(eventDatabase.saveIteration).toHaveBeenCalledWith(
        expect.objectContaining({
          id: `default-${startTime}`,
          instanceId: "default",
          completedAt: null, // Manual save doesn't mark as complete
          events,
        }),
      )
    })

    it("does nothing on manual save when disabled", async () => {
      const { result } = renderHook(() =>
        useIterationPersistence({
          ...defaultOptions,
          enabled: false,
          events: [createSystemInitEvent(Date.now())],
        }),
      )

      await act(async () => {
        await result.current.saveCurrentIteration()
      })

      expect(eventDatabase.saveIteration).not.toHaveBeenCalled()
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
        (props: UseIterationPersistenceOptions) => useIterationPersistence(props),
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

      expect(eventDatabase.saveIteration).not.toHaveBeenCalled()
    })
  })

  describe("progress saving", () => {
    it("saves progress every 10 new events", async () => {
      const startTime = Date.now()

      // Create 15 events (1 init + 14 assistant messages)
      const events: ChatEvent[] = [
        createSystemInitEvent(startTime),
        ...Array.from({ length: 14 }, (_, i) =>
          createAssistantEvent(startTime + (i + 1) * 100, `Message ${i + 1}`),
        ),
      ]

      const { rerender } = renderHook(
        (props: UseIterationPersistenceOptions) => useIterationPersistence(props),
        { initialProps: { ...defaultOptions, events: [] as ChatEvent[] } },
      )

      // Add events one at a time
      for (let i = 1; i <= events.length; i++) {
        rerender({ ...defaultOptions, events: events.slice(0, i) as ChatEvent[] })
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 5))
        })
      }

      // Should have saved at least once (at 10+ events)
      await waitFor(() => {
        expect(eventDatabase.saveIteration).toHaveBeenCalled()
      })
    })
  })
})
