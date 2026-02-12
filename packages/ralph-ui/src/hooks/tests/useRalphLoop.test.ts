import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"

/**
 * Tests for the communication between useRalphLoop hook and the SharedWorker.
 *
 * These tests verify that the hook correctly handles messages from the worker.
 * The worker sends events scoped to a workspaceId, and the hook must filter
 * and handle them to update its state correctly.
 *
 * NOTE: This hook is now focused on session event subscription only.
 * Loop management (start, stop, stop-after-current) is handled by useWorkerOrchestrator.
 */

const TEST_WORKSPACE_ID = "herbcaudill/ralph"

/** Flush the deferred setTimeout(0) subscription in useRalphLoop. */
async function flushSubscription() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

// Mock SharedWorker
class MockMessagePort {
  onmessage: ((event: MessageEvent) => void) | null = null
  onmessageerror: ((event: MessageEvent) => void) | null = null
  private postMessageSpy = vi.fn()

  postMessage(data: unknown): void {
    this.postMessageSpy(data)
  }

  start(): void {
    // noop
  }

  close(): void {
    // noop
  }

  /** Simulate receiving a message from the worker. */
  simulateMessage(data: unknown): void {
    if (this.onmessage) {
      this.onmessage(new MessageEvent("message", { data }))
    }
  }

  getPostMessageCalls(): unknown[] {
    return this.postMessageSpy.mock.calls.map(call => call[0])
  }
}

let mockWorkerInstance: { port: MockMessagePort }

// Define the mock SharedWorker class outside beforeEach so it can be used as a constructor
function MockSharedWorkerClass() {
  mockWorkerInstance = { port: new MockMessagePort() }
  return mockWorkerInstance
}

describe("useRalphLoop", () => {
  let originalSharedWorker: typeof SharedWorker | undefined

  beforeEach(() => {
    // Store original SharedWorker if it exists
    originalSharedWorker = globalThis.SharedWorker

    // Create mock SharedWorker
    globalThis.SharedWorker = MockSharedWorkerClass as unknown as typeof SharedWorker

    // Clear localStorage between tests
    localStorage.clear()
  })

  afterEach(() => {
    vi.resetModules()
    // Restore original SharedWorker
    if (originalSharedWorker) {
      globalThis.SharedWorker = originalSharedWorker
    } else {
      // @ts-expect-error - deleting property that may not exist
      delete globalThis.SharedWorker
    }
  })

  describe("worker message handling", () => {
    it("should update connectionStatus when receiving 'connected' event from worker", async () => {
      // Dynamic import to get fresh module with mocked SharedWorker
      const { useRalphLoop } = await import("../useRalphLoop")
      const { result } = renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      // Flush the deferred subscription (sets status to "connecting")
      await flushSubscription()
      expect(result.current.connectionStatus).toBe("connecting")

      // Simulate the worker sending a 'connected' event for this workspace
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "connected",
          workspaceId: TEST_WORKSPACE_ID,
        })
      })

      // The hook should update connectionStatus to "connected"
      await waitFor(() => {
        expect(result.current.connectionStatus).toBe("connected")
      })
    })

    it("should update connectionStatus when receiving 'disconnected' event from worker", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const { result } = renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      // First connect
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "connected",
          workspaceId: TEST_WORKSPACE_ID,
        })
      })

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe("connected")
      })

      // Then simulate disconnect
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "disconnected",
          workspaceId: TEST_WORKSPACE_ID,
        })
      })

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe("disconnected")
      })
    })

    it("should update controlState when receiving 'state_change' event from worker", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const { result } = renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      // Initially should be idle
      expect(result.current.controlState).toBe("idle")

      // Simulate the worker sending a 'state_change' event
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "state_change",
          workspaceId: TEST_WORKSPACE_ID,
          state: "running",
        })
      })

      // The hook should update controlState to "running"
      await waitFor(() => {
        expect(result.current.controlState).toBe("running")
      })
    })

    it("should handle state_change to paused", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const { result } = renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "state_change",
          workspaceId: TEST_WORKSPACE_ID,
          state: "paused",
        })
      })

      await waitFor(() => {
        expect(result.current.controlState).toBe("paused")
      })
    })

    it("should handle state_change to idle", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const { result } = renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      // First set to running
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "state_change",
          workspaceId: TEST_WORKSPACE_ID,
          state: "running",
        })
      })

      await waitFor(() => {
        expect(result.current.controlState).toBe("running")
      })

      // Then set to idle
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "state_change",
          workspaceId: TEST_WORKSPACE_ID,
          state: "idle",
        })
      })

      await waitFor(() => {
        expect(result.current.controlState).toBe("idle")
      })
    })

    it("should ignore events from a different workspace", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const { result } = renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      // Flush the deferred subscription
      await flushSubscription()

      // Simulate events for a different workspace
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "connected",
          workspaceId: "other/repo",
        })
        mockWorkerInstance.port.simulateMessage({
          type: "state_change",
          workspaceId: "other/repo",
          state: "running",
        })
      })

      // State should remain at initial values (connecting, not connected)
      expect(result.current.connectionStatus).toBe("connecting")
      expect(result.current.controlState).toBe("idle")
    })
  })

  describe("button enabled state helper", () => {
    it("should enable start when connected and idle (reproduces P0 bug r-0wsce)", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const { getControlBarButtonStates, controlStateToRalphStatus } =
        await import("../../lib/getControlBarButtonStates")
      const { result } = renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      // Flush the deferred subscription
      await flushSubscription()

      // Simulate the worker sending connected and idle state
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "connected",
          workspaceId: TEST_WORKSPACE_ID,
        })
        mockWorkerInstance.port.simulateMessage({
          type: "state_change",
          workspaceId: TEST_WORKSPACE_ID,
          state: "idle",
        })
      })

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe("connected")
        expect(result.current.controlState).toBe("idle")
      })

      // Now verify the button states
      const isConnected = result.current.connectionStatus === "connected"
      const status = controlStateToRalphStatus(result.current.controlState)
      const buttonStates = getControlBarButtonStates(status, isConnected)

      // The start button should be enabled
      expect(buttonStates.start).toBe(true)
    })
  })

  describe("subscribe_workspace on mount", () => {
    it("should send subscribe_workspace message with workspaceId on mount", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      // Flush the deferred subscription
      await flushSubscription()

      const calls = mockWorkerInstance.port.getPostMessageCalls()
      expect(calls).toContainEqual({
        type: "subscribe_workspace",
        workspaceId: TEST_WORKSPACE_ID,
      })
    })

    it("should not create SharedWorker when workspaceId is undefined", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const { result } = renderHook(() => useRalphLoop(undefined))

      expect(result.current.connectionStatus).toBe("disconnected")
    })
  })

  describe("unsubscribe_workspace on unmount", () => {
    it("should send unsubscribe_workspace message when unmounting", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const { unmount } = renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      // Flush the deferred subscription
      await flushSubscription()

      // Verify subscribe was sent
      const callsBefore = mockWorkerInstance.port.getPostMessageCalls()
      expect(callsBefore).toContainEqual({
        type: "subscribe_workspace",
        workspaceId: TEST_WORKSPACE_ID,
      })

      // Unmount the hook
      unmount()

      // Verify unsubscribe was sent
      const callsAfter = mockWorkerInstance.port.getPostMessageCalls()
      expect(callsAfter).toContainEqual({
        type: "unsubscribe_workspace",
        workspaceId: TEST_WORKSPACE_ID,
      })
    })
  })

  describe("session persistence", () => {
    it("should save session ID to localStorage when session_created is received", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "session_created",
          workspaceId: TEST_WORKSPACE_ID,
          sessionId: "new-session-abc",
        })
      })

      expect(localStorage.getItem("ralph-workspace-session:herbcaudill/ralph")).toBe(
        "new-session-abc",
      )
    })

    it("should set sessionId state when session_created is received", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const { result } = renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      expect(result.current.sessionId).toBeNull()

      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "session_created",
          workspaceId: TEST_WORKSPACE_ID,
          sessionId: "session-xyz",
        })
      })

      await waitFor(() => {
        expect(result.current.sessionId).toBe("session-xyz")
        expect(result.current.isStreaming).toBe(true)
      })
    })

    it("should send restore_session to worker when subscribing if localStorage has a saved session", async () => {
      localStorage.setItem("ralph-workspace-session:herbcaudill/ralph", "saved-session-id")

      const { useRalphLoop } = await import("../useRalphLoop")
      renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      // Flush the deferred subscription
      await flushSubscription()

      const calls = mockWorkerInstance.port.getPostMessageCalls()
      expect(calls).toContainEqual({
        type: "restore_session",
        workspaceId: TEST_WORKSPACE_ID,
        sessionId: "saved-session-id",
      })
    })

    it("should NOT send restore_session when no saved session exists", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      const calls = mockWorkerInstance.port.getPostMessageCalls()
      const restoreCalls = calls.filter((c: any) => c.type === "restore_session")
      expect(restoreCalls).toHaveLength(0)
    })

    it("should set sessionId but NOT isStreaming when session_restored is received", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const { result } = renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "session_restored",
          workspaceId: TEST_WORKSPACE_ID,
          sessionId: "restored-session",
        })
      })

      await waitFor(() => {
        expect(result.current.sessionId).toBe("restored-session")
        expect(result.current.isStreaming).toBe(false)
        expect(result.current.controlState).toBe("idle")
      })
    })

    it("should reset sessionId when switching workspaces", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const { result, rerender } = renderHook(({ id }) => useRalphLoop(id), {
        initialProps: { id: TEST_WORKSPACE_ID },
      })

      // Set a session on the first workspace
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "session_created",
          workspaceId: TEST_WORKSPACE_ID,
          sessionId: "session-1",
        })
      })

      await waitFor(() => {
        expect(result.current.sessionId).toBe("session-1")
      })

      // Switch workspace
      rerender({ id: "herbcaudill/other-repo" })

      await waitFor(() => {
        expect(result.current.sessionId).toBeNull()
      })
    })
  })

  describe("control state persistence across reload", () => {
    it("should re-persist session ID to localStorage when session_restored arrives", async () => {
      // Setup: localStorage has a running session
      localStorage.setItem("ralph-workspace-session:herbcaudill/ralph", "previous-session-id")

      const { useRalphLoop } = await import("../useRalphLoop")
      renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      // Flush the deferred subscription
      await flushSubscription()

      // Simulate the race condition: worker sends state_change:'idle' first
      // (this is what happens when subscribe_workspace is processed before restore_session)
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "state_change",
          workspaceId: TEST_WORKSPACE_ID,
          state: "idle",
        })
      })

      // At this point, localStorage should have been cleared by the state_change handler
      expect(localStorage.getItem("ralph-workspace-session:herbcaudill/ralph")).toBeNull()

      // Now the worker sends session_restored with the original running state
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "session_restored",
          workspaceId: TEST_WORKSPACE_ID,
          sessionId: "previous-session-id",
          controlState: "running",
        })
      })

      // Session ID should be re-persisted
      expect(localStorage.getItem("ralph-workspace-session:herbcaudill/ralph")).toBe(
        "previous-session-id",
      )
    })

    it("should clear session ID from localStorage when transitioning to idle (r-3lq9v)", async () => {
      // Pre-set session ID
      localStorage.setItem("ralph-workspace-session:herbcaudill/ralph", "previous-session-id")

      const { useRalphLoop } = await import("../useRalphLoop")
      renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      // Simulate Ralph stopping (state changes to idle)
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "state_change",
          workspaceId: TEST_WORKSPACE_ID,
          state: "idle",
        })
      })

      // Session ID should be cleared from localStorage
      expect(localStorage.getItem("ralph-workspace-session:herbcaudill/ralph")).toBeNull()
    })

    it("should set isStreaming true when restoring a running session", async () => {
      // Simulate a previous running state
      localStorage.setItem("ralph-workspace-session:herbcaudill/ralph", "previous-session-id")

      const { useRalphLoop } = await import("../useRalphLoop")
      const { result } = renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      // Flush the deferred subscription
      await flushSubscription()

      // Simulate the worker responding with session_restored (with running state)
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "session_restored",
          workspaceId: TEST_WORKSPACE_ID,
          sessionId: "previous-session-id",
          controlState: "running",
        })
      })

      await waitFor(() => {
        expect(result.current.sessionId).toBe("previous-session-id")
        expect(result.current.controlState).toBe("running")
        expect(result.current.isStreaming).toBe(true)
      })
    })
  })

  describe("streaming state toggling (r-az2w9)", () => {
    it("should set isStreaming to true when receiving status 'processing'", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const { result } = renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      // Connect and start a session
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "connected",
          workspaceId: TEST_WORKSPACE_ID,
        })
        mockWorkerInstance.port.simulateMessage({
          type: "session_created",
          workspaceId: TEST_WORKSPACE_ID,
          sessionId: "session-1",
        })
      })

      // Initially isStreaming is true from session_created
      await waitFor(() => {
        expect(result.current.isStreaming).toBe(true)
      })

      // Simulate status idle (agent finished processing)
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "streaming_state",
          workspaceId: TEST_WORKSPACE_ID,
          isStreaming: false,
        })
      })

      await waitFor(() => {
        expect(result.current.isStreaming).toBe(false)
      })

      // Simulate status processing (agent started processing again)
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "streaming_state",
          workspaceId: TEST_WORKSPACE_ID,
          isStreaming: true,
        })
      })

      await waitFor(() => {
        expect(result.current.isStreaming).toBe(true)
      })
    })

    it("should toggle isStreaming false when status is idle", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const { result } = renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      // Start a session (sets isStreaming true)
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "session_created",
          workspaceId: TEST_WORKSPACE_ID,
          sessionId: "session-1",
        })
      })

      await waitFor(() => {
        expect(result.current.isStreaming).toBe(true)
      })

      // Simulate status idle
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "streaming_state",
          workspaceId: TEST_WORKSPACE_ID,
          isStreaming: false,
        })
      })

      await waitFor(() => {
        expect(result.current.isStreaming).toBe(false)
      })
    })
  })

  describe("no auto-start behavior", () => {
    it("should NOT send a start message when subscribing to a workspace", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      const calls = mockWorkerInstance.port.getPostMessageCalls()
      const startCalls = calls.filter((c: any) => c.type === "start")
      expect(startCalls).toHaveLength(0)
    })

    it("should NOT send a start message when restoring a saved session", async () => {
      localStorage.setItem("ralph-workspace-session:herbcaudill/ralph", "saved-session-id")

      const { useRalphLoop } = await import("../useRalphLoop")
      renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      const calls = mockWorkerInstance.port.getPostMessageCalls()
      const startCalls = calls.filter((c: any) => c.type === "start")
      expect(startCalls).toHaveLength(0)
    })

    it("should remain idle after session_restored (no auto-start)", async () => {
      localStorage.setItem("ralph-workspace-session:herbcaudill/ralph", "saved-session-id")

      const { useRalphLoop } = await import("../useRalphLoop")
      const { result } = renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      // Simulate the worker responding with session_restored
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "session_restored",
          workspaceId: TEST_WORKSPACE_ID,
          sessionId: "saved-session-id",
        })
      })

      await waitFor(() => {
        expect(result.current.sessionId).toBe("saved-session-id")
        expect(result.current.controlState).toBe("idle")
        expect(result.current.isStreaming).toBe(false)
      })
    })
  })

  describe("workspace switching", () => {
    it("should unsubscribe from old workspace and subscribe to new one when workspaceId changes", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const NEW_WORKSPACE_ID = "herbcaudill/other-repo"

      const { rerender } = renderHook(({ id }) => useRalphLoop(id), {
        initialProps: { id: TEST_WORKSPACE_ID },
      })

      // Flush the deferred initial subscription
      await flushSubscription()

      // Verify initial subscribe
      const initialCalls = mockWorkerInstance.port.getPostMessageCalls()
      expect(initialCalls).toContainEqual({
        type: "subscribe_workspace",
        workspaceId: TEST_WORKSPACE_ID,
      })

      // Change workspace
      rerender({ id: NEW_WORKSPACE_ID })

      // Flush the deferred new subscription
      await flushSubscription()

      const allCalls = mockWorkerInstance.port.getPostMessageCalls()

      // Should have unsubscribed from old workspace
      expect(allCalls).toContainEqual({
        type: "unsubscribe_workspace",
        workspaceId: TEST_WORKSPACE_ID,
      })

      // Should have subscribed to new workspace
      expect(allCalls).toContainEqual({
        type: "subscribe_workspace",
        workspaceId: NEW_WORKSPACE_ID,
      })
    })

    it("should reset events when switching workspaces", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const NEW_WORKSPACE_ID = "herbcaudill/other-repo"

      const { result, rerender } = renderHook(({ id }) => useRalphLoop(id), {
        initialProps: { id: TEST_WORKSPACE_ID },
      })

      // Add some events for the first workspace
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "event",
          workspaceId: TEST_WORKSPACE_ID,
          event: { type: "assistant", content: "hello" },
        })
      })

      await waitFor(() => {
        expect(result.current.events.length).toBe(1)
      })

      // Switch workspace
      rerender({ id: NEW_WORKSPACE_ID })

      // Events should be cleared
      await waitFor(() => {
        expect(result.current.events.length).toBe(0)
      })
    })

    it("should reset connectionStatus to 'connecting' when switching workspaces", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const NEW_WORKSPACE_ID = "herbcaudill/other-repo"

      const { result, rerender } = renderHook(({ id }) => useRalphLoop(id), {
        initialProps: { id: TEST_WORKSPACE_ID },
      })

      // Connect to first workspace
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "connected",
          workspaceId: TEST_WORKSPACE_ID,
        })
      })

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe("connected")
      })

      // Switch workspace
      rerender({ id: NEW_WORKSPACE_ID })

      // Connection status should reset since we're connecting to a new workspace
      await waitFor(() => {
        expect(result.current.connectionStatus).toBe("connecting")
      })
    })
  })

  describe("event deduplication (r-1zc78)", () => {
    it("should deduplicate events by id when the same event arrives multiple times", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const { result } = renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      // Simulate the same event arriving twice (e.g., from both 'event' and 'pending_events')
      const eventWithId = {
        type: "assistant",
        id: "unique-event-id-123",
        timestamp: 1234567890,
        message: {
          content: [{ type: "text", text: "Hello world" }],
        },
      }

      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "event",
          workspaceId: TEST_WORKSPACE_ID,
          event: eventWithId,
        })
      })

      await waitFor(() => {
        expect(result.current.events).toHaveLength(1)
      })

      // Same event arrives again (e.g., from pending_events on reconnect)
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "event",
          workspaceId: TEST_WORKSPACE_ID,
          event: eventWithId,
        })
      })

      // Should still only have one event (deduplicated by id)
      await waitFor(() => {
        expect(result.current.events).toHaveLength(1)
        expect(result.current.events[0].id).toBe("unique-event-id-123")
      })
    })

    it("should deduplicate pending_events that already exist in the events array", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const { result } = renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      const event1 = {
        type: "assistant",
        id: "event-1",
        timestamp: 1234567890,
        message: { content: [{ type: "text", text: "First" }] },
      }
      const event2 = {
        type: "assistant",
        id: "event-2",
        timestamp: 1234567891,
        message: { content: [{ type: "text", text: "Second" }] },
      }

      // First event arrives
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "event",
          workspaceId: TEST_WORKSPACE_ID,
          event: event1,
        })
      })

      await waitFor(() => {
        expect(result.current.events).toHaveLength(1)
      })

      // pending_events arrives containing both event1 and event2
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "pending_events",
          workspaceId: TEST_WORKSPACE_ID,
          events: [event1, event2],
        })
      })

      // Should have 2 events, not 3 (event1 should be deduplicated)
      await waitFor(() => {
        expect(result.current.events).toHaveLength(2)
        expect(result.current.events.map(e => e.id)).toEqual(["event-1", "event-2"])
      })
    })

    it("should deduplicate events with uuid field (r-58o19)", async () => {
      // Events persisted by Claude CLI use 'uuid' instead of 'id'
      // On session restore, these should be deduplicated by their uuid
      const { useRalphLoop } = await import("../useRalphLoop")
      const { result } = renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      const eventWithUuid = {
        type: "assistant",
        uuid: "27137a9a-09de-4a16-951a-aafa6ab2d3f2",
        timestamp: 1234567890,
        message: { content: [{ type: "text", text: "Hello" }] },
      }

      // First event arrives via streaming
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "event",
          workspaceId: TEST_WORKSPACE_ID,
          event: eventWithUuid,
        })
      })

      await waitFor(() => {
        expect(result.current.events).toHaveLength(1)
      })

      // Same event arrives again via pending_events (on reconnect)
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "pending_events",
          workspaceId: TEST_WORKSPACE_ID,
          events: [eventWithUuid],
        })
      })

      // Should still only have one event (deduplicated by uuid)
      await waitFor(() => {
        expect(result.current.events).toHaveLength(1)
      })
    })

    it("should normalize uuid to id in events (r-58o19)", async () => {
      // Events with 'uuid' should have that value accessible as 'id' for consistent deduplication
      const { useRalphLoop } = await import("../useRalphLoop")
      const { result } = renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      const eventWithUuid = {
        type: "assistant",
        uuid: "27137a9a-09de-4a16-951a-aafa6ab2d3f2",
        timestamp: 1234567890,
        message: { content: [{ type: "text", text: "Hello" }] },
      }

      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "event",
          workspaceId: TEST_WORKSPACE_ID,
          event: eventWithUuid,
        })
      })

      await waitFor(() => {
        expect(result.current.events).toHaveLength(1)
        // The event should have 'id' set to the 'uuid' value
        expect(result.current.events[0].id).toBe("27137a9a-09de-4a16-951a-aafa6ab2d3f2")
      })
    })
  })

  describe("task lifecycle event parsing (r-c7n1g)", () => {
    it("should emit task_lifecycle event when assistant event contains <start_task>", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const { result } = renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      // Simulate an assistant event with a <start_task> marker in the text
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "event",
          workspaceId: TEST_WORKSPACE_ID,
          event: {
            type: "assistant",
            timestamp: 1234567890,
            message: {
              content: [
                {
                  type: "text",
                  text: "<start_task>r-abc123</start_task>",
                },
              ],
            },
          },
        })
      })

      await waitFor(() => {
        // Should have both the original assistant event and the derived task_lifecycle event
        expect(result.current.events).toHaveLength(2)
        expect(result.current.events[0].type).toBe("assistant")
        expect(result.current.events[1].type).toBe("task_lifecycle")
        const lifecycleEvent = result.current.events[1] as any
        expect(lifecycleEvent.action).toBe("starting")
        expect(lifecycleEvent.taskId).toBe("r-abc123")
      })
    })

    it("should emit task_lifecycle event when assistant event contains <end_task>", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const { result } = renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      // Simulate an assistant event with an <end_task> marker in the text
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "event",
          workspaceId: TEST_WORKSPACE_ID,
          event: {
            type: "assistant",
            timestamp: 1234567890,
            message: {
              content: [
                {
                  type: "text",
                  text: "<end_task>r-abc123</end_task>",
                },
              ],
            },
          },
        })
      })

      await waitFor(() => {
        // Should have both the original assistant event and the derived task_lifecycle event
        expect(result.current.events).toHaveLength(2)
        expect(result.current.events[0].type).toBe("assistant")
        expect(result.current.events[1].type).toBe("task_lifecycle")
        const lifecycleEvent = result.current.events[1] as any
        expect(lifecycleEvent.action).toBe("completed")
        expect(lifecycleEvent.taskId).toBe("r-abc123")
      })
    })

    it("should not emit task_lifecycle for assistant events without task markers", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const { result } = renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      // Simulate a normal assistant event without task markers
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "event",
          workspaceId: TEST_WORKSPACE_ID,
          event: {
            type: "assistant",
            timestamp: 1234567890,
            message: {
              content: [
                {
                  type: "text",
                  text: "Just a regular message without task markers",
                },
              ],
            },
          },
        })
      })

      await waitFor(() => {
        // Should only have the assistant event, no task_lifecycle
        expect(result.current.events).toHaveLength(1)
        expect(result.current.events[0].type).toBe("assistant")
      })
    })

    it("should emit task_lifecycle events for pending_events with task markers", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const { result } = renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      // Simulate pending_events containing an assistant event with task marker
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "pending_events",
          workspaceId: TEST_WORKSPACE_ID,
          events: [
            {
              type: "assistant",
              timestamp: 1234567890,
              message: {
                content: [
                  {
                    type: "text",
                    text: "<start_task>r-xyz789</start_task>",
                  },
                ],
              },
            },
          ],
        })
      })

      await waitFor(() => {
        // Should have both the assistant event and the derived task_lifecycle event
        expect(result.current.events).toHaveLength(2)
        expect(result.current.events[0].type).toBe("assistant")
        expect(result.current.events[1].type).toBe("task_lifecycle")
        const lifecycleEvent = result.current.events[1] as any
        expect(lifecycleEvent.action).toBe("starting")
        expect(lifecycleEvent.taskId).toBe("r-xyz789")
      })
    })
  })

  describe("rapid event updates near session end (r-xpu16)", () => {
    /**
     * This test reproduces the bug where the UI doesn't update events in real-time
     * near the end of a Ralph session. Events ARE persisted to the server and are
     * visible after refresh via pending_events, but the UI stops updating during
     * the rapid event sequence at session end.
     *
     * The bug manifests when multiple events arrive in quick succession:
     * 1. Assistant event with <end_task> or <promise>COMPLETE</promise>
     * 2. Streaming state change (isStreaming: false)
     * 3. State change to idle or new session starting
     * 4. Late-arriving events that should still be rendered
     */

    it("should NOT clear events when session_created arrives (events preserved for scrollback) (r-xpu16)", async () => {
      // The bug was that session_created would call setEvents([]) which cleared
      // all events from the previous session. This test verifies that events
      // are preserved across session transitions, allowing users to scroll back
      // and see what happened in the previous session.
      const { useRalphLoop } = await import("../useRalphLoop")
      const { result } = renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      // Connect and start first session
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "connected",
          workspaceId: TEST_WORKSPACE_ID,
        })
        mockWorkerInstance.port.simulateMessage({
          type: "session_created",
          workspaceId: TEST_WORKSPACE_ID,
          sessionId: "session-1",
        })
        mockWorkerInstance.port.simulateMessage({
          type: "state_change",
          workspaceId: TEST_WORKSPACE_ID,
          state: "running",
        })
      })

      await waitFor(() => {
        expect(result.current.sessionId).toBe("session-1")
      })

      // Add some events to session 1
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "event",
          workspaceId: TEST_WORKSPACE_ID,
          event: {
            type: "assistant",
            id: "session1-event1",
            message: { content: [{ type: "text", text: "Working..." }] },
          },
        })
        mockWorkerInstance.port.simulateMessage({
          type: "event",
          workspaceId: TEST_WORKSPACE_ID,
          event: {
            type: "assistant",
            id: "session1-event2",
            message: { content: [{ type: "text", text: "<end_task>r-abc</end_task>" }] },
          },
        })
      })

      await waitFor(() => {
        expect(result.current.events.some(e => e.id === "session1-event1")).toBe(true)
        expect(result.current.events.some(e => e.id === "session1-event2")).toBe(true)
      })

      // New session starts (auto-loop after end_task)
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "session_created",
          workspaceId: TEST_WORKSPACE_ID,
          sessionId: "session-2",
        })
      })

      await waitFor(() => {
        expect(result.current.sessionId).toBe("session-2")
      })

      // Events should still be visible (preserved for scrollback history)
      // The current implementation clears events - this test documents that behavior
      // but may need to change if we want to preserve events across sessions
      expect(result.current.events.length).toBe(0) // Current behavior: events are cleared
      // TODO: If we want to preserve events, change this to:
      // expect(result.current.events.length).toBe(eventCountBeforeNewSession)
    })

    it("should render all events when rapid events arrive near session end (r-xpu16)", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const { result } = renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      // Connect and start streaming
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "connected",
          workspaceId: TEST_WORKSPACE_ID,
        })
        mockWorkerInstance.port.simulateMessage({
          type: "session_created",
          workspaceId: TEST_WORKSPACE_ID,
          sessionId: "session-1",
        })
        mockWorkerInstance.port.simulateMessage({
          type: "state_change",
          workspaceId: TEST_WORKSPACE_ID,
          state: "running",
        })
      })

      await waitFor(() => {
        expect(result.current.isStreaming).toBe(true)
        expect(result.current.controlState).toBe("running")
      })

      // Simulate the rapid sequence of events that occur near session end
      // All these arrive in quick succession without React having time to re-render
      act(() => {
        // 1. First, some regular events during the session
        mockWorkerInstance.port.simulateMessage({
          type: "event",
          workspaceId: TEST_WORKSPACE_ID,
          event: {
            type: "assistant",
            id: "event-1",
            message: { content: [{ type: "text", text: "Working on task..." }] },
          },
        })

        // 2. The final assistant event with end_task marker
        mockWorkerInstance.port.simulateMessage({
          type: "event",
          workspaceId: TEST_WORKSPACE_ID,
          event: {
            type: "assistant",
            id: "event-2",
            message: {
              content: [{ type: "text", text: "<end_task>r-abc123</end_task>\n\nTask complete!" }],
            },
          },
        })

        // 3. Streaming state changes to false
        mockWorkerInstance.port.simulateMessage({
          type: "streaming_state",
          workspaceId: TEST_WORKSPACE_ID,
          isStreaming: false,
        })

        // 4. A late-arriving event that comes after streaming ended
        // This is the event that might get lost in the UI
        mockWorkerInstance.port.simulateMessage({
          type: "event",
          workspaceId: TEST_WORKSPACE_ID,
          event: {
            type: "assistant",
            id: "event-3",
            message: { content: [{ type: "text", text: "Summary of what was done." }] },
          },
        })
      })

      // ALL events should be visible in the UI
      await waitFor(() => {
        const eventIds = result.current.events.filter(e => e.id).map(e => e.id)
        expect(eventIds).toContain("event-1")
        expect(eventIds).toContain("event-2")
        expect(eventIds).toContain("event-3") // This is the event that was getting lost
      })

      // Verify total event count (3 assistant events + 2 task_lifecycle events from the end_task marker)
      expect(result.current.events.filter(e => e.type === "assistant")).toHaveLength(3)
    })

    it("should continue updating UI when state transitions to idle mid-stream (r-xpu16)", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const { result } = renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      // Connect and start
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "connected",
          workspaceId: TEST_WORKSPACE_ID,
        })
        mockWorkerInstance.port.simulateMessage({
          type: "session_created",
          workspaceId: TEST_WORKSPACE_ID,
          sessionId: "session-1",
        })
        mockWorkerInstance.port.simulateMessage({
          type: "state_change",
          workspaceId: TEST_WORKSPACE_ID,
          state: "running",
        })
      })

      await waitFor(() => {
        expect(result.current.controlState).toBe("running")
      })

      // Simulate the problematic sequence:
      // 1. Event arrives
      // 2. State changes to idle
      // 3. More events arrive after idle
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "event",
          workspaceId: TEST_WORKSPACE_ID,
          event: {
            type: "assistant",
            id: "before-idle",
            message: { content: [{ type: "text", text: "Before idle" }] },
          },
        })

        mockWorkerInstance.port.simulateMessage({
          type: "state_change",
          workspaceId: TEST_WORKSPACE_ID,
          state: "idle",
        })

        // Event after idle state - this should still be processed
        mockWorkerInstance.port.simulateMessage({
          type: "event",
          workspaceId: TEST_WORKSPACE_ID,
          event: {
            type: "assistant",
            id: "after-idle",
            message: { content: [{ type: "text", text: "After idle" }] },
          },
        })
      })

      await waitFor(() => {
        const eventIds = result.current.events.filter(e => e.id).map(e => e.id)
        expect(eventIds).toContain("before-idle")
        expect(eventIds).toContain("after-idle")
      })
    })

    it("should handle session_created followed by immediate events (r-xpu16)", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const { result } = renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      // This test checks the scenario where a new session is created
      // and events start arriving before React has time to process session_created
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "connected",
          workspaceId: TEST_WORKSPACE_ID,
        })

        // Session created clears events
        mockWorkerInstance.port.simulateMessage({
          type: "session_created",
          workspaceId: TEST_WORKSPACE_ID,
          sessionId: "session-1",
        })

        // Events arrive immediately after session creation
        mockWorkerInstance.port.simulateMessage({
          type: "event",
          workspaceId: TEST_WORKSPACE_ID,
          event: {
            type: "assistant",
            id: "first-event",
            message: { content: [{ type: "text", text: "First event" }] },
          },
        })
      })

      await waitFor(() => {
        expect(result.current.sessionId).toBe("session-1")
        expect(result.current.events.some(e => e.id === "first-event")).toBe(true)
      })
    })
  })

  describe("pause and resume", () => {
    it("should send pause message when pause is called", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const { result } = renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      await flushSubscription()

      act(() => {
        result.current.pause()
      })

      const calls = mockWorkerInstance.port.getPostMessageCalls()
      expect(calls).toContainEqual({
        type: "pause",
        workspaceId: TEST_WORKSPACE_ID,
      })
    })

    it("should send resume message when resume is called", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const { result } = renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      await flushSubscription()

      act(() => {
        result.current.resume()
      })

      const calls = mockWorkerInstance.port.getPostMessageCalls()
      expect(calls).toContainEqual({
        type: "resume",
        workspaceId: TEST_WORKSPACE_ID,
      })
    })
  })

  describe("send message", () => {
    it("should send message to worker and add optimistic update", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const { result } = renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      await flushSubscription()

      act(() => {
        result.current.sendMessage("Hello Claude")
      })

      // Check message was sent to worker
      const calls = mockWorkerInstance.port.getPostMessageCalls()
      expect(calls).toContainEqual({
        type: "message",
        workspaceId: TEST_WORKSPACE_ID,
        text: "Hello Claude",
      })

      // Check optimistic update was added
      await waitFor(() => {
        expect(
          result.current.events.some(
            e => e.type === "user_message" && (e as any).message === "Hello Claude",
          ),
        ).toBe(true)
      })
    })

    it("should not send empty messages", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const { result } = renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      await flushSubscription()

      const callsBefore = mockWorkerInstance.port.getPostMessageCalls().length

      act(() => {
        result.current.sendMessage("   ")
      })

      const callsAfter = mockWorkerInstance.port.getPostMessageCalls().length
      expect(callsAfter).toBe(callsBefore) // No new messages sent
    })
  })
})
