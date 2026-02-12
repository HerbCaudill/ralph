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

    it("should disconnect and reset running workspace when last subscriber leaves", async () => {
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
      state.currentSessionId = "session-123"

      // Unsubscribe — should disconnect even though running, because a worker
      // with zero subscribers is unreachable (ghost worker prevention)
      handlePortMessage({ type: "unsubscribe_workspace", workspaceId }, port)

      expect(state.subscribedPorts.size).toBe(0)
      expect(state.ws).toBeNull()
      expect(state.controlState).toBe("idle")
      expect(state.currentSessionId).toBeNull()
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

    it("should send a reconnect message to fetch historical events for idle sessions", async () => {
      const port = createMockPort()
      const workspaceId = "herbcaudill/ralph"

      // Subscribe first (creates WebSocket connection)
      handlePortMessage({ type: "subscribe_workspace", workspaceId }, port)
      const state = getWorkspace(workspaceId)

      // Wait for WebSocket to open
      await vi.waitFor(() => {
        expect(state.ws?.readyState).toBe(MockWebSocket.OPEN)
      })

      // Clear any messages from subscription
      ;(state.ws as any).send.mockClear()

      // Restore an idle session (no controlState — the common case after a completed run)
      handlePortMessage(
        { type: "restore_session", workspaceId, sessionId: "completed-session-789" },
        port,
      )

      // The worker should send a reconnect message to fetch historical events
      expect(state.ws!.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "reconnect", sessionId: "completed-session-789" }),
      )
    })

    it("should not create a duplicate WebSocket when restoring a running session right after subscribe", async () => {
      const port = createMockPort()
      const workspaceId = "herbcaudill/ralph"

      // Subscribe (creates WS in CONNECTING state)
      handlePortMessage({ type: "subscribe_workspace", workspaceId }, port)
      const state = getWorkspace(workspaceId)
      const originalWs = state.ws

      // Immediately restore with running state (before WS opens)
      // This simulates the real useRalphLoop flow where both messages are sent in same tick
      handlePortMessage(
        {
          type: "restore_session",
          workspaceId,
          sessionId: "running-session",
          controlState: "running",
        },
        port,
      )

      // Should NOT have replaced the WebSocket — the original one should still be there
      expect(state.ws).toBe(originalWs)

      // Wait for the original WS to open
      await vi.waitFor(() => {
        expect(state.ws?.readyState).toBe(MockWebSocket.OPEN)
      })

      // Should send reconnect once connected
      await vi.waitFor(() => {
        expect(state.ws!.send).toHaveBeenCalledWith(
          JSON.stringify({ type: "reconnect", sessionId: "running-session" }),
        )
      })
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

  describe("no auto-start on subscribe", () => {
    it("should remain idle after subscribing to a workspace", () => {
      const port = createMockPort()
      const workspaceId = "herbcaudill/ralph"

      handlePortMessage({ type: "subscribe_workspace", workspaceId }, port)

      const state = getWorkspace(workspaceId)
      expect(state.controlState).toBe("idle")
    })

    it("should NOT send a state_change to 'running' after subscribing", () => {
      const port = createMockPort()
      const workspaceId = "herbcaudill/ralph"

      handlePortMessage({ type: "subscribe_workspace", workspaceId }, port)

      // The port should receive state_change with "idle", never "running"
      const stateChangeCalls = port.postMessage.mock.calls
        .map((call: any[]) => call[0])
        .filter((msg: any) => msg.type === "state_change")

      expect(stateChangeCalls).toHaveLength(1)
      expect(stateChangeCalls[0].state).toBe("idle")
    })

    it("should remain idle after restoring a session from localStorage", () => {
      const port = createMockPort()
      const workspaceId = "herbcaudill/ralph"

      // Subscribe and then restore a session
      handlePortMessage({ type: "subscribe_workspace", workspaceId }, port)
      handlePortMessage({ type: "restore_session", workspaceId, sessionId: "saved-session" }, port)

      const state = getWorkspace(workspaceId)
      expect(state.controlState).toBe("idle")
      expect(state.currentSessionId).toBe("saved-session")
    })

    it("should only transition to 'running' when an explicit start message is sent", () => {
      const port = createMockPort()
      const workspaceId = "herbcaudill/ralph"

      // Subscribe
      handlePortMessage({ type: "subscribe_workspace", workspaceId }, port)
      const state = getWorkspace(workspaceId)
      expect(state.controlState).toBe("idle")

      // Explicitly start
      handlePortMessage({ type: "start", workspaceId }, port)
      expect(state.controlState).toBe("running")
    })
  })

  describe("status message handling (r-az2w9)", () => {
    it("should broadcast streaming_state when receiving status 'processing'", async () => {
      const port = createMockPort()
      const workspaceId = "herbcaudill/ralph"

      handlePortMessage({ type: "subscribe_workspace", workspaceId }, port)
      const state = getWorkspace(workspaceId)

      await vi.waitFor(() => {
        expect(state.ws?.readyState).toBe(MockWebSocket.OPEN)
      })

      port.postMessage.mockClear()

      // Simulate the server sending status processing
      state.ws!.onmessage!({ data: JSON.stringify({ type: "status", status: "processing" }) })

      const streamingStateMessages = port.postMessage.mock.calls
        .map((call: any[]) => call[0])
        .filter((msg: any) => msg.type === "streaming_state")

      expect(streamingStateMessages).toHaveLength(1)
      expect(streamingStateMessages[0]).toEqual({
        type: "streaming_state",
        workspaceId,
        isStreaming: true,
      })
    })

    it("should broadcast streaming_state false when receiving status 'idle'", async () => {
      const port = createMockPort()
      const workspaceId = "herbcaudill/ralph"

      handlePortMessage({ type: "subscribe_workspace", workspaceId }, port)
      const state = getWorkspace(workspaceId)

      await vi.waitFor(() => {
        expect(state.ws?.readyState).toBe(MockWebSocket.OPEN)
      })

      port.postMessage.mockClear()

      // Simulate the server sending status idle
      state.ws!.onmessage!({ data: JSON.stringify({ type: "status", status: "idle" }) })

      const streamingStateMessages = port.postMessage.mock.calls
        .map((call: any[]) => call[0])
        .filter((msg: any) => msg.type === "streaming_state")

      expect(streamingStateMessages).toHaveLength(1)
      expect(streamingStateMessages[0]).toEqual({
        type: "streaming_state",
        workspaceId,
        isStreaming: false,
      })
    })

    it("should also broadcast status as a generic event", async () => {
      const port = createMockPort()
      const workspaceId = "herbcaudill/ralph"

      handlePortMessage({ type: "subscribe_workspace", workspaceId }, port)
      const state = getWorkspace(workspaceId)

      await vi.waitFor(() => {
        expect(state.ws?.readyState).toBe(MockWebSocket.OPEN)
      })

      port.postMessage.mockClear()

      // Simulate the server sending status processing
      state.ws!.onmessage!({ data: JSON.stringify({ type: "status", status: "processing" }) })

      const eventMessages = port.postMessage.mock.calls
        .map((call: any[]) => call[0])
        .filter((msg: any) => msg.type === "event")

      expect(eventMessages).toHaveLength(1)
      expect(eventMessages[0]).toEqual({
        type: "event",
        workspaceId,
        event: { type: "status", status: "processing" },
      })
    })
  })

  describe("server connected message handling", () => {
    it("should not broadcast server 'connected' acknowledgment as a chat event", async () => {
      const port = createMockPort()
      const workspaceId = "herbcaudill/ralph"

      handlePortMessage({ type: "subscribe_workspace", workspaceId }, port)
      const state = getWorkspace(workspaceId)

      await vi.waitFor(() => {
        expect(state.ws?.readyState).toBe(MockWebSocket.OPEN)
      })

      port.postMessage.mockClear()

      // Simulate the server sending {"type": "connected"} over WebSocket
      state.ws!.onmessage!({ data: JSON.stringify({ type: "connected" }) })

      // Should NOT have broadcast it as an "event" type (chat event)
      const eventMessages = port.postMessage.mock.calls
        .map((call: any[]) => call[0])
        .filter((msg: any) => msg.type === "event")

      expect(eventMessages).toHaveLength(0)
    })
  })

  describe("connectWorkspace stale onclose", () => {
    it("should not clobber state.ws when a replaced WebSocket fires onclose", async () => {
      const port = createMockPort()
      const workspaceId = "herbcaudill/ralph"

      handlePortMessage({ type: "subscribe_workspace", workspaceId }, port)
      const state = getWorkspace(workspaceId)

      await vi.waitFor(() => {
        expect(state.ws?.readyState).toBe(MockWebSocket.OPEN)
      })

      const firstWs = state.ws

      // Simulate starting a new session which calls connectWorkspace internally
      // by directly calling connectWorkspace (via start which triggers it)
      handlePortMessage({ type: "start", workspaceId }, port)

      // The start handler may or may not replace the WS (it reuses if already OPEN).
      // Let's test the scenario where connectWorkspace is called again explicitly:
      // Close the first WS after a new one has been created
      const secondWs = state.ws

      // If the WS was replaced, the old onclose shouldn't null out the new one
      if (firstWs !== secondWs) {
        // Manually fire the old WS's onclose
        firstWs!.onclose?.()
        // state.ws should still be the second WS, not null
        expect(state.ws).toBe(secondWs)
      }
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

  describe("pause and resume (r-57grj)", () => {
    it("should set controlState to 'paused' (not 'idle') when pausing", async () => {
      const port = createMockPort()
      const workspaceId = "herbcaudill/ralph"

      // Subscribe and start
      handlePortMessage({ type: "subscribe_workspace", workspaceId }, port)
      const state = getWorkspace(workspaceId)

      await vi.waitFor(() => {
        expect(state.ws?.readyState).toBe(MockWebSocket.OPEN)
      })

      // Start the session
      handlePortMessage({ type: "start", workspaceId }, port)
      expect(state.controlState).toBe("running")

      // Pause
      handlePortMessage({ type: "pause", workspaceId }, port)

      // State should be paused, not idle
      expect(state.controlState).toBe("paused")
    })

    it("should preserve currentSessionId when pausing", async () => {
      const port = createMockPort()
      const workspaceId = "herbcaudill/ralph"

      handlePortMessage({ type: "subscribe_workspace", workspaceId }, port)
      const state = getWorkspace(workspaceId)

      await vi.waitFor(() => {
        expect(state.ws?.readyState).toBe(MockWebSocket.OPEN)
      })

      // Simulate session creation
      state.currentSessionId = "session-123"
      state.controlState = "running"

      // Pause
      handlePortMessage({ type: "pause", workspaceId }, port)

      // Session ID should be preserved
      expect(state.currentSessionId).toBe("session-123")
      expect(state.controlState).toBe("paused")
    })

    it("should transition from 'paused' to 'running' when resuming", async () => {
      const port = createMockPort()
      const workspaceId = "herbcaudill/ralph"

      handlePortMessage({ type: "subscribe_workspace", workspaceId }, port)
      const state = getWorkspace(workspaceId)

      await vi.waitFor(() => {
        expect(state.ws?.readyState).toBe(MockWebSocket.OPEN)
      })

      // Set up paused state with an existing session
      state.controlState = "paused"
      state.currentSessionId = "session-123"

      // Resume
      handlePortMessage({ type: "resume", workspaceId }, port)

      // State should be running again
      expect(state.controlState).toBe("running")
      expect(state.currentSessionId).toBe("session-123")
    })

    it("should not change state when resuming from idle (requires paused)", () => {
      const port = createMockPort()
      const workspaceId = "herbcaudill/ralph"

      handlePortMessage({ type: "subscribe_workspace", workspaceId }, port)
      const state = getWorkspace(workspaceId)

      // Ensure idle state
      expect(state.controlState).toBe("idle")

      // Resume should have no effect when not paused
      handlePortMessage({ type: "resume", workspaceId }, port)

      expect(state.controlState).toBe("idle")
    })

    it("should not change state when resuming without a session ID", () => {
      const port = createMockPort()
      const workspaceId = "herbcaudill/ralph"

      handlePortMessage({ type: "subscribe_workspace", workspaceId }, port)
      const state = getWorkspace(workspaceId)

      // Set paused but without a session
      state.controlState = "paused"
      state.currentSessionId = null

      // Resume should have no effect without a session
      handlePortMessage({ type: "resume", workspaceId }, port)

      expect(state.controlState).toBe("paused")
    })

    it("should broadcast state_change event when pausing", async () => {
      const port = createMockPort()
      const workspaceId = "herbcaudill/ralph"

      handlePortMessage({ type: "subscribe_workspace", workspaceId }, port)
      const state = getWorkspace(workspaceId)

      await vi.waitFor(() => {
        expect(state.ws?.readyState).toBe(MockWebSocket.OPEN)
      })

      // Start
      handlePortMessage({ type: "start", workspaceId }, port)
      port.postMessage.mockClear()

      // Pause
      handlePortMessage({ type: "pause", workspaceId }, port)

      // Should broadcast state_change to paused
      const stateChangeMessages = port.postMessage.mock.calls
        .map((call: any[]) => call[0])
        .filter((msg: any) => msg.type === "state_change")

      expect(stateChangeMessages).toHaveLength(1)
      expect(stateChangeMessages[0]).toEqual({
        type: "state_change",
        workspaceId,
        state: "paused",
      })
    })

    it("should broadcast state_change event when resuming", async () => {
      const port = createMockPort()
      const workspaceId = "herbcaudill/ralph"

      handlePortMessage({ type: "subscribe_workspace", workspaceId }, port)
      const state = getWorkspace(workspaceId)

      await vi.waitFor(() => {
        expect(state.ws?.readyState).toBe(MockWebSocket.OPEN)
      })

      // Set up paused state
      state.controlState = "paused"
      state.currentSessionId = "session-123"
      port.postMessage.mockClear()

      // Resume
      handlePortMessage({ type: "resume", workspaceId }, port)

      // Should broadcast state_change to running
      const stateChangeMessages = port.postMessage.mock.calls
        .map((call: any[]) => call[0])
        .filter((msg: any) => msg.type === "state_change")

      expect(stateChangeMessages).toHaveLength(1)
      expect(stateChangeMessages[0]).toEqual({
        type: "state_change",
        workspaceId,
        state: "running",
      })
    })

    it("should allow sending messages when paused (chat remains functional)", async () => {
      const port = createMockPort()
      const workspaceId = "herbcaudill/ralph"

      handlePortMessage({ type: "subscribe_workspace", workspaceId }, port)
      const state = getWorkspace(workspaceId)

      await vi.waitFor(() => {
        expect(state.ws?.readyState).toBe(MockWebSocket.OPEN)
      })

      // Set up paused state with session
      state.controlState = "paused"
      state.currentSessionId = "session-123"
      ;(state.ws as any).send.mockClear()

      // Send a message while paused
      handlePortMessage({ type: "message", workspaceId, text: "Hello from pause" }, port)

      // Message should be sent (not rejected)
      expect(state.ws!.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "message",
          sessionId: "session-123",
          message: "Hello from pause",
        }),
      )
    })

    it("should auto-resume (transition to running) when sending a message while paused (r-kapsj)", async () => {
      const port = createMockPort()
      const workspaceId = "herbcaudill/ralph"

      handlePortMessage({ type: "subscribe_workspace", workspaceId }, port)
      const state = getWorkspace(workspaceId)

      await vi.waitFor(() => {
        expect(state.ws?.readyState).toBe(MockWebSocket.OPEN)
      })

      // Set up paused state with session
      state.controlState = "paused"
      state.currentSessionId = "session-123"
      port.postMessage.mockClear()

      // Send a message while paused
      handlePortMessage({ type: "message", workspaceId, text: "Hello from pause" }, port)

      // Should auto-transition to running
      expect(state.controlState).toBe("running")

      // Should broadcast state_change to running
      const stateChangeMessages = port.postMessage.mock.calls
        .map((call: any[]) => call[0])
        .filter((msg: any) => msg.type === "state_change")

      expect(stateChangeMessages).toHaveLength(1)
      expect(stateChangeMessages[0]).toEqual({
        type: "state_change",
        workspaceId,
        state: "running",
      })
    })
  })

  describe("pending_events session ID validation (r-aeuc1)", () => {
    it("should broadcast pending_events when sessionId matches currentSessionId", async () => {
      const port = createMockPort()
      const workspaceId = "herbcaudill/ralph"

      handlePortMessage({ type: "subscribe_workspace", workspaceId }, port)
      const state = getWorkspace(workspaceId)

      await vi.waitFor(() => {
        expect(state.ws?.readyState).toBe(MockWebSocket.OPEN)
      })

      // Set up an active session
      state.currentSessionId = "session-abc"
      port.postMessage.mockClear()

      // Server sends pending_events with matching sessionId
      const ws = state.ws as MockWebSocket
      ws.onmessage!({
        data: JSON.stringify({
          type: "pending_events",
          sessionId: "session-abc",
          events: [{ type: "assistant", text: "hello" }],
        }),
      })

      // Should broadcast the events
      const pendingMessages = port.postMessage.mock.calls
        .map((call: any[]) => call[0])
        .filter((msg: any) => msg.type === "pending_events")

      expect(pendingMessages).toHaveLength(1)
      expect(pendingMessages[0].events).toEqual([{ type: "assistant", text: "hello" }])
    })

    it("should NOT broadcast pending_events when sessionId does NOT match currentSessionId", async () => {
      const port = createMockPort()
      const workspaceId = "herbcaudill/ralph"

      handlePortMessage({ type: "subscribe_workspace", workspaceId }, port)
      const state = getWorkspace(workspaceId)

      await vi.waitFor(() => {
        expect(state.ws?.readyState).toBe(MockWebSocket.OPEN)
      })

      // Worker has moved to a NEW session
      state.currentSessionId = "session-xyz"
      port.postMessage.mockClear()

      // Server sends pending_events for the OLD session
      const ws = state.ws as MockWebSocket
      ws.onmessage!({
        data: JSON.stringify({
          type: "pending_events",
          sessionId: "session-abc",
          events: [{ type: "assistant", text: "old event" }],
        }),
      })

      // Should NOT broadcast old events into the new session
      const pendingMessages = port.postMessage.mock.calls
        .map((call: any[]) => call[0])
        .filter((msg: any) => msg.type === "pending_events")

      expect(pendingMessages).toHaveLength(0)
    })

    it("should drop stale pending_events when session changes between reconnect and response", async () => {
      const port = createMockPort()
      const workspaceId = "herbcaudill/ralph"

      handlePortMessage({ type: "subscribe_workspace", workspaceId }, port)
      const state = getWorkspace(workspaceId)

      await vi.waitFor(() => {
        expect(state.ws?.readyState).toBe(MockWebSocket.OPEN)
      })

      // 1. Restore old session "abc123"
      handlePortMessage({ type: "restore_session", workspaceId, sessionId: "abc123" }, port)
      expect(state.currentSessionId).toBe("abc123")

      // 2. User starts a new session — worker sends create_session
      //    Simulate the server responding with a new session_created
      state.controlState = "idle" // Reset for start
      state.currentSessionId = null // Reset for start
      handlePortMessage({ type: "start", workspaceId }, port)

      // Simulate server responding with session_created for the new session
      const ws = state.ws as MockWebSocket
      ws.onmessage!({
        data: JSON.stringify({
          type: "session_created",
          sessionId: "xyz789",
        }),
      })

      expect(state.currentSessionId).toBe("xyz789")
      port.postMessage.mockClear()

      // 3. Server finishes reading old events and sends pending_events for "abc123"
      ws.onmessage!({
        data: JSON.stringify({
          type: "pending_events",
          sessionId: "abc123",
          events: [{ type: "assistant", text: "old event from previous session" }],
        }),
      })

      // Should NOT broadcast — sessionId doesn't match currentSessionId
      const pendingMessages = port.postMessage.mock.calls
        .map((call: any[]) => call[0])
        .filter((msg: any) => msg.type === "pending_events")

      expect(pendingMessages).toHaveLength(0)
    })

    it("should broadcast pending_events when sessionId is missing (backward compat)", async () => {
      const port = createMockPort()
      const workspaceId = "herbcaudill/ralph"

      handlePortMessage({ type: "subscribe_workspace", workspaceId }, port)
      const state = getWorkspace(workspaceId)

      await vi.waitFor(() => {
        expect(state.ws?.readyState).toBe(MockWebSocket.OPEN)
      })

      state.currentSessionId = "session-abc"
      port.postMessage.mockClear()

      // Server sends pending_events without sessionId (backward compat)
      const ws = state.ws as MockWebSocket
      ws.onmessage!({
        data: JSON.stringify({
          type: "pending_events",
          events: [{ type: "assistant", text: "hello" }],
        }),
      })

      // Should still broadcast for backward compatibility
      const pendingMessages = port.postMessage.mock.calls
        .map((call: any[]) => call[0])
        .filter((msg: any) => msg.type === "pending_events")

      expect(pendingMessages).toHaveLength(1)
    })
  })

  describe("session restoration after reload (r-29gl2)", () => {
    it("should restore a running session after unsubscribe/subscribe cycle (single-tab reload)", async () => {
      const port1 = createMockPort()
      const workspaceId = "herbcaudill/ralph"

      // 1. Subscribe and start a running session
      handlePortMessage({ type: "subscribe_workspace", workspaceId }, port1)
      const state = getWorkspace(workspaceId)

      await vi.waitFor(() => {
        expect(state.ws?.readyState).toBe(MockWebSocket.OPEN)
      })

      handlePortMessage({ type: "start", workspaceId }, port1)
      state.currentSessionId = "active-session-123"
      expect(state.controlState).toBe("running")

      // 2. Simulate page unload — unsubscribe removes the last subscriber
      handlePortMessage({ type: "unsubscribe_workspace", workspaceId }, port1)
      expect(state.controlState).toBe("idle")
      expect(state.currentSessionId).toBeNull()
      expect(state.ws).toBeNull()

      // 3. Simulate page reload — new port subscribes and restores
      const port2 = createMockPort()
      handlePortMessage({ type: "subscribe_workspace", workspaceId }, port2)

      // Wait for new WebSocket
      await vi.waitFor(() => {
        expect(state.ws?.readyState).toBe(MockWebSocket.OPEN)
      })

      // 4. Restore the session (as useRalphLoop does from localStorage)
      handlePortMessage(
        {
          type: "restore_session",
          workspaceId,
          sessionId: "active-session-123",
          controlState: "running",
        },
        port2,
      )

      // Session should be restored with running state
      expect(state.currentSessionId).toBe("active-session-123")
      expect(state.controlState).toBe("running")

      // Should have sent reconnect to fetch historical events
      expect(state.ws!.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "reconnect", sessionId: "active-session-123" }),
      )

      // Should have broadcast session_restored
      const restoredMessages = port2.postMessage.mock.calls
        .map((call: any[]) => call[0])
        .filter((msg: any) => msg.type === "session_restored")

      expect(restoredMessages).toHaveLength(1)
      expect(restoredMessages[0]).toEqual({
        type: "session_restored",
        workspaceId,
        sessionId: "active-session-123",
        controlState: "running",
      })
    })

    it("should broadcast running state_change when restoring a running session", async () => {
      const port = createMockPort()
      const workspaceId = "herbcaudill/ralph"

      handlePortMessage({ type: "subscribe_workspace", workspaceId }, port)
      const state = getWorkspace(workspaceId)

      await vi.waitFor(() => {
        expect(state.ws?.readyState).toBe(MockWebSocket.OPEN)
      })

      port.postMessage.mockClear()

      // Restore a running session
      handlePortMessage(
        {
          type: "restore_session",
          workspaceId,
          sessionId: "session-456",
          controlState: "running",
        },
        port,
      )

      // Should broadcast state_change to running
      const stateChangeMessages = port.postMessage.mock.calls
        .map((call: any[]) => call[0])
        .filter((msg: any) => msg.type === "state_change")

      expect(stateChangeMessages).toHaveLength(1)
      expect(stateChangeMessages[0]).toEqual({
        type: "state_change",
        workspaceId,
        state: "running",
      })
    })
  })
})
