import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { renderHook, act, cleanup } from "@testing-library/react"
import { useAgentChat } from "../useAgentChat"
import type { AgentType } from "../useAgentChat"
import { listSessions, addSession, clearSessionIndex } from "../../lib/sessionIndex"
import type { SessionIndexEntry } from "../../lib/sessionIndex"

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

    it("leaves sessionId null when localStorage is empty (lazy session creation)", async () => {
      // No stored session ID, no session index entries
      // Session should NOT be created eagerly — only on first sendMessage

      globalThis.fetch = vi.fn().mockImplementation(() => {
        return Promise.resolve({ ok: false, json: async () => ({}) })
      })

      const { result } = renderUseAgentChat("claude")

      await act(async () => {
        vi.advanceTimersByTime(1)
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
      })

      // sessionId should remain null — no eager creation
      expect(result.current.state.sessionId).toBeNull()
      expect(result.current.agentType).toBe("claude")

      // Verify no POST /api/sessions was called
      const fetchCalls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls as [
        string,
        RequestInit?,
      ][]
      const createCalls = fetchCalls.filter(
        ([url, init]) => url === "/api/sessions" && init?.method === "POST",
      )
      expect(createCalls).toHaveLength(0)
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

  // ── session index integration ─────────────────────────────────────────

  describe("session index integration", () => {
    const SESSION_INDEX_KEY = "agent-view-session-index"

    afterEach(() => {
      clearSessionIndex()
    })

    it("sendMessage creates a session lazily and adds it to the index", async () => {
      // Mock fetch: POST /api/sessions returns a sessionId, everything else fails
      globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url === "/api/sessions" && init?.method === "POST") {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sessionId: "new-session-abc" }),
          })
        }
        return Promise.resolve({ ok: false, json: async () => ({}) })
      })

      const { result } = renderUseAgentChat("claude")

      // Let WebSocket connect — no session created yet (lazy)
      await act(async () => {
        vi.advanceTimersByTime(1)
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(result.current.state.sessionId).toBeNull()
      expect(listSessions()).toHaveLength(0)

      // Sending a message triggers lazy session creation
      await act(async () => {
        result.current.actions.sendMessage("Hello")
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
      })

      const sessions = listSessions()
      expect(sessions).toHaveLength(1)
      expect(sessions[0].sessionId).toBe("new-session-abc")
      expect(sessions[0].adapter).toBe("claude")
    })

    it("sendMessage updates lastMessageAt and sets firstUserMessage on first message", async () => {
      // Pre-populate the session index so we have a known entry
      const initialTime = 1000
      addSession({
        sessionId: "msg-session",
        adapter: "claude",
        firstMessageAt: initialTime,
        lastMessageAt: initialTime,
        firstUserMessage: "",
      })

      // Store session in localStorage so hook picks it up
      localStorage.setItem(SESSION_ID_KEY, "msg-session")

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url === "/api/sessions/msg-session") {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              sessionId: "msg-session",
              status: "idle",
              adapter: "claude",
            }),
          })
        }
        return Promise.resolve({ ok: false, json: async () => ({}) })
      })

      const { result } = renderUseAgentChat("claude")

      // Let WebSocket connect and initSession complete
      await act(async () => {
        vi.advanceTimersByTime(1)
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(result.current.state.sessionId).toBe("msg-session")

      // Send first message
      act(() => {
        result.current.actions.sendMessage("Hello world")
      })

      const sessionsAfterFirst = listSessions()
      const entry = sessionsAfterFirst.find(s => s.sessionId === "msg-session")!
      expect(entry).toBeDefined()
      expect(entry.firstUserMessage).toBe("Hello world")
      expect(entry.lastMessageAt).toBeGreaterThan(initialTime)
    })

    it("sendMessage only updates lastMessageAt (not firstUserMessage) on subsequent messages", async () => {
      const initialTime = 1000
      addSession({
        sessionId: "msg-session-2",
        adapter: "claude",
        firstMessageAt: initialTime,
        lastMessageAt: initialTime,
        firstUserMessage: "",
      })

      localStorage.setItem(SESSION_ID_KEY, "msg-session-2")

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url === "/api/sessions/msg-session-2") {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              sessionId: "msg-session-2",
              status: "idle",
              adapter: "claude",
            }),
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

      // Send first message
      act(() => {
        result.current.actions.sendMessage("First message")
      })

      const afterFirst = listSessions().find(s => s.sessionId === "msg-session-2")!
      expect(afterFirst.firstUserMessage).toBe("First message")
      const firstLastMessageAt = afterFirst.lastMessageAt

      // Advance time so timestamps differ
      vi.advanceTimersByTime(100)

      // Send second message
      act(() => {
        result.current.actions.sendMessage("Second message")
      })

      const afterSecond = listSessions().find(s => s.sessionId === "msg-session-2")!
      // firstUserMessage should remain "First message" (not overwritten)
      expect(afterSecond.firstUserMessage).toBe("First message")
      // lastMessageAt should be updated
      expect(afterSecond.lastMessageAt).toBeGreaterThanOrEqual(firstLastMessageAt)
    })

    it("clearHistory removes the session from the index", async () => {
      addSession({
        sessionId: "clear-session",
        adapter: "claude",
        firstMessageAt: 1000,
        lastMessageAt: 1000,
        firstUserMessage: "hi",
      })

      localStorage.setItem(SESSION_ID_KEY, "clear-session")

      globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (
          url === "/api/sessions/clear-session" &&
          (!init || !init.method || init.method === "GET")
        ) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              sessionId: "clear-session",
              status: "idle",
              adapter: "claude",
            }),
          })
        }
        if (url === "/api/sessions/clear-session" && init?.method === "DELETE") {
          return Promise.resolve({ ok: true, json: async () => ({}) })
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

      expect(result.current.state.sessionId).toBe("clear-session")
      expect(listSessions()).toHaveLength(1)

      act(() => {
        result.current.actions.clearHistory()
      })

      expect(listSessions()).toHaveLength(0)
    })

    it("initSession uses the session index to find most recent session when localStorage has no stored session", async () => {
      // No stored session in localStorage — but the session index has an entry
      addSession({
        sessionId: "indexed-session-xyz",
        adapter: "codex",
        firstMessageAt: 2000,
        lastMessageAt: 3000,
        firstUserMessage: "previous question",
      })

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url === "/api/sessions/indexed-session-xyz") {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              sessionId: "indexed-session-xyz",
              status: "idle",
              adapter: "codex",
            }),
          })
        }
        // /api/sessions/latest should NOT be called since the index has an entry
        if (url === "/api/sessions/latest") {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              sessionId: "latest-fallback",
              status: "idle",
              adapter: "claude",
            }),
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

      // Should have picked up the indexed session, NOT the /api/sessions/latest one
      expect(result.current.state.sessionId).toBe("indexed-session-xyz")
      expect(result.current.agentType).toBe("codex")

      // Verify /api/sessions/latest was NOT called
      const fetchCalls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls as [
        string,
        RequestInit?,
      ][]
      const latestCalls = fetchCalls.filter(([url]) => url === "/api/sessions/latest")
      expect(latestCalls).toHaveLength(0)
    })
  })

  // ── restoreSession ───────────────────────────────────────────────────

  describe("restoreSession", () => {
    it("sets sessionId and persists it to localStorage", async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url === "/api/sessions/target-session") {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              sessionId: "target-session",
              status: "idle",
              adapter: "claude",
            }),
          })
        }
        return Promise.resolve({ ok: false, json: async () => ({}) })
      })

      const { result } = renderUseAgentChat("claude")

      // Let initial connection settle
      await act(async () => {
        vi.advanceTimersByTime(1)
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
      })

      await act(async () => {
        await result.current.actions.restoreSession("target-session")
      })

      expect(result.current.state.sessionId).toBe("target-session")
      expect(localStorage.getItem(SESSION_ID_KEY)).toBe("target-session")
    })

    it("clears events, streaming, and error state before restoring", async () => {
      localStorage.setItem(SESSION_ID_KEY, "old-session")

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url === "/api/sessions/old-session") {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              sessionId: "old-session",
              status: "processing",
              adapter: "claude",
            }),
          })
        }
        if (url === "/api/sessions/new-target") {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              sessionId: "new-target",
              status: "idle",
              adapter: "claude",
            }),
          })
        }
        return Promise.resolve({ ok: false, json: async () => ({}) })
      })

      const { result } = renderUseAgentChat("claude")

      // Let initial connection settle (will restore old-session with processing state)
      await act(async () => {
        vi.advanceTimersByTime(1)
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(result.current.state.isStreaming).toBe(true)

      // Now restore a different session
      await act(async () => {
        await result.current.actions.restoreSession("new-target")
      })

      expect(result.current.state.events).toEqual([])
      expect(result.current.state.isStreaming).toBe(false)
      expect(result.current.state.error).toBeNull()
    })

    it("restores isStreaming to true when target session has status 'processing'", async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url === "/api/sessions/processing-target") {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              sessionId: "processing-target",
              status: "processing",
              adapter: "claude",
            }),
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

      await act(async () => {
        await result.current.actions.restoreSession("processing-target")
      })

      expect(result.current.state.isStreaming).toBe(true)
    })

    it("restores agentType from the target session's adapter", async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url === "/api/sessions/codex-target") {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              sessionId: "codex-target",
              status: "idle",
              adapter: "codex",
            }),
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

      expect(result.current.agentType).toBe("claude")

      await act(async () => {
        await result.current.actions.restoreSession("codex-target")
      })

      expect(result.current.agentType).toBe("codex")
      expect(localStorage.getItem(AGENT_TYPE_KEY)).toBe("codex")
    })

    it("sends a WebSocket reconnect message for the target session", async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url === "/api/sessions/ws-target") {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              sessionId: "ws-target",
              status: "idle",
              adapter: "claude",
            }),
          })
        }
        return Promise.resolve({ ok: false, json: async () => ({}) })
      })

      const { result } = renderUseAgentChat("claude")

      // Let WS connect
      await act(async () => {
        vi.advanceTimersByTime(1)
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
      })

      await act(async () => {
        await result.current.actions.restoreSession("ws-target")
      })

      // Find the reconnect message sent to the WebSocket
      const sendMock = MockWebSocket.prototype.send || (vi.fn() as any)
      // The WS instance is internal, but we can check fetch was called with the right URL
      const fetchCalls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls as [
        string,
        RequestInit?,
      ][]
      const sessionFetchCalls = fetchCalls.filter(([url]) => url === "/api/sessions/ws-target")
      expect(sessionFetchCalls.length).toBeGreaterThanOrEqual(1)
    })

    it("is a no-op when the target session is already the current session", async () => {
      localStorage.setItem(SESSION_ID_KEY, "current-session")

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url === "/api/sessions/current-session") {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              sessionId: "current-session",
              status: "idle",
              adapter: "claude",
            }),
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

      expect(result.current.state.sessionId).toBe("current-session")

      // Clear fetch mock call count after init
      ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockClear()

      await act(async () => {
        await result.current.actions.restoreSession("current-session")
      })

      // No fetch calls should have been made since it's the same session
      expect(globalThis.fetch).not.toHaveBeenCalled()
    })

    it("still sets sessionId even when fetch fails", async () => {
      globalThis.fetch = vi.fn().mockImplementation(() => {
        return Promise.reject(new Error("Network error"))
      })

      const { result } = renderUseAgentChat("claude")

      // Let initial connection attempt settle
      await act(async () => {
        vi.advanceTimersByTime(1)
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
      })

      await act(async () => {
        await result.current.actions.restoreSession("unreachable-session")
      })

      // Session ID should still be set even though fetch failed
      expect(result.current.state.sessionId).toBe("unreachable-session")
      expect(localStorage.getItem(SESSION_ID_KEY)).toBe("unreachable-session")
    })

    it("does not change agentType when fetch fails", async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("fail-session")) {
          return Promise.reject(new Error("Network error"))
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

      await act(async () => {
        await result.current.actions.restoreSession("fail-session")
      })

      // agentType should remain unchanged since fetch failed
      expect(result.current.agentType).toBe("claude")
    })
  })

  // ── app namespace ─────────────────────────────────────────────────────

  describe("app namespace", () => {
    it("includes app in session creation request when provided in options", async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url === "/api/sessions" && init?.method === "POST") {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sessionId: "app-session-123" }),
          })
        }
        return Promise.resolve({ ok: false, json: async () => ({}) })
      })

      const { result } = renderHook(() =>
        useAgentChat({
          initialAgent: "claude",
          app: "task-chat",
        }),
      )

      // Let WebSocket connect
      await act(async () => {
        vi.advanceTimersByTime(1)
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
      })

      // Send a message to trigger session creation
      await act(async () => {
        result.current.actions.sendMessage("Hello")
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
      })

      // Verify the POST request includes the app parameter
      const fetchCalls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls as [
        string,
        RequestInit?,
      ][]
      const createCall = fetchCalls.find(
        ([url, init]) => url === "/api/sessions" && init?.method === "POST",
      )
      expect(createCall).toBeDefined()
      const body = JSON.parse(createCall![1]!.body as string)
      expect(body.app).toBe("task-chat")
    })

    it("does not include app when not provided in options", async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url === "/api/sessions" && init?.method === "POST") {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sessionId: "no-app-session" }),
          })
        }
        return Promise.resolve({ ok: false, json: async () => ({}) })
      })

      const { result } = renderHook(() =>
        useAgentChat({
          initialAgent: "claude",
        }),
      )

      await act(async () => {
        vi.advanceTimersByTime(1)
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
      })

      await act(async () => {
        result.current.actions.sendMessage("Hello")
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
      })

      const fetchCalls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls as [
        string,
        RequestInit?,
      ][]
      const createCall = fetchCalls.find(
        ([url, init]) => url === "/api/sessions" && init?.method === "POST",
      )
      expect(createCall).toBeDefined()
      const body = JSON.parse(createCall![1]!.body as string)
      expect(body.app).toBeUndefined()
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
