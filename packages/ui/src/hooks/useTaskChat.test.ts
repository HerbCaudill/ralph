import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useTaskChat } from "./useTaskChat"
import { useAppStore, flushTaskChatEventsBatch } from "@/store"

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

/**
 * Helper to add an assistant message via SDK events.
 * Flushes the batch immediately so events are available synchronously in tests.
 */
function addAssistantEvent(content: string, timestamp: number) {
  useAppStore.getState().addTaskChatEvent({
    type: "assistant",
    timestamp,
    message: {
      content: [{ type: "text", text: content }],
    },
  } as any)
  flushTaskChatEventsBatch()
}

describe("useTaskChat", () => {
  beforeEach(() => {
    useAppStore.getState().clearTaskChatMessages()
    useAppStore.getState().clearTaskChatEvents()
    useAppStore.getState().setTaskChatLoading(false)
    useAppStore.getState().setConnectionStatus("connected")
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("initial state", () => {
    it("returns empty events array initially", () => {
      const { result } = renderHook(() => useTaskChat())
      expect(result.current.events).toEqual([])
    })

    it("returns isLoading as false initially", () => {
      const { result } = renderHook(() => useTaskChat())
      expect(result.current.isLoading).toBe(false)
    })

    it("returns isConnected as true when connected", () => {
      const { result } = renderHook(() => useTaskChat())
      expect(result.current.isConnected).toBe(true)
    })

    it("returns isConnected as false when disconnected", () => {
      useAppStore.getState().setConnectionStatus("disconnected")
      const { result } = renderHook(() => useTaskChat())
      expect(result.current.isConnected).toBe(false)
    })

    it("returns error as null initially", () => {
      const { result } = renderHook(() => useTaskChat())
      expect(result.current.error).toBeNull()
    })

    it("returns correct placeholder when connected", () => {
      const { result } = renderHook(() => useTaskChat())
      expect(result.current.placeholder).toBe("How can I help?")
    })

    it("returns connecting placeholder when disconnected", () => {
      useAppStore.getState().setConnectionStatus("disconnected")
      const { result } = renderHook(() => useTaskChat())
      expect(result.current.placeholder).toBe("Connecting...")
    })

    it("returns waiting placeholder when loading", () => {
      useAppStore.getState().setTaskChatLoading(true)
      const { result } = renderHook(() => useTaskChat())
      expect(result.current.placeholder).toBe("Waiting for response...")
    })
  })

  describe("events", () => {
    it("includes user messages in events", () => {
      useAppStore.getState().addTaskChatMessage({
        id: "user-1",
        role: "user",
        content: "Hello",
        timestamp: 1000,
      })

      const { result } = renderHook(() => useTaskChat())

      expect(result.current.events).toHaveLength(1)
      expect(result.current.events[0]).toMatchObject({
        type: "user_message",
        message: "Hello",
        timestamp: 1000,
      })
    })

    it("includes assistant events in events", () => {
      addAssistantEvent("Hi there!", 1000)

      const { result } = renderHook(() => useTaskChat())

      expect(result.current.events).toHaveLength(1)
      expect(result.current.events[0]).toMatchObject({
        type: "assistant",
        timestamp: 1000,
      })
    })

    it("merges and sorts user messages and assistant events by timestamp", () => {
      useAppStore.getState().addTaskChatMessage({
        id: "user-1",
        role: "user",
        content: "First",
        timestamp: 1000,
      })
      addAssistantEvent("Second", 2000)
      useAppStore.getState().addTaskChatMessage({
        id: "user-2",
        role: "user",
        content: "Third",
        timestamp: 3000,
      })

      const { result } = renderHook(() => useTaskChat())

      expect(result.current.events).toHaveLength(3)
      expect(result.current.events[0].timestamp).toBe(1000)
      expect(result.current.events[1].timestamp).toBe(2000)
      expect(result.current.events[2].timestamp).toBe(3000)
    })
  })

  describe("sendMessage", () => {
    it("adds user message to store immediately", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, status: "processing" }),
      })

      const { result } = renderHook(() => useTaskChat())

      await act(async () => {
        await result.current.sendMessage("Hello")
      })

      expect(result.current.events).toHaveLength(1)
      expect(result.current.events[0]).toMatchObject({
        type: "user_message",
        message: "Hello",
      })
    })

    it("sets loading to true when sending", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, status: "processing" }),
      })

      const { result } = renderHook(() => useTaskChat())

      await act(async () => {
        result.current.sendMessage("Hello")
      })

      expect(result.current.isLoading).toBe(true)
    })

    it("calls the API with the message", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, status: "processing" }),
      })

      const { result } = renderHook(() => useTaskChat())

      await act(async () => {
        await result.current.sendMessage("Hello")
      })

      expect(mockFetch).toHaveBeenCalledWith("/api/task-chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Hello" }),
      })
    })

    it("sets error on API failure", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: false, error: "Failed to process" }),
      })

      const { result } = renderHook(() => useTaskChat())

      await act(async () => {
        await result.current.sendMessage("Hello")
      })

      expect(result.current.error).toBe("Failed to process")
      expect(result.current.isLoading).toBe(false)
    })

    it("removes message and keeps loading on 'already in progress' error", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: false, error: "A request is already in progress" }),
      })

      const { result } = renderHook(() => useTaskChat())

      await act(async () => {
        await result.current.sendMessage("Hello")
      })

      // Message should be removed
      expect(result.current.events).toHaveLength(0)
      // Error should not be set
      expect(result.current.error).toBeNull()
      // Loading should stay true (synced with server)
      expect(result.current.isLoading).toBe(true)
    })
  })

  describe("clearHistory", () => {
    it("calls the clear API", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true }),
      })

      const { result } = renderHook(() => useTaskChat())

      await act(async () => {
        await result.current.clearHistory()
      })

      expect(mockFetch).toHaveBeenCalledWith("/api/task-chat/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    })

    it("clears messages from store on success", async () => {
      useAppStore.getState().addTaskChatMessage({
        id: "user-1",
        role: "user",
        content: "Hello",
        timestamp: 1000,
      })

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true }),
      })

      const { result } = renderHook(() => useTaskChat())

      expect(result.current.events).toHaveLength(1)

      await act(async () => {
        await result.current.clearHistory()
      })

      expect(result.current.events).toHaveLength(0)
    })

    it("does not clear messages from store when server returns failure (bug r-tufi7.46)", async () => {
      // This test verifies fix for bug r-tufi7.46:
      // "Race window: Client clears local state before server confirms, then server might fail"
      // The fix ensures client clearing is contingent on server success.
      useAppStore.getState().addTaskChatMessage({
        id: "user-1",
        role: "user",
        content: "Hello",
        timestamp: 1000,
      })

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: false, error: "Server error" }),
      })

      const { result } = renderHook(() => useTaskChat())

      expect(result.current.events).toHaveLength(1)

      await act(async () => {
        await result.current.clearHistory()
      })

      // Messages should NOT be cleared when server fails
      expect(result.current.events).toHaveLength(1)
      expect(result.current.events[0]).toMatchObject({
        type: "user_message",
        message: "Hello",
      })
    })
  })

  describe("loadingJustCompleted", () => {
    it("is false initially", () => {
      const { result } = renderHook(() => useTaskChat())
      expect(result.current.loadingJustCompleted).toBe(false)
    })

    it("becomes true when loading transitions from true to false", async () => {
      useAppStore.getState().setTaskChatLoading(true)

      const { result } = renderHook(() => useTaskChat())

      await act(async () => {
        useAppStore.getState().setTaskChatLoading(false)
      })

      expect(result.current.loadingJustCompleted).toBe(true)
    })

    it("can be reset via onLoadingComplete", async () => {
      useAppStore.getState().setTaskChatLoading(true)

      const { result } = renderHook(() => useTaskChat())

      await act(async () => {
        useAppStore.getState().setTaskChatLoading(false)
      })

      expect(result.current.loadingJustCompleted).toBe(true)

      act(() => {
        result.current.onLoadingComplete()
      })

      expect(result.current.loadingJustCompleted).toBe(false)
    })
  })

  describe("storageKey", () => {
    it("returns the correct storage key", () => {
      const { result } = renderHook(() => useTaskChat())
      expect(result.current.storageKey).toBe("ralph-ui-task-chat-input-draft")
    })
  })

  describe("timeout management", () => {
    it("sets up a timeout when sending a message", async () => {
      const setTimeoutSpy = vi.spyOn(global, "setTimeout")
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, status: "processing" }),
      })

      const { result } = renderHook(() => useTaskChat())

      await act(async () => {
        await result.current.sendMessage("Hello")
      })

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 60000)

      setTimeoutSpy.mockRestore()
    })

    it("clears timeout when API returns error", async () => {
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout")
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: false, error: "Failed to process" }),
      })

      const { result } = renderHook(() => useTaskChat())

      await act(async () => {
        await result.current.sendMessage("Hello")
      })

      expect(clearTimeoutSpy).toHaveBeenCalled()

      clearTimeoutSpy.mockRestore()
    })
  })
})
