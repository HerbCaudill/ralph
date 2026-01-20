import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useWebSocket } from "./useWebSocket"

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readyState = MockWebSocket.CONNECTING
  url: string

  onopen: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  // Track calls for testing
  static instances: MockWebSocket[] = []
  sentMessages: string[] = []

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }

  send(data: string): void {
    this.sentMessages.push(data)
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) {
      this.onclose(new CloseEvent("close"))
    }
  }

  // Test helpers
  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN
    if (this.onopen) {
      this.onopen(new Event("open"))
    }
  }

  simulateMessage(data: unknown): void {
    if (this.onmessage) {
      this.onmessage(new MessageEvent("message", { data: JSON.stringify(data) }))
    }
  }

  simulateRawMessage(data: string): void {
    if (this.onmessage) {
      this.onmessage(new MessageEvent("message", { data }))
    }
  }

  simulateError(): void {
    if (this.onerror) {
      this.onerror(new Event("error"))
    }
  }

  simulateClose(code = 1000, reason = ""): void {
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) {
      this.onclose(new CloseEvent("close", { code, reason }))
    }
  }
}

// Install mock using window (DOM environment)
const originalWebSocket = window.WebSocket

beforeEach(() => {
  MockWebSocket.instances = []
  window.WebSocket = MockWebSocket as unknown as typeof WebSocket
  vi.useFakeTimers()
})

afterEach(() => {
  window.WebSocket = originalWebSocket
  vi.useRealTimers()
})

describe("useWebSocket", () => {
  describe("connection", () => {
    it("auto-connects on mount by default", () => {
      const { result } = renderHook(() => useWebSocket({ url: "ws://localhost:3000/ws" }))

      expect(result.current.status).toBe("connecting")
      expect(MockWebSocket.instances).toHaveLength(1)
      expect(MockWebSocket.instances[0].url).toBe("ws://localhost:3000/ws")
    })

    it("does not auto-connect when autoConnect is false", () => {
      const { result } = renderHook(() =>
        useWebSocket({ url: "ws://localhost:3000/ws", autoConnect: false }),
      )

      expect(result.current.status).toBe("disconnected")
      expect(MockWebSocket.instances).toHaveLength(0)
    })

    it("transitions to connected when WebSocket opens", async () => {
      const onConnect = vi.fn()
      const { result } = renderHook(() =>
        useWebSocket({ url: "ws://localhost:3000/ws", onConnect }),
      )

      act(() => {
        MockWebSocket.instances[0].simulateOpen()
      })

      expect(result.current.status).toBe("connected")
      expect(result.current.isConnected).toBe(true)
      expect(onConnect).toHaveBeenCalledTimes(1)
    })

    it("transitions to disconnected when WebSocket closes", async () => {
      const onDisconnect = vi.fn()
      const { result } = renderHook(() =>
        useWebSocket({
          url: "ws://localhost:3000/ws",
          autoReconnect: false,
          onDisconnect,
        }),
      )

      act(() => {
        MockWebSocket.instances[0].simulateOpen()
      })

      act(() => {
        MockWebSocket.instances[0].simulateClose()
      })

      expect(result.current.status).toBe("disconnected")
      expect(result.current.isConnected).toBe(false)
      expect(onDisconnect).toHaveBeenCalledTimes(1)
    })
  })

  describe("auto-reconnect", () => {
    it("attempts to reconnect after disconnection", async () => {
      const { result } = renderHook(() =>
        useWebSocket({ url: "ws://localhost:3000/ws", reconnectDelay: 1000 }),
      )

      act(() => {
        MockWebSocket.instances[0].simulateOpen()
      })

      act(() => {
        MockWebSocket.instances[0].simulateClose()
      })

      expect(result.current.status).toBe("disconnected")
      expect(MockWebSocket.instances).toHaveLength(1)

      // Fast-forward reconnect delay
      await act(async () => {
        vi.advanceTimersByTime(1000)
      })

      expect(MockWebSocket.instances).toHaveLength(2)
      expect(result.current.status).toBe("connecting")
      expect(result.current.reconnectAttempts).toBe(1)
    })

    it("does not reconnect when autoReconnect is false", async () => {
      renderHook(() => useWebSocket({ url: "ws://localhost:3000/ws", autoReconnect: false }))

      act(() => {
        MockWebSocket.instances[0].simulateOpen()
      })

      act(() => {
        MockWebSocket.instances[0].simulateClose()
      })

      await act(async () => {
        vi.advanceTimersByTime(5000)
      })

      expect(MockWebSocket.instances).toHaveLength(1)
    })

    it("respects maxReconnectAttempts", async () => {
      const { result } = renderHook(() =>
        useWebSocket({
          url: "ws://localhost:3000/ws",
          reconnectDelay: 100,
          maxReconnectAttempts: 2,
        }),
      )

      act(() => {
        MockWebSocket.instances[0].simulateOpen()
      })

      // First disconnect
      act(() => {
        MockWebSocket.instances[0].simulateClose()
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })
      expect(result.current.reconnectAttempts).toBe(1)

      // Second disconnect
      act(() => {
        MockWebSocket.instances[1].simulateClose()
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })
      expect(result.current.reconnectAttempts).toBe(2)

      // Third disconnect - should not reconnect (maxReconnectAttempts reached)
      act(() => {
        MockWebSocket.instances[2].simulateClose()
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      // Should still be at 3 instances (no new reconnect)
      expect(MockWebSocket.instances).toHaveLength(3)
    })

    it("resets reconnect attempts on successful connection", async () => {
      const { result } = renderHook(() =>
        useWebSocket({ url: "ws://localhost:3000/ws", reconnectDelay: 100 }),
      )

      act(() => {
        MockWebSocket.instances[0].simulateOpen()
      })

      act(() => {
        MockWebSocket.instances[0].simulateClose()
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      expect(result.current.reconnectAttempts).toBe(1)

      // Successful reconnect
      act(() => {
        MockWebSocket.instances[1].simulateOpen()
      })

      expect(result.current.reconnectAttempts).toBe(0)
    })
  })

  describe("messaging", () => {
    it("receives and parses JSON messages", async () => {
      const onMessage = vi.fn()
      renderHook(() => useWebSocket({ url: "ws://localhost:3000/ws", onMessage }))

      act(() => {
        MockWebSocket.instances[0].simulateOpen()
      })

      act(() => {
        MockWebSocket.instances[0].simulateMessage({ type: "test", data: "hello" })
      })

      expect(onMessage).toHaveBeenCalledWith({ type: "test", data: "hello" })
    })

    it("handles non-JSON messages", async () => {
      const onMessage = vi.fn()
      renderHook(() => useWebSocket({ url: "ws://localhost:3000/ws", onMessage }))

      act(() => {
        MockWebSocket.instances[0].simulateOpen()
      })

      act(() => {
        MockWebSocket.instances[0].simulateRawMessage("plain text message")
      })

      expect(onMessage).toHaveBeenCalledWith("plain text message")
    })

    it("sends JSON-stringified messages", async () => {
      const { result } = renderHook(() => useWebSocket({ url: "ws://localhost:3000/ws" }))

      act(() => {
        MockWebSocket.instances[0].simulateOpen()
      })

      act(() => {
        result.current.send({ type: "ping" })
      })

      expect(MockWebSocket.instances[0].sentMessages).toEqual(['{"type":"ping"}'])
    })

    it("sends string messages as-is", async () => {
      const { result } = renderHook(() => useWebSocket({ url: "ws://localhost:3000/ws" }))

      act(() => {
        MockWebSocket.instances[0].simulateOpen()
      })

      act(() => {
        result.current.send("raw string")
      })

      expect(MockWebSocket.instances[0].sentMessages).toEqual(["raw string"])
    })

    it("does not send when not connected", async () => {
      const { result } = renderHook(() => useWebSocket({ url: "ws://localhost:3000/ws" }))

      // Still in connecting state
      act(() => {
        result.current.send({ type: "ping" })
      })

      expect(MockWebSocket.instances[0].sentMessages).toEqual([])
    })
  })

  describe("manual connect/disconnect", () => {
    it("manually connects when connect is called", async () => {
      const { result } = renderHook(() =>
        useWebSocket({ url: "ws://localhost:3000/ws", autoConnect: false }),
      )

      expect(MockWebSocket.instances).toHaveLength(0)

      act(() => {
        result.current.connect()
      })

      expect(MockWebSocket.instances).toHaveLength(1)
      expect(result.current.status).toBe("connecting")
    })

    it("manually disconnects when disconnect is called", async () => {
      const { result } = renderHook(() => useWebSocket({ url: "ws://localhost:3000/ws" }))

      act(() => {
        MockWebSocket.instances[0].simulateOpen()
      })

      expect(result.current.isConnected).toBe(true)

      act(() => {
        result.current.disconnect()
      })

      expect(result.current.status).toBe("disconnected")
    })

    it("does not auto-reconnect after manual disconnect", async () => {
      const { result } = renderHook(() =>
        useWebSocket({ url: "ws://localhost:3000/ws", reconnectDelay: 100 }),
      )

      act(() => {
        MockWebSocket.instances[0].simulateOpen()
      })

      act(() => {
        result.current.disconnect()
      })

      await act(async () => {
        vi.advanceTimersByTime(1000)
      })

      // Should still only have 1 instance (no reconnect)
      expect(MockWebSocket.instances).toHaveLength(1)
    })
  })

  describe("error handling", () => {
    it("calls onError callback when error occurs", async () => {
      const onError = vi.fn()
      renderHook(() =>
        useWebSocket({
          url: "ws://localhost:3000/ws",
          onError,
          autoReconnect: false,
        }),
      )

      act(() => {
        MockWebSocket.instances[0].simulateError()
      })

      expect(onError).toHaveBeenCalledTimes(1)
    })
  })

  describe("cleanup", () => {
    it("closes connection on unmount", () => {
      const { unmount } = renderHook(() => useWebSocket({ url: "ws://localhost:3000/ws" }))

      act(() => {
        MockWebSocket.instances[0].simulateOpen()
      })

      const ws = MockWebSocket.instances[0]
      unmount()

      expect(ws.readyState).toBe(MockWebSocket.CLOSED)
    })

    it("clears reconnect timeout on unmount", async () => {
      const { unmount } = renderHook(() =>
        useWebSocket({ url: "ws://localhost:3000/ws", reconnectDelay: 1000 }),
      )

      act(() => {
        MockWebSocket.instances[0].simulateOpen()
      })

      act(() => {
        MockWebSocket.instances[0].simulateClose()
      })

      // Unmount before reconnect timer fires
      unmount()

      await act(async () => {
        vi.advanceTimersByTime(2000)
      })

      // Should not have created a new connection
      expect(MockWebSocket.instances).toHaveLength(1)
    })
  })
})
