import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"

/**
 * Tests for the communication between useRalphLoop hook and the SharedWorker.
 *
 * These tests verify that the hook correctly handles messages from the worker.
 * The worker sends events scoped to a workspaceId, and the hook must filter
 * and handle them to update its state correctly.
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

  describe("start button enabled state", () => {
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
    it("should re-persist controlState to localStorage when session_restored arrives with running state (r-gjirp)", async () => {
      // This test reproduces the race condition bug where:
      // 1. localStorage has 'running' state saved from a previous session
      // 2. On mount, subscribe_workspace triggers state_change:'idle' which clears localStorage
      // 3. session_restored arrives with controlState:'running' and restores React state
      // 4. BUG: localStorage is not re-persisted, so on next remount loadWorkspaceState() returns null
      //
      // The fix: re-persist controlState to localStorage in the session_restored handler

      // Setup: localStorage has a running session
      localStorage.setItem("ralph-workspace-session:herbcaudill/ralph", "previous-session-id")
      localStorage.setItem("ralph-workspace-state:herbcaudill/ralph", "running")

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
      expect(localStorage.getItem("ralph-workspace-state:herbcaudill/ralph")).toBeNull()

      // Now the worker sends session_restored with the original running state
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "session_restored",
          workspaceId: TEST_WORKSPACE_ID,
          sessionId: "previous-session-id",
          controlState: "running",
        })
      })

      // CRITICAL: localStorage should be re-persisted with 'running' so the next remount works
      expect(localStorage.getItem("ralph-workspace-state:herbcaudill/ralph")).toBe("running")
    })

    it("should re-persist controlState to localStorage when session_restored arrives with paused state (r-gjirp)", async () => {
      // Same race condition bug, but for paused state

      // Setup: localStorage has a paused session
      localStorage.setItem("ralph-workspace-session:herbcaudill/ralph", "previous-session-id")
      localStorage.setItem("ralph-workspace-state:herbcaudill/ralph", "paused")

      const { useRalphLoop } = await import("../useRalphLoop")
      renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      // Flush the deferred subscription
      await flushSubscription()

      // Simulate the race condition: worker sends state_change:'idle' first
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "state_change",
          workspaceId: TEST_WORKSPACE_ID,
          state: "idle",
        })
      })

      // At this point, localStorage should have been cleared
      expect(localStorage.getItem("ralph-workspace-state:herbcaudill/ralph")).toBeNull()

      // Now the worker sends session_restored with the original paused state
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "session_restored",
          workspaceId: TEST_WORKSPACE_ID,
          sessionId: "previous-session-id",
          controlState: "paused",
        })
      })

      // CRITICAL: localStorage should be re-persisted with 'paused' so the next remount works
      expect(localStorage.getItem("ralph-workspace-state:herbcaudill/ralph")).toBe("paused")
    })

    it("should persist controlState to localStorage when running", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      // Simulate Ralph starting and running
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "state_change",
          workspaceId: TEST_WORKSPACE_ID,
          state: "running",
        })
      })

      // Control state should be persisted to localStorage
      expect(localStorage.getItem("ralph-workspace-state:herbcaudill/ralph")).toBe("running")
    })

    it("should persist controlState to localStorage when paused", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      // Simulate Ralph pausing
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "state_change",
          workspaceId: TEST_WORKSPACE_ID,
          state: "paused",
        })
      })

      // Control state should be persisted to localStorage
      expect(localStorage.getItem("ralph-workspace-state:herbcaudill/ralph")).toBe("paused")
    })

    it("should clear controlState from localStorage when idle", async () => {
      // Pre-set the state
      localStorage.setItem("ralph-workspace-state:herbcaudill/ralph", "running")

      const { useRalphLoop } = await import("../useRalphLoop")
      renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      // Simulate Ralph stopping
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "state_change",
          workspaceId: TEST_WORKSPACE_ID,
          state: "idle",
        })
      })

      // Control state should be cleared from localStorage
      expect(localStorage.getItem("ralph-workspace-state:herbcaudill/ralph")).toBeNull()
    })

    it("should restore controlState from localStorage on mount and send to worker", async () => {
      // Simulate a previous running state
      localStorage.setItem("ralph-workspace-session:herbcaudill/ralph", "previous-session-id")
      localStorage.setItem("ralph-workspace-state:herbcaudill/ralph", "running")

      const { useRalphLoop } = await import("../useRalphLoop")
      renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      // Flush the deferred subscription
      await flushSubscription()

      const calls = mockWorkerInstance.port.getPostMessageCalls()

      // Should send restore_session with the saved control state
      expect(calls).toContainEqual({
        type: "restore_session",
        workspaceId: TEST_WORKSPACE_ID,
        sessionId: "previous-session-id",
        controlState: "running",
      })
    })

    it("should set isStreaming true when restoring a running session", async () => {
      // Simulate a previous running state
      localStorage.setItem("ralph-workspace-session:herbcaudill/ralph", "previous-session-id")
      localStorage.setItem("ralph-workspace-state:herbcaudill/ralph", "running")

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

    it("should only start when start() is explicitly called", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const { result } = renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      // Verify initially idle
      expect(result.current.controlState).toBe("idle")

      // Explicitly start
      act(() => {
        result.current.start()
      })

      const calls = mockWorkerInstance.port.getPostMessageCalls()
      const startCalls = calls.filter((c: any) => c.type === "start")
      expect(startCalls).toHaveLength(1)
      expect(startCalls[0]).toEqual({
        type: "start",
        workspaceId: TEST_WORKSPACE_ID,
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

  describe("stop after current (r-6mx58)", () => {
    it("should initialize isStoppingAfterCurrent as false", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const { result } = renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      expect(result.current.isStoppingAfterCurrent).toBe(false)
    })

    it("should send stop_after_current message when stopAfterCurrent is called", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const { result } = renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      act(() => {
        result.current.stopAfterCurrent()
      })

      const calls = mockWorkerInstance.port.getPostMessageCalls()
      expect(calls).toContainEqual({
        type: "stop_after_current",
        workspaceId: TEST_WORKSPACE_ID,
      })
    })

    it("should send cancel_stop_after_current message when cancelStopAfterCurrent is called", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const { result } = renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      act(() => {
        result.current.cancelStopAfterCurrent()
      })

      const calls = mockWorkerInstance.port.getPostMessageCalls()
      expect(calls).toContainEqual({
        type: "cancel_stop_after_current",
        workspaceId: TEST_WORKSPACE_ID,
      })
    })

    it("should update isStoppingAfterCurrent when receiving stop_after_current_change event", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const { result } = renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      expect(result.current.isStoppingAfterCurrent).toBe(false)

      // Simulate receiving stop_after_current_change with isStoppingAfterCurrent: true
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "stop_after_current_change",
          workspaceId: TEST_WORKSPACE_ID,
          isStoppingAfterCurrent: true,
        })
      })

      await waitFor(() => {
        expect(result.current.isStoppingAfterCurrent).toBe(true)
      })

      // Simulate receiving stop_after_current_change with isStoppingAfterCurrent: false
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "stop_after_current_change",
          workspaceId: TEST_WORKSPACE_ID,
          isStoppingAfterCurrent: false,
        })
      })

      await waitFor(() => {
        expect(result.current.isStoppingAfterCurrent).toBe(false)
      })
    })

    it("should ignore stop_after_current_change from other workspaces", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const { result } = renderHook(() => useRalphLoop(TEST_WORKSPACE_ID))

      // Simulate receiving stop_after_current_change for a different workspace
      act(() => {
        mockWorkerInstance.port.simulateMessage({
          type: "stop_after_current_change",
          workspaceId: "other/workspace",
          isStoppingAfterCurrent: true,
        })
      })

      // Should remain false
      await waitFor(() => {
        expect(result.current.isStoppingAfterCurrent).toBe(false)
      })
    })
  })
})
