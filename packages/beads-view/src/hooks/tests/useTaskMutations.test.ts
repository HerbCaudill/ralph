import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useTaskMutations } from "../useTaskMutations"
import { beadsViewStore } from "../../store"
import { configureApiClient } from "../../lib/apiClient"

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = []

  readyState = WebSocket.CONNECTING
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  url: string

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }

  send = vi.fn()
  close = vi.fn(() => {
    this.readyState = WebSocket.CLOSED
    this.onclose?.({ code: 1000, reason: "Normal closure" } as CloseEvent)
  })

  // Test helpers
  simulateOpen() {
    this.readyState = WebSocket.OPEN
    this.onopen?.({} as Event)
  }

  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent)
  }

  simulateClose(code = 1000, reason = "Normal closure") {
    this.readyState = WebSocket.CLOSED
    this.onclose?.({ code, reason } as CloseEvent)
  }

  simulateError() {
    this.onerror?.({} as Event)
  }

  static clearInstances() {
    MockWebSocket.instances = []
  }

  static get lastInstance(): MockWebSocket | undefined {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1]
  }
}

// Replace global WebSocket
const originalWebSocket = global.WebSocket
beforeEach(() => {
  global.WebSocket = MockWebSocket as unknown as typeof WebSocket
  MockWebSocket.clearInstances()
})
afterEach(() => {
  global.WebSocket = originalWebSocket
})

describe("useTaskMutations", () => {
  const mockWorkspace = "/path/to/workspace"

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    MockWebSocket.clearInstances()

    // Reset store
    beadsViewStore.setState({ tasks: [] })

    // Configure API client with base URL
    configureApiClient({ baseUrl: "http://localhost:4243", workspacePath: mockWorkspace })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe("connection", () => {
    it("connects to WebSocket on mount", () => {
      renderHook(() => useTaskMutations())

      // Allow setTimeout(fn, 0) to fire for StrictMode safety
      act(() => {
        vi.advanceTimersByTime(0)
      })

      expect(MockWebSocket.instances).toHaveLength(1)
      expect(MockWebSocket.lastInstance?.url).toBe("ws://localhost:4243/ws")
    })

    it("subscribes to workspace on connection", () => {
      renderHook(() => useTaskMutations())

      act(() => {
        vi.advanceTimersByTime(0)
      })

      const ws = MockWebSocket.lastInstance!
      ws.simulateOpen()

      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "ws:subscribe_workspace",
          workspace: mockWorkspace,
        }),
      )
    })

    it("accepts custom workspacePath option", () => {
      const customPath = "/custom/workspace"
      renderHook(() => useTaskMutations({ workspacePath: customPath }))

      act(() => {
        vi.advanceTimersByTime(0)
      })

      const ws = MockWebSocket.lastInstance!
      ws.simulateOpen()

      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "ws:subscribe_workspace",
          workspace: customPath,
        }),
      )
    })

    it("closes connection on unmount", () => {
      const { unmount } = renderHook(() => useTaskMutations())

      act(() => {
        vi.advanceTimersByTime(0)
      })

      const ws = MockWebSocket.lastInstance!
      ws.simulateOpen()

      unmount()

      expect(ws.close).toHaveBeenCalled()
    })

    it("returns connected status after connection opens", () => {
      const { result } = renderHook(() => useTaskMutations())

      act(() => {
        vi.advanceTimersByTime(0)
      })

      expect(result.current.isConnected).toBe(false)

      const ws = MockWebSocket.lastInstance!
      act(() => {
        ws.simulateOpen()
      })

      expect(result.current.isConnected).toBe(true)
    })

    it("returns disconnected status after connection closes", () => {
      const { result } = renderHook(() => useTaskMutations())

      act(() => {
        vi.advanceTimersByTime(0)
      })

      const ws = MockWebSocket.lastInstance!
      act(() => {
        ws.simulateOpen()
      })

      expect(result.current.isConnected).toBe(true)

      act(() => {
        ws.simulateClose()
      })

      expect(result.current.isConnected).toBe(false)
    })
  })

  describe("mutation handling", () => {
    it("calls refreshTasks on mutation:event message", async () => {
      const refreshTasksSpy = vi.spyOn(beadsViewStore.getState(), "refreshTasks")

      renderHook(() => useTaskMutations())

      act(() => {
        vi.advanceTimersByTime(0)
      })

      const ws = MockWebSocket.lastInstance!
      act(() => {
        ws.simulateOpen()
      })

      act(() => {
        ws.simulateMessage({
          type: "mutation:event",
          event: { type: "created", issueId: "task-1" },
          workspace: mockWorkspace,
          timestamp: Date.now(),
        })
      })

      expect(refreshTasksSpy).toHaveBeenCalled()
    })

    it("ignores non-mutation messages", () => {
      const refreshTasksSpy = vi.spyOn(beadsViewStore.getState(), "refreshTasks")

      renderHook(() => useTaskMutations())

      act(() => {
        vi.advanceTimersByTime(0)
      })

      const ws = MockWebSocket.lastInstance!
      act(() => {
        ws.simulateOpen()
      })

      act(() => {
        ws.simulateMessage({ type: "connected", server: "beads-server", timestamp: Date.now() })
      })

      expect(refreshTasksSpy).not.toHaveBeenCalled()
    })

    it("ignores pong messages", () => {
      const refreshTasksSpy = vi.spyOn(beadsViewStore.getState(), "refreshTasks")

      renderHook(() => useTaskMutations())

      act(() => {
        vi.advanceTimersByTime(0)
      })

      const ws = MockWebSocket.lastInstance!
      act(() => {
        ws.simulateOpen()
      })

      act(() => {
        ws.simulateMessage({ type: "pong", timestamp: Date.now() })
      })

      expect(refreshTasksSpy).not.toHaveBeenCalled()
    })

    it("invokes onMutation callback when provided", () => {
      const onMutation = vi.fn()
      renderHook(() => useTaskMutations({ onMutation }))

      act(() => {
        vi.advanceTimersByTime(0)
      })

      const ws = MockWebSocket.lastInstance!
      act(() => {
        ws.simulateOpen()
      })

      const mutationEvent = {
        type: "mutation:event",
        event: { type: "created", issueId: "task-1" },
        workspace: mockWorkspace,
        timestamp: Date.now(),
      }

      act(() => {
        ws.simulateMessage(mutationEvent)
      })

      expect(onMutation).toHaveBeenCalledWith(mutationEvent.event)
    })
  })

  describe("reconnection", () => {
    it("reconnects after connection closes", () => {
      renderHook(() => useTaskMutations())

      act(() => {
        vi.advanceTimersByTime(0)
      })

      const ws1 = MockWebSocket.lastInstance!
      act(() => {
        ws1.simulateOpen()
      })

      expect(MockWebSocket.instances).toHaveLength(1)

      act(() => {
        ws1.simulateClose(1006, "Abnormal closure")
      })

      // Should schedule reconnect
      act(() => {
        vi.advanceTimersByTime(1000) // Initial reconnect delay
      })

      expect(MockWebSocket.instances).toHaveLength(2)
    })

    it("uses exponential backoff for reconnection when connection fails to open", () => {
      renderHook(() => useTaskMutations())

      act(() => {
        vi.advanceTimersByTime(0)
      })

      // First connection fails before opening
      const ws1 = MockWebSocket.lastInstance!
      act(() => {
        ws1.simulateClose(1006, "Connection failed")
      })

      // First reconnect: 1000ms
      expect(MockWebSocket.instances).toHaveLength(1)
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(MockWebSocket.instances).toHaveLength(2)

      // Second connection fails before opening
      const ws2 = MockWebSocket.lastInstance!
      act(() => {
        ws2.simulateClose(1006, "Connection failed")
      })

      // Second reconnect: 2000ms (backoff doubled)
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(MockWebSocket.instances).toHaveLength(2) // Not yet
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(MockWebSocket.instances).toHaveLength(3)

      // Third connection fails before opening
      const ws3 = MockWebSocket.lastInstance!
      act(() => {
        ws3.simulateClose(1006, "Connection failed")
      })

      // Third reconnect: 4000ms (backoff doubled again)
      act(() => {
        vi.advanceTimersByTime(2000)
      })
      expect(MockWebSocket.instances).toHaveLength(3) // Not yet
      act(() => {
        vi.advanceTimersByTime(2000)
      })
      expect(MockWebSocket.instances).toHaveLength(4)
    })

    it("caps reconnection delay at 30 seconds", () => {
      renderHook(() => useTaskMutations())

      act(() => {
        vi.advanceTimersByTime(0)
      })

      // Simulate many failures to exceed cap (don't open to avoid resetting backoff)
      for (let i = 0; i < 10; i++) {
        const ws = MockWebSocket.lastInstance!
        act(() => {
          ws.simulateClose(1006, "Connection failed")
        })
        act(() => {
          vi.advanceTimersByTime(30000) // Max delay
        })
      }

      // The delay should be capped at 30000ms
      const ws = MockWebSocket.lastInstance!
      act(() => {
        ws.simulateClose(1006, "Connection failed")
      })

      // Should reconnect within 30s
      act(() => {
        vi.advanceTimersByTime(30000)
      })
      const newInstanceCount = MockWebSocket.instances.length
      expect(newInstanceCount).toBeGreaterThan(10)
    })

    it("resets backoff on successful connection", () => {
      renderHook(() => useTaskMutations())

      act(() => {
        vi.advanceTimersByTime(0)
      })

      // First connection fails (no open)
      const ws1 = MockWebSocket.lastInstance!
      act(() => {
        ws1.simulateClose(1006, "Connection failed")
      })

      // Reconnect after 1000ms
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      // Second connection fails (no open) - backoff should be 2000ms
      const ws2 = MockWebSocket.lastInstance!
      act(() => {
        ws2.simulateClose(1006, "Connection failed")
      })

      // Reconnect after 2000ms
      act(() => {
        vi.advanceTimersByTime(2000)
      })

      // Third connection succeeds (opens) - this resets backoff
      const ws3 = MockWebSocket.lastInstance!
      act(() => {
        ws3.simulateOpen()
      })

      // Now close - backoff should be reset to 1000ms
      const instancesBefore = MockWebSocket.instances.length
      act(() => {
        ws3.simulateClose(1006, "Abnormal closure")
      })

      // Should reconnect after initial delay (1000ms), not exponential
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(MockWebSocket.instances.length).toBe(instancesBefore + 1)
    })

    it("does not reconnect after intentional close", () => {
      const { unmount } = renderHook(() => useTaskMutations())

      act(() => {
        vi.advanceTimersByTime(0)
      })

      const ws = MockWebSocket.lastInstance!
      act(() => {
        ws.simulateOpen()
      })

      const instanceCount = MockWebSocket.instances.length
      unmount()

      // Wait for any reconnect attempts
      act(() => {
        vi.advanceTimersByTime(60000)
      })

      // Should not have created new connections
      expect(MockWebSocket.instances.length).toBe(instanceCount)
    })
  })

  describe("disabled state", () => {
    it("does not connect when disabled", () => {
      renderHook(() => useTaskMutations({ enabled: false }))

      act(() => {
        vi.advanceTimersByTime(0)
      })

      expect(MockWebSocket.instances).toHaveLength(0)
    })

    it("disconnects when disabled after being enabled", () => {
      const { rerender } = renderHook(({ enabled }) => useTaskMutations({ enabled }), {
        initialProps: { enabled: true },
      })

      act(() => {
        vi.advanceTimersByTime(0)
      })

      const ws = MockWebSocket.lastInstance!
      act(() => {
        ws.simulateOpen()
      })

      expect(MockWebSocket.instances).toHaveLength(1)

      rerender({ enabled: false })

      expect(ws.close).toHaveBeenCalled()
    })

    it("connects when enabled after being disabled", () => {
      const { rerender } = renderHook(({ enabled }) => useTaskMutations({ enabled }), {
        initialProps: { enabled: false },
      })

      act(() => {
        vi.advanceTimersByTime(0)
      })

      expect(MockWebSocket.instances).toHaveLength(0)

      rerender({ enabled: true })

      act(() => {
        vi.advanceTimersByTime(0)
      })

      expect(MockWebSocket.instances).toHaveLength(1)
    })
  })

  describe("StrictMode safety", () => {
    it("uses setTimeout(fn, 0) for connection to prevent double connection in StrictMode", () => {
      const setTimeoutSpy = vi.spyOn(global, "setTimeout")

      renderHook(() => useTaskMutations())

      // Should have called setTimeout with 0
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 0)

      // WebSocket should not be created until setTimeout fires
      expect(MockWebSocket.instances).toHaveLength(0)

      act(() => {
        vi.advanceTimersByTime(0)
      })

      expect(MockWebSocket.instances).toHaveLength(1)
    })

    it("cancels pending connection on quick unmount", () => {
      const { unmount } = renderHook(() => useTaskMutations())

      // Unmount before setTimeout fires
      unmount()

      act(() => {
        vi.advanceTimersByTime(0)
      })

      // Should not have created a connection
      expect(MockWebSocket.instances).toHaveLength(0)
    })
  })

  describe("workspace changes", () => {
    it("reconnects when workspace changes", () => {
      const { rerender } = renderHook(({ workspacePath }) => useTaskMutations({ workspacePath }), {
        initialProps: { workspacePath: "/workspace/a" },
      })

      act(() => {
        vi.advanceTimersByTime(0)
      })

      const ws1 = MockWebSocket.lastInstance!
      act(() => {
        ws1.simulateOpen()
      })

      expect(ws1.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "ws:subscribe_workspace",
          workspace: "/workspace/a",
        }),
      )

      rerender({ workspacePath: "/workspace/b" })

      act(() => {
        vi.advanceTimersByTime(0)
      })

      // Should have closed old connection and opened new one
      expect(ws1.close).toHaveBeenCalled()
      expect(MockWebSocket.instances.length).toBeGreaterThan(1)

      const ws2 = MockWebSocket.lastInstance!
      act(() => {
        ws2.simulateOpen()
      })

      expect(ws2.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "ws:subscribe_workspace",
          workspace: "/workspace/b",
        }),
      )
    })
  })
})
