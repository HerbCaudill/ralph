/**
 * Tests for useStoreHydration hook.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { useStoreHydration } from "./useStoreHydration"
import { eventDatabase } from "@/lib/persistence"
import { useAppStore } from "@/store"
import type { PersistedIteration, PersistedTaskChatSession } from "@/lib/persistence"
import type { ChatEvent, TaskChatMessage } from "@/types"

// Mock the eventDatabase
vi.mock("@/lib/persistence", () => ({
  eventDatabase: {
    init: vi.fn().mockResolvedValue(undefined),
    getLatestActiveIteration: vi.fn().mockResolvedValue(undefined),
    getLatestTaskChatSessionForInstance: vi.fn().mockResolvedValue(undefined),
  },
}))

describe("useStoreHydration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAppStore.getState().reset()
  })

  afterEach(() => {
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

  it("should restore events from active iteration", async () => {
    const mockEvents: ChatEvent[] = [
      { type: "system", timestamp: 1000, subtype: "init" } as any,
      {
        type: "assistant",
        timestamp: 2000,
        message: { content: [{ type: "text", text: "Hello" }] },
      } as any,
    ]

    const mockIteration: PersistedIteration = {
      id: "default-1000",
      instanceId: "default",
      workspaceId: null,
      startedAt: 1000,
      completedAt: null,
      taskId: null,
      taskTitle: null,
      tokenUsage: { input: 100, output: 50 },
      contextWindow: { used: 150, max: 200000 },
      iteration: { current: 1, total: 1 },
      eventCount: 2,
      lastEventSequence: 1,
      events: mockEvents,
    }

    vi.mocked(eventDatabase.getLatestActiveIteration).mockResolvedValue(mockIteration)

    const { result } = renderHook(() => useStoreHydration({ instanceId: "default" }))

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true)
    })

    // Check that events were restored
    expect(useAppStore.getState().events).toEqual(mockEvents)
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
      taskTitle: "Test Task",
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

  it("should only hydrate once", async () => {
    const { rerender } = renderHook(({ instanceId }) => useStoreHydration({ instanceId }), {
      initialProps: { instanceId: "default" },
    })

    await waitFor(() => {
      expect(eventDatabase.init).toHaveBeenCalledTimes(1)
    })

    // Rerender with the same props
    rerender({ instanceId: "default" })

    // Should still only be called once
    expect(eventDatabase.init).toHaveBeenCalledTimes(1)
  })

  it("should not restore events if iteration has no events", async () => {
    const mockIteration: PersistedIteration = {
      id: "default-1000",
      instanceId: "default",
      workspaceId: null,
      startedAt: 1000,
      completedAt: null,
      taskId: null,
      taskTitle: null,
      tokenUsage: { input: 0, output: 0 },
      contextWindow: { used: 0, max: 200000 },
      iteration: { current: 0, total: 0 },
      eventCount: 0,
      lastEventSequence: -1,
      events: [],
    }

    vi.mocked(eventDatabase.getLatestActiveIteration).mockResolvedValue(mockIteration)

    const { result } = renderHook(() => useStoreHydration({ instanceId: "default" }))

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true)
    })

    // Events should remain empty
    expect(useAppStore.getState().events).toEqual([])
  })
})
