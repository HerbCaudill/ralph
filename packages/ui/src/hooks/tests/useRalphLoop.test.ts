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

      // Initially should be connecting (set in the hook when worker connects)
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

      // State should remain at initial values
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

  describe("workspace switching", () => {
    it("should unsubscribe from old workspace and subscribe to new one when workspaceId changes", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const NEW_WORKSPACE_ID = "herbcaudill/other-repo"

      const { rerender } = renderHook(({ id }) => useRalphLoop(id), {
        initialProps: { id: TEST_WORKSPACE_ID },
      })

      // Verify initial subscribe
      const initialCalls = mockWorkerInstance.port.getPostMessageCalls()
      expect(initialCalls).toContainEqual({
        type: "subscribe_workspace",
        workspaceId: TEST_WORKSPACE_ID,
      })

      // Change workspace
      rerender({ id: NEW_WORKSPACE_ID })

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
})
