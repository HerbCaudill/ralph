import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useRalphConnection } from "./useRalphConnection"
import { useAppStore } from "../store"
import { ralphConnection } from "../lib/ralphConnection"

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

  ping(): void {
    // No-op for mock
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

  simulateClose(code = 1000, reason = ""): void {
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) {
      this.onclose(new CloseEvent("close", { code, reason }))
    }
  }
}

// Install mock using window (DOM environment)
const originalWebSocket = window.WebSocket

// Helper to get the current WebSocket instance
function getWs(): MockWebSocket | undefined {
  return MockWebSocket.instances[MockWebSocket.instances.length - 1]
}

beforeEach(() => {
  MockWebSocket.instances = []
  window.WebSocket = MockWebSocket as unknown as typeof WebSocket
  vi.useFakeTimers()
  // Reset store and singleton
  useAppStore.getState().reset()
  ralphConnection.reset()
})

afterEach(() => {
  window.WebSocket = originalWebSocket
  vi.useRealTimers()
})

describe("useRalphConnection", () => {
  describe("connection", () => {
    it("connects automatically on first use", () => {
      renderHook(() => useRalphConnection())

      expect(MockWebSocket.instances.length).toBeGreaterThan(0)
    })

    it("initializes only once across multiple hook instances", () => {
      renderHook(() => useRalphConnection())
      const countAfterFirst = MockWebSocket.instances.length

      renderHook(() => useRalphConnection())
      const countAfterSecond = MockWebSocket.instances.length

      // Should not create additional connections
      expect(countAfterSecond).toBe(countAfterFirst)
    })
  })

  describe("store integration", () => {
    it("reads connection status from store", () => {
      const { result } = renderHook(() => useRalphConnection())

      // Set store directly
      act(() => {
        useAppStore.getState().setConnectionStatus("connected")
      })

      expect(result.current.status).toBe("connected")
      expect(result.current.isConnected).toBe(true)
    })

    it("reflects disconnected status from store", () => {
      const { result } = renderHook(() => useRalphConnection())

      act(() => {
        useAppStore.getState().setConnectionStatus("disconnected")
      })

      expect(result.current.status).toBe("disconnected")
      expect(result.current.isConnected).toBe(false)
    })
  })

  describe("sendMessage", () => {
    it("sends chat_message via WebSocket when connected", () => {
      const { result } = renderHook(() => useRalphConnection())

      // Simulate connection
      act(() => {
        getWs()?.simulateOpen()
      })

      act(() => {
        result.current.sendMessage("Hello, ralph!")
      })

      expect(getWs()?.sentMessages).toContainEqual(
        JSON.stringify({ type: "chat_message", message: "Hello, ralph!" }),
      )
    })

    it("does not send when not connected", () => {
      const { result } = renderHook(() => useRalphConnection())

      // Don't simulate open - still connecting
      act(() => {
        result.current.sendMessage("Hello!")
      })

      expect(getWs()?.sentMessages ?? []).toEqual([])
    })
  })

  describe("message handling", () => {
    it("handles ralph:event messages", () => {
      renderHook(() => useRalphConnection())

      act(() => {
        getWs()?.simulateOpen()
      })

      const event = { type: "tool_use", timestamp: 1234, tool: "read" }

      act(() => {
        getWs()?.simulateMessage({ type: "ralph:event", event })
      })

      expect(useAppStore.getState().events).toContainEqual(event)
    })

    it("handles ralph:status messages", () => {
      renderHook(() => useRalphConnection())

      act(() => {
        getWs()?.simulateOpen()
      })

      act(() => {
        getWs()?.simulateMessage({ type: "ralph:status", status: "running" })
      })

      expect(useAppStore.getState().ralphStatus).toBe("running")
    })

    it("handles connected message with ralph status", () => {
      renderHook(() => useRalphConnection())

      act(() => {
        getWs()?.simulateOpen()
      })

      act(() => {
        getWs()?.simulateMessage({ type: "connected", ralphStatus: "running", timestamp: 1234 })
      })

      expect(useAppStore.getState().ralphStatus).toBe("running")
    })

    it("handles ralph:output messages", () => {
      renderHook(() => useRalphConnection())

      act(() => {
        getWs()?.simulateOpen()
      })

      act(() => {
        getWs()?.simulateMessage({
          type: "ralph:output",
          line: "Some output",
          timestamp: 1234,
        })
      })

      expect(useAppStore.getState().events).toContainEqual(
        expect.objectContaining({ type: "output", line: "Some output" }),
      )
    })

    it("handles ralph:error messages", () => {
      renderHook(() => useRalphConnection())

      act(() => {
        getWs()?.simulateOpen()
      })

      act(() => {
        getWs()?.simulateMessage({
          type: "ralph:error",
          error: "Something went wrong",
          timestamp: 1234,
        })
      })

      expect(useAppStore.getState().events).toContainEqual(
        expect.objectContaining({ type: "error", error: "Something went wrong" }),
      )
    })

    it("handles ralph:exit messages", () => {
      renderHook(() => useRalphConnection())

      act(() => {
        getWs()?.simulateOpen()
      })

      act(() => {
        getWs()?.simulateMessage({
          type: "ralph:exit",
          code: 0,
          signal: null,
          timestamp: 1234,
        })
      })

      expect(useAppStore.getState().events).toContainEqual(
        expect.objectContaining({ type: "exit", code: 0, signal: null }),
      )
    })

    it("handles user_message messages", () => {
      renderHook(() => useRalphConnection())

      act(() => {
        getWs()?.simulateOpen()
      })

      act(() => {
        getWs()?.simulateMessage({
          type: "user_message",
          message: "Hello!",
          timestamp: 1234,
        })
      })

      expect(useAppStore.getState().events).toContainEqual(
        expect.objectContaining({ type: "user_message", message: "Hello!" }),
      )
    })

    it("handles server error messages", () => {
      renderHook(() => useRalphConnection())

      act(() => {
        getWs()?.simulateOpen()
      })

      act(() => {
        getWs()?.simulateMessage({
          type: "error",
          error: "Ralph is not running",
          timestamp: 1234,
        })
      })

      expect(useAppStore.getState().events).toContainEqual(
        expect.objectContaining({ type: "server_error", error: "Ralph is not running" }),
      )
    })

    it("updates status to running when ralph:event is received while stopped", () => {
      renderHook(() => useRalphConnection())

      act(() => {
        getWs()?.simulateOpen()
      })

      // Ensure status is stopped initially
      expect(useAppStore.getState().ralphStatus).toBe("stopped")

      const event = { type: "tool_use", timestamp: 1234, tool: "read" }

      act(() => {
        getWs()?.simulateMessage({ type: "ralph:event", event })
      })

      // Status should be updated to running since we received an event
      expect(useAppStore.getState().ralphStatus).toBe("running")
    })

    it("updates status to running when ralph:output is received while stopped", () => {
      renderHook(() => useRalphConnection())

      act(() => {
        getWs()?.simulateOpen()
      })

      // Ensure status is stopped initially
      expect(useAppStore.getState().ralphStatus).toBe("stopped")

      act(() => {
        getWs()?.simulateMessage({
          type: "ralph:output",
          line: "Some output",
          timestamp: 1234,
        })
      })

      // Status should be updated to running since we received output
      expect(useAppStore.getState().ralphStatus).toBe("running")
    })

    it("does not change status when ralph:event is received while already running", () => {
      renderHook(() => useRalphConnection())

      act(() => {
        getWs()?.simulateOpen()
        useAppStore.getState().setRalphStatus("running")
      })

      const event = { type: "tool_use", timestamp: 1234, tool: "read" }

      act(() => {
        getWs()?.simulateMessage({ type: "ralph:event", event })
      })

      // Status should remain running
      expect(useAppStore.getState().ralphStatus).toBe("running")
    })

    it("does not change status when ralph:event is received while starting", () => {
      renderHook(() => useRalphConnection())

      act(() => {
        getWs()?.simulateOpen()
        useAppStore.getState().setRalphStatus("starting")
      })

      const event = { type: "tool_use", timestamp: 1234, tool: "read" }

      act(() => {
        getWs()?.simulateMessage({ type: "ralph:event", event })
      })

      // Status should remain starting (don't override transitional states)
      expect(useAppStore.getState().ralphStatus).toBe("starting")
    })

    it("extracts token usage from stream_event message_delta events", () => {
      renderHook(() => useRalphConnection())

      act(() => {
        getWs()?.simulateOpen()
      })

      // Initial token usage should be zero
      expect(useAppStore.getState().tokenUsage).toEqual({ input: 0, output: 0 })

      // Simulate a message_delta event with token usage (like from Claude API)
      const streamEvent = {
        type: "stream_event",
        timestamp: 1234,
        event: {
          type: "message_delta",
          delta: { stop_reason: "tool_use", stop_sequence: null },
          usage: {
            input_tokens: 100,
            cache_creation_input_tokens: 500,
            cache_read_input_tokens: 200,
            output_tokens: 50,
          },
        },
      }

      act(() => {
        getWs()?.simulateMessage({ type: "ralph:event", event: streamEvent })
      })

      // Should add up all input tokens (100 + 500 + 200 = 800)
      expect(useAppStore.getState().tokenUsage).toEqual({ input: 800, output: 50 })
    })

    it("accumulates token usage across multiple message_delta events", () => {
      renderHook(() => useRalphConnection())

      act(() => {
        getWs()?.simulateOpen()
      })

      // First message
      act(() => {
        getWs()?.simulateMessage({
          type: "ralph:event",
          event: {
            type: "stream_event",
            timestamp: 1234,
            event: {
              type: "message_delta",
              usage: { input_tokens: 100, output_tokens: 50 },
            },
          },
        })
      })

      // Second message
      act(() => {
        getWs()?.simulateMessage({
          type: "ralph:event",
          event: {
            type: "stream_event",
            timestamp: 1235,
            event: {
              type: "message_delta",
              usage: { input_tokens: 200, output_tokens: 100 },
            },
          },
        })
      })

      // Should accumulate: 100+200 = 300 input, 50+100 = 150 output
      expect(useAppStore.getState().tokenUsage).toEqual({ input: 300, output: 150 })
    })

    it("ignores stream events without usage data", () => {
      renderHook(() => useRalphConnection())

      act(() => {
        getWs()?.simulateOpen()
      })

      // Simulate a message_start event (no usage extraction)
      act(() => {
        getWs()?.simulateMessage({
          type: "ralph:event",
          event: {
            type: "stream_event",
            timestamp: 1234,
            event: {
              type: "message_start",
              message: { id: "msg_123" },
            },
          },
        })
      })

      // Token usage should remain zero
      expect(useAppStore.getState().tokenUsage).toEqual({ input: 0, output: 0 })
    })
  })

  describe("connect and disconnect", () => {
    it("provides connect function", () => {
      const { result } = renderHook(() => useRalphConnection())

      // Disconnect first
      act(() => {
        result.current.disconnect()
      })

      const countBefore = MockWebSocket.instances.length

      act(() => {
        result.current.connect()
      })

      // Should create a new connection
      expect(MockWebSocket.instances.length).toBe(countBefore + 1)
    })

    it("provides disconnect function", () => {
      const { result } = renderHook(() => useRalphConnection())

      act(() => {
        getWs()?.simulateOpen()
      })

      act(() => {
        result.current.disconnect()
      })

      expect(useAppStore.getState().connectionStatus).toBe("disconnected")
    })
  })
})
