import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { renderHook, act, cleanup } from "@testing-library/react"
import { useAgentChat } from "../useAgentChat"
import type { AgentType } from "../useAgentChat"

// ── Mocks ──────────────────────────────────────────────────────────────────

// Minimal WebSocket stub so the hook can mount without real connections
class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readyState = MockWebSocket.OPEN
  onopen: ((ev: Event) => void) | null = null
  onclose: ((ev: CloseEvent) => void) | null = null
  onmessage: ((ev: MessageEvent) => void) | null = null
  onerror: ((ev: Event) => void) | null = null

  constructor(_url: string) {
    // Simulate async open so tests can control timing
    setTimeout(() => this.onopen?.(new Event("open")), 0)
  }

  send = vi.fn()
  close = vi.fn()
}

// Stub fetch so initSession doesn't make real requests
function stubFetch() {
  return vi.fn().mockResolvedValue({
    ok: false,
    json: async () => ({}),
  })
}

// ── Helpers ────────────────────────────────────────────────────────────────

const SESSION_ID_KEY = "agent-chat-session-id"
const AGENT_TYPE_KEY = "agent-chat-agent-type"

function renderUseAgentChat(initialAgent?: AgentType) {
  return renderHook(() => useAgentChat(initialAgent))
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("useAgentChat localStorage persistence", () => {
  let originalWebSocket: typeof globalThis.WebSocket

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()

    // Mock WebSocket globally
    originalWebSocket = globalThis.WebSocket
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket

    // Mock fetch
    globalThis.fetch = stubFetch()

    // Use fake timers so setTimeout in MockWebSocket and reconnect timers
    // don't interfere with tests
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    globalThis.WebSocket = originalWebSocket
    vi.restoreAllMocks()
    vi.useRealTimers()
    localStorage.clear()
  })

  // ── agentType initialization ──────────────────────────────────────────

  describe("agentType initialization", () => {
    it("defaults to initialAgent param when localStorage is empty", () => {
      const { result } = renderUseAgentChat("codex")
      expect(result.current.agentType).toBe("codex")
    })

    it("defaults to 'claude' when no initialAgent and localStorage is empty", () => {
      const { result } = renderUseAgentChat()
      expect(result.current.agentType).toBe("claude")
    })

    it("initializes from localStorage when a valid value is stored", () => {
      localStorage.setItem(AGENT_TYPE_KEY, "codex")
      const { result } = renderUseAgentChat("claude")
      // localStorage value takes precedence over the initialAgent param
      expect(result.current.agentType).toBe("codex")
    })

    it("falls back to initialAgent when localStorage has an invalid value", () => {
      localStorage.setItem(AGENT_TYPE_KEY, "invalid-agent")
      const { result } = renderUseAgentChat("codex")
      expect(result.current.agentType).toBe("codex")
    })
  })

  // ── sessionId initialization ──────────────────────────────────────────

  describe("sessionId initialization", () => {
    it("initializes as null when localStorage is empty", () => {
      const { result } = renderUseAgentChat()
      expect(result.current.state.sessionId).toBeNull()
    })

    it("initializes from localStorage when a sessionId is stored", () => {
      localStorage.setItem(SESSION_ID_KEY, "stored-session-123")
      const { result } = renderUseAgentChat()
      expect(result.current.state.sessionId).toBe("stored-session-123")
    })
  })

  // ── setAgentType saves to localStorage ────────────────────────────────

  describe("setAgentType", () => {
    it("saves the new agent type to localStorage", () => {
      const { result } = renderUseAgentChat("claude")

      act(() => {
        result.current.actions.setAgentType("codex")
      })

      expect(result.current.agentType).toBe("codex")
      expect(localStorage.getItem(AGENT_TYPE_KEY)).toBe("codex")
    })

    it("overwrites the previous value in localStorage", () => {
      localStorage.setItem(AGENT_TYPE_KEY, "codex")
      const { result } = renderUseAgentChat()

      act(() => {
        result.current.actions.setAgentType("claude")
      })

      expect(localStorage.getItem(AGENT_TYPE_KEY)).toBe("claude")
    })
  })

  // ── clearHistory removes sessionId from localStorage ──────────────────

  describe("clearHistory", () => {
    it("removes sessionId from localStorage", () => {
      localStorage.setItem(SESSION_ID_KEY, "session-to-clear")
      const { result } = renderUseAgentChat()

      // Verify it was loaded
      expect(result.current.state.sessionId).toBe("session-to-clear")

      act(() => {
        result.current.actions.clearHistory()
      })

      expect(result.current.state.sessionId).toBeNull()
      expect(localStorage.getItem(SESSION_ID_KEY)).toBeNull()
    })

    it("handles clearHistory when no sessionId is stored", () => {
      const { result } = renderUseAgentChat()

      act(() => {
        result.current.actions.clearHistory()
      })

      expect(result.current.state.sessionId).toBeNull()
      expect(localStorage.getItem(SESSION_ID_KEY)).toBeNull()
    })
  })

  // ── newSession removes sessionId from localStorage ────────────────────

  describe("newSession", () => {
    it("removes sessionId from localStorage", () => {
      localStorage.setItem(SESSION_ID_KEY, "old-session")
      const { result } = renderUseAgentChat()

      expect(result.current.state.sessionId).toBe("old-session")

      act(() => {
        result.current.actions.newSession()
      })

      expect(result.current.state.sessionId).toBeNull()
      expect(localStorage.getItem(SESSION_ID_KEY)).toBeNull()
    })

    it("handles newSession when no sessionId exists", () => {
      const { result } = renderUseAgentChat()

      act(() => {
        result.current.actions.newSession()
      })

      expect(result.current.state.sessionId).toBeNull()
      expect(localStorage.getItem(SESSION_ID_KEY)).toBeNull()
    })
  })

  // ── initSession restores streaming state and agent type ──────────────

  describe("initSession restores session state on reconnect", () => {
    it("sets isStreaming to true when stored session has status 'processing'", async () => {
      localStorage.setItem(SESSION_ID_KEY, "processing-session")

      // Mock fetch to return session info with status: "processing"
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url === "/api/sessions/processing-session") {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              sessionId: "processing-session",
              status: "processing",
              adapter: "claude",
            }),
          })
        }
        return Promise.resolve({ ok: false, json: async () => ({}) })
      })

      const { result } = renderUseAgentChat()

      // Trigger the WebSocket onopen (setTimeout 0) which calls initSession
      // Use advanceTimersByTime(1) + flush microtasks to avoid infinite timer loop
      await act(async () => {
        vi.advanceTimersByTime(1)
        // Flush the promise chain from fetch
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(result.current.state.isStreaming).toBe(true)
      expect(result.current.state.sessionId).toBe("processing-session")
    })

    it("restores agentType to 'codex' when stored session has adapter 'codex'", async () => {
      localStorage.setItem(SESSION_ID_KEY, "codex-session")

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url === "/api/sessions/codex-session") {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              sessionId: "codex-session",
              status: "idle",
              adapter: "codex",
            }),
          })
        }
        return Promise.resolve({ ok: false, json: async () => ({}) })
      })

      // Start with claude as default
      const { result } = renderUseAgentChat("claude")

      await act(async () => {
        vi.advanceTimersByTime(1)
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(result.current.agentType).toBe("codex")
      expect(localStorage.getItem(AGENT_TYPE_KEY)).toBe("codex")
    })

    it("restores both isStreaming and agentType from /api/sessions/latest fallback", async () => {
      // No stored session ID — forces fallback to /api/sessions/latest

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url === "/api/sessions/latest") {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              sessionId: "latest-session",
              status: "processing",
              adapter: "codex",
            }),
          })
        }
        // createSession fallback — should not be reached
        if (url === "/api/sessions") {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sessionId: "new-session" }),
          })
        }
        return Promise.resolve({ ok: false, json: async () => ({}) })
      })

      const { result } = renderUseAgentChat("claude")

      await act(async () => {
        vi.advanceTimersByTime(1)
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(result.current.state.isStreaming).toBe(true)
      expect(result.current.agentType).toBe("codex")
      expect(result.current.state.sessionId).toBe("latest-session")
    })

    it("does not set isStreaming when session status is not 'processing'", async () => {
      localStorage.setItem(SESSION_ID_KEY, "idle-session")

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url === "/api/sessions/idle-session") {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              sessionId: "idle-session",
              status: "idle",
              adapter: "claude",
            }),
          })
        }
        return Promise.resolve({ ok: false, json: async () => ({}) })
      })

      const { result } = renderUseAgentChat()

      await act(async () => {
        vi.advanceTimersByTime(1)
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(result.current.state.isStreaming).toBe(false)
    })
  })

  // ── localStorage error resilience ─────────────────────────────────────

  describe("localStorage error resilience", () => {
    it("falls back gracefully when localStorage.getItem throws", () => {
      const getItemSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("localStorage disabled")
      })

      // Should not throw, should fall back to defaults
      const { result } = renderUseAgentChat("codex")
      expect(result.current.agentType).toBe("codex")
      expect(result.current.state.sessionId).toBeNull()

      getItemSpy.mockRestore()
    })

    it("does not throw when localStorage.setItem throws on setAgentType", () => {
      const { result } = renderUseAgentChat()

      const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("QuotaExceededError")
      })

      // Should not throw
      act(() => {
        result.current.actions.setAgentType("codex")
      })

      expect(result.current.agentType).toBe("codex")

      setItemSpy.mockRestore()
    })

    it("does not throw when localStorage.removeItem throws on clearHistory", () => {
      localStorage.setItem(SESSION_ID_KEY, "some-session")
      const { result } = renderUseAgentChat()

      const removeItemSpy = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
        throw new Error("localStorage disabled")
      })

      // Should not throw
      act(() => {
        result.current.actions.clearHistory()
      })

      expect(result.current.state.sessionId).toBeNull()

      removeItemSpy.mockRestore()
    })
  })
})
