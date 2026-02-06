import { describe, it, expect, vi, beforeEach } from "vitest"

/**
 * Tests for the SharedWorker message handling, specifically workspace
 * subscription and unsubscription lifecycle.
 *
 * Since the worker runs in a SharedWorker context, we test the exported
 * handler functions directly by importing the module and exercising
 * handlePortMessage / removePort.
 */

// Mock WebSocket before importing the worker module
class MockWebSocket {
  static OPEN = 1
  static CONNECTING = 0
  static CLOSING = 2
  static CLOSED = 3

  readyState = MockWebSocket.CONNECTING
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  url: string

  constructor(url: string) {
    this.url = url
    // Simulate immediate open
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN
      this.onopen?.()
    }, 0)
  }

  send = vi.fn()

  close() {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.()
  }
}

// Mock self as SharedWorkerGlobalScope
const mockSelf = {
  onconnect: null as ((event: MessageEvent) => void) | null,
  location: {
    protocol: "http:",
    host: "localhost:5173",
  },
}

// Apply mocks to globalThis before importing the worker module
vi.stubGlobal("WebSocket", MockWebSocket)
vi.stubGlobal("self", mockSelf)

/** Create a mock MessagePort that tracks posted messages. */
function createMockPort(): MockPort {
  return {
    onmessage: null,
    onmessageerror: null,
    postMessage: vi.fn(),
    start: vi.fn(),
    close: vi.fn(),
  }
}

type MockPort = {
  onmessage: ((event: MessageEvent) => void) | null
  onmessageerror: ((event: MessageEvent) => void) | null
  postMessage: ReturnType<typeof vi.fn>
  start: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
}

describe("ralphWorker", () => {
  let handlePortMessage: (message: any, port: any) => void
  let removePort: (port: any) => void
  let getWorkspace: (workspaceId: string) => any
  let allPorts: Set<any>

  beforeEach(async () => {
    vi.resetModules()

    // Import the worker module fresh for each test
    const workerModule = await import("../ralphWorker")

    handlePortMessage = (workerModule as any).handlePortMessage
    removePort = (workerModule as any).removePort
    getWorkspace = (workerModule as any).getWorkspace
    allPorts = (workerModule as any).allPorts
  })

  describe("unsubscribe_workspace", () => {
    it("should remove the port from the workspace's subscribedPorts", () => {
      const port = createMockPort()
      const workspaceId = "herbcaudill/ralph"

      // Subscribe first
      handlePortMessage({ type: "subscribe_workspace", workspaceId }, port)
      const state = getWorkspace(workspaceId)
      expect(state.subscribedPorts.has(port)).toBe(true)

      // Unsubscribe
      handlePortMessage({ type: "unsubscribe_workspace", workspaceId }, port)
      expect(state.subscribedPorts.has(port)).toBe(false)
    })

    it("should disconnect workspace WebSocket when last subscriber leaves and workspace is idle", async () => {
      const port = createMockPort()
      const workspaceId = "herbcaudill/ralph"

      // Subscribe — this triggers a WebSocket connection
      handlePortMessage({ type: "subscribe_workspace", workspaceId }, port)
      const state = getWorkspace(workspaceId)

      // Wait for WebSocket to open
      await vi.waitFor(() => {
        expect(state.ws).not.toBeNull()
        expect(state.ws?.readyState).toBe(MockWebSocket.OPEN)
      })

      // Unsubscribe — should disconnect since no subscribers remain and state is idle
      handlePortMessage({ type: "unsubscribe_workspace", workspaceId }, port)

      expect(state.subscribedPorts.size).toBe(0)
      expect(state.ws).toBeNull()
    })

    it("should NOT disconnect workspace WebSocket when last subscriber leaves but workspace is running", async () => {
      const port = createMockPort()
      const workspaceId = "herbcaudill/ralph"

      // Subscribe
      handlePortMessage({ type: "subscribe_workspace", workspaceId }, port)
      const state = getWorkspace(workspaceId)

      // Wait for WebSocket to open
      await vi.waitFor(() => {
        expect(state.ws?.readyState).toBe(MockWebSocket.OPEN)
      })

      // Set state to running (simulating an active Ralph session)
      state.controlState = "running"

      // Unsubscribe — should NOT disconnect since Ralph is still running
      handlePortMessage({ type: "unsubscribe_workspace", workspaceId }, port)

      expect(state.subscribedPorts.size).toBe(0)
      expect(state.ws).not.toBeNull()
    })

    it("should keep WebSocket alive when other subscribers remain", async () => {
      const port1 = createMockPort()
      const port2 = createMockPort()
      const workspaceId = "herbcaudill/ralph"

      // Two ports subscribe
      handlePortMessage({ type: "subscribe_workspace", workspaceId }, port1)
      handlePortMessage({ type: "subscribe_workspace", workspaceId }, port2)
      const state = getWorkspace(workspaceId)

      // Wait for WebSocket to open
      await vi.waitFor(() => {
        expect(state.ws?.readyState).toBe(MockWebSocket.OPEN)
      })

      // One port unsubscribes — WebSocket stays alive
      handlePortMessage({ type: "unsubscribe_workspace", workspaceId }, port1)

      expect(state.subscribedPorts.size).toBe(1)
      expect(state.subscribedPorts.has(port2)).toBe(true)
      expect(state.ws).not.toBeNull()
    })

    it("should reset connection status for the unsubscribing port", () => {
      const port = createMockPort()
      const workspaceId = "herbcaudill/ralph"

      // Subscribe
      handlePortMessage({ type: "subscribe_workspace", workspaceId }, port)

      // Unsubscribe — should receive a disconnected event
      handlePortMessage({ type: "unsubscribe_workspace", workspaceId }, port)

      const lastCall = port.postMessage.mock.calls[port.postMessage.mock.calls.length - 1][0]
      expect(lastCall).toEqual({
        type: "disconnected",
        workspaceId,
      })
    })

    it("should be idempotent — unsubscribing when not subscribed is a no-op", () => {
      const port = createMockPort()
      const workspaceId = "herbcaudill/ralph"

      // Unsubscribe without ever subscribing
      handlePortMessage({ type: "unsubscribe_workspace", workspaceId }, port)

      // Should not throw, workspace state should be clean
      const state = getWorkspace(workspaceId)
      expect(state.subscribedPorts.size).toBe(0)
    })
  })

  describe("workspace switching (subscribe new, unsubscribe old)", () => {
    it("should allow a port to switch from one workspace to another", async () => {
      const port = createMockPort()
      const workspace1 = "herbcaudill/ralph"
      const workspace2 = "herbcaudill/other-repo"

      // Subscribe to workspace1
      handlePortMessage({ type: "subscribe_workspace", workspaceId: workspace1 }, port)
      const state1 = getWorkspace(workspace1)
      expect(state1.subscribedPorts.has(port)).toBe(true)

      // Wait for WebSocket to open
      await vi.waitFor(() => {
        expect(state1.ws?.readyState).toBe(MockWebSocket.OPEN)
      })

      // Unsubscribe from workspace1 and subscribe to workspace2
      handlePortMessage({ type: "unsubscribe_workspace", workspaceId: workspace1 }, port)
      handlePortMessage({ type: "subscribe_workspace", workspaceId: workspace2 }, port)

      const state2 = getWorkspace(workspace2)
      expect(state1.subscribedPorts.has(port)).toBe(false)
      expect(state2.subscribedPorts.has(port)).toBe(true)

      // workspace1 should be disconnected since no subscribers and idle
      expect(state1.ws).toBeNull()
    })
  })

  describe("restore_session", () => {
    it("should set currentSessionId without changing control state", () => {
      const port = createMockPort()
      const workspaceId = "herbcaudill/ralph"

      // Subscribe first
      handlePortMessage({ type: "subscribe_workspace", workspaceId }, port)

      // Restore a saved session
      handlePortMessage(
        { type: "restore_session", workspaceId, sessionId: "saved-session-123" },
        port,
      )

      const state = getWorkspace(workspaceId)
      expect(state.currentSessionId).toBe("saved-session-123")
      expect(state.controlState).toBe("idle")
    })

    it("should broadcast session_restored event to subscribed ports", () => {
      const port = createMockPort()
      const workspaceId = "herbcaudill/ralph"

      handlePortMessage({ type: "subscribe_workspace", workspaceId }, port)
      port.postMessage.mockClear()

      handlePortMessage(
        { type: "restore_session", workspaceId, sessionId: "saved-session-456" },
        port,
      )

      expect(port.postMessage).toHaveBeenCalledWith({
        type: "session_restored",
        workspaceId,
        sessionId: "saved-session-456",
      })
    })

    it("should not overwrite an active session when workspace is running", () => {
      const port = createMockPort()
      const workspaceId = "herbcaudill/ralph"

      handlePortMessage({ type: "subscribe_workspace", workspaceId }, port)
      const state = getWorkspace(workspaceId)

      // Simulate an active session
      state.controlState = "running"
      state.currentSessionId = "active-session"

      // Attempt to restore — should be ignored
      handlePortMessage({ type: "restore_session", workspaceId, sessionId: "old-session" }, port)

      expect(state.currentSessionId).toBe("active-session")
    })

    it("should not overwrite when workspace already has a session and is idle", () => {
      const port = createMockPort()
      const workspaceId = "herbcaudill/ralph"

      handlePortMessage({ type: "subscribe_workspace", workspaceId }, port)
      const state = getWorkspace(workspaceId)

      // Workspace already has a session from a previous restore
      state.currentSessionId = "existing-session"

      // Attempt to restore again — should be ignored since session already exists
      handlePortMessage(
        { type: "restore_session", workspaceId, sessionId: "another-session" },
        port,
      )

      expect(state.currentSessionId).toBe("existing-session")
    })
  })

  describe("removePort (tab close)", () => {
    it("should unsubscribe from all workspaces when a port is removed", async () => {
      const port = createMockPort()
      const workspace1 = "herbcaudill/ralph"
      const workspace2 = "herbcaudill/other-repo"

      // Subscribe to both workspaces
      handlePortMessage({ type: "subscribe_workspace", workspaceId: workspace1 }, port)
      handlePortMessage({ type: "subscribe_workspace", workspaceId: workspace2 }, port)

      allPorts.add(port)

      const state1 = getWorkspace(workspace1)
      const state2 = getWorkspace(workspace2)

      // Wait for WebSocket connections
      await vi.waitFor(() => {
        expect(state1.ws?.readyState).toBe(MockWebSocket.OPEN)
        expect(state2.ws?.readyState).toBe(MockWebSocket.OPEN)
      })

      // Remove the port (simulating tab close)
      removePort(port)

      expect(state1.subscribedPorts.size).toBe(0)
      expect(state2.subscribedPorts.size).toBe(0)
      expect(allPorts.has(port)).toBe(false)
    })
  })
})
