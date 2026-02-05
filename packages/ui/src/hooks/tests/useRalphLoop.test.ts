import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"

/**
 * Tests for the communication between useRalphLoop hook and the SharedWorker.
 *
 * These tests verify that the hook correctly handles messages from the worker.
 * The worker sends events with specific types, and the hook must handle them
 * to update its state correctly.
 */

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

  // Helper to simulate receiving a message from the worker
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
      const { result } = renderHook(() => useRalphLoop())

      // Initially should be connecting (set in the hook when worker connects)
      expect(result.current.connectionStatus).toBe("connecting")

      // Simulate the worker sending a 'connected' event
      // This is what the worker actually sends (see ralphWorker.ts line 113)
      act(() => {
        mockWorkerInstance.port.simulateMessage({ type: "connected" })
      })

      // The hook should update connectionStatus to "connected"
      await waitFor(() => {
        expect(result.current.connectionStatus).toBe("connected")
      })
    })

    it("should update connectionStatus when receiving 'disconnected' event from worker", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const { result } = renderHook(() => useRalphLoop())

      // First connect
      act(() => {
        mockWorkerInstance.port.simulateMessage({ type: "connected" })
      })

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe("connected")
      })

      // Then simulate disconnect
      // This is what the worker sends (see ralphWorker.ts line 191)
      act(() => {
        mockWorkerInstance.port.simulateMessage({ type: "disconnected" })
      })

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe("disconnected")
      })
    })

    it("should update controlState when receiving 'state_change' event from worker", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const { result } = renderHook(() => useRalphLoop())

      // Initially should be idle
      expect(result.current.controlState).toBe("idle")

      // Simulate the worker sending a 'state_change' event
      // This is what the worker actually sends (see ralphWorker.ts line 82)
      act(() => {
        mockWorkerInstance.port.simulateMessage({ type: "state_change", state: "running" })
      })

      // The hook should update controlState to "running"
      await waitFor(() => {
        expect(result.current.controlState).toBe("running")
      })
    })

    it("should handle state_change to paused", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const { result } = renderHook(() => useRalphLoop())

      act(() => {
        mockWorkerInstance.port.simulateMessage({ type: "state_change", state: "paused" })
      })

      await waitFor(() => {
        expect(result.current.controlState).toBe("paused")
      })
    })

    it("should handle state_change to idle", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const { result } = renderHook(() => useRalphLoop())

      // First set to running
      act(() => {
        mockWorkerInstance.port.simulateMessage({ type: "state_change", state: "running" })
      })

      await waitFor(() => {
        expect(result.current.controlState).toBe("running")
      })

      // Then set to idle
      act(() => {
        mockWorkerInstance.port.simulateMessage({ type: "state_change", state: "idle" })
      })

      await waitFor(() => {
        expect(result.current.controlState).toBe("idle")
      })
    })
  })

  describe("start button enabled state", () => {
    it("should enable start when connected and idle (reproduces P0 bug r-0wsce)", async () => {
      const { useRalphLoop } = await import("../useRalphLoop")
      const { getControlBarButtonStates, controlStateToRalphStatus } =
        await import("../../lib/getControlBarButtonStates")
      const { result } = renderHook(() => useRalphLoop())

      // Simulate the worker sending connected and idle state
      act(() => {
        mockWorkerInstance.port.simulateMessage({ type: "connected" })
        mockWorkerInstance.port.simulateMessage({ type: "state_change", state: "idle" })
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
})
