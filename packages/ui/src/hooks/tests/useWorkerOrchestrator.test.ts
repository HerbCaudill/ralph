import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"

/**
 * Tests for useWorkerOrchestrator hook.
 *
 * This hook communicates with the server via WebSocket to manage parallel
 * worker execution. It provides state for orchestrator status, worker states,
 * and control actions (start, stop, pause, resume workers).
 */

const TEST_WORKSPACE_ID = "herbcaudill/ralph"

/** Mock WebSocket implementation for testing. */
class MockWebSocket {
  static instances: MockWebSocket[] = []

  // Static constants (accessed as WebSocket.OPEN, etc.)
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  // Instance constants (for compatibility)
  readonly CONNECTING = 0
  readonly OPEN = 1
  readonly CLOSING = 2
  readonly CLOSED = 3

  readyState = 1 // OPEN
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: (() => void) | null = null

  private sentMessages: unknown[] = []

  constructor(_url: string) {
    MockWebSocket.instances.push(this)
    // Simulate connection after a tick
    setTimeout(() => {
      this.onopen?.()
    }, 0)
  }

  send(data: string): void {
    this.sentMessages.push(JSON.parse(data))
  }

  close(): void {
    this.readyState = 3
    this.onclose?.()
  }

  /** Simulate receiving a message from the server. */
  simulateMessage(data: unknown): void {
    this.onmessage?.({ data: JSON.stringify(data) })
  }

  /** Get all sent messages. */
  getSentMessages(): unknown[] {
    return this.sentMessages
  }

  static reset(): void {
    MockWebSocket.instances = []
  }
}

describe("useWorkerOrchestrator", () => {
  let originalWebSocket: typeof WebSocket | undefined

  beforeEach(() => {
    MockWebSocket.reset()
    originalWebSocket = globalThis.WebSocket
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket
  })

  afterEach(() => {
    vi.resetModules()
    if (originalWebSocket) {
      globalThis.WebSocket = originalWebSocket
    }
  })

  describe("initialization", () => {
    it("should initialize with default state", async () => {
      const { useWorkerOrchestrator } = await import("../useWorkerOrchestrator")
      const { result } = renderHook(() => useWorkerOrchestrator(TEST_WORKSPACE_ID))

      expect(result.current.state).toBe("stopped")
      expect(result.current.workers).toEqual({})
      expect(result.current.maxWorkers).toBe(3)
      expect(result.current.activeWorkerCount).toBe(0)
      expect(result.current.isConnected).toBe(false)
    })

    it("should connect and subscribe to orchestrator on mount", async () => {
      const { useWorkerOrchestrator } = await import("../useWorkerOrchestrator")
      renderHook(() => useWorkerOrchestrator(TEST_WORKSPACE_ID))

      // Wait for WebSocket connection
      await waitFor(() => {
        expect(MockWebSocket.instances.length).toBe(1)
      })

      // Wait for onopen callback
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      // Should send subscribe_orchestrator message
      const ws = MockWebSocket.instances[0]
      const messages = ws.getSentMessages()
      expect(messages).toContainEqual({
        type: "subscribe_orchestrator",
        workspaceId: TEST_WORKSPACE_ID,
      })
    })

    it("should unsubscribe when unmounting", async () => {
      const { useWorkerOrchestrator } = await import("../useWorkerOrchestrator")
      const { unmount } = renderHook(() => useWorkerOrchestrator(TEST_WORKSPACE_ID))

      // Wait for connection
      await waitFor(() => {
        expect(MockWebSocket.instances.length).toBe(1)
      })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      // Unmount
      unmount()

      // Should send unsubscribe_orchestrator message
      const ws = MockWebSocket.instances[0]
      const messages = ws.getSentMessages()
      expect(messages).toContainEqual({
        type: "unsubscribe_orchestrator",
        workspaceId: TEST_WORKSPACE_ID,
      })
    })

    it("should not connect when workspaceId is undefined", async () => {
      const { useWorkerOrchestrator } = await import("../useWorkerOrchestrator")
      renderHook(() => useWorkerOrchestrator(undefined))

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      expect(MockWebSocket.instances.length).toBe(0)
    })
  })

  describe("orchestrator state updates", () => {
    it("should update state when receiving orchestrator_state message", async () => {
      const { useWorkerOrchestrator } = await import("../useWorkerOrchestrator")
      const { result } = renderHook(() => useWorkerOrchestrator(TEST_WORKSPACE_ID))

      // Wait for connection
      await waitFor(() => {
        expect(MockWebSocket.instances.length).toBe(1)
      })

      const ws = MockWebSocket.instances[0]

      // Simulate receiving orchestrator state
      act(() => {
        ws.simulateMessage({
          type: "orchestrator_state",
          state: "running",
          maxWorkers: 5,
          activeWorkerCount: 2,
          workers: {
            Ralph: { workerName: "Ralph", state: "running", currentTaskId: "r-abc123" },
            Herb: { workerName: "Herb", state: "idle", currentTaskId: null },
          },
          workspaceId: TEST_WORKSPACE_ID,
        })
      })

      await waitFor(() => {
        expect(result.current.state).toBe("running")
        expect(result.current.maxWorkers).toBe(5)
        expect(result.current.activeWorkerCount).toBe(2)
        expect(result.current.workers).toEqual({
          Ralph: { workerName: "Ralph", state: "running", currentTaskId: "r-abc123" },
          Herb: { workerName: "Herb", state: "idle", currentTaskId: null },
        })
      })
    })

    it("should update state when receiving orchestrator_state_changed message", async () => {
      const { useWorkerOrchestrator } = await import("../useWorkerOrchestrator")
      const { result } = renderHook(() => useWorkerOrchestrator(TEST_WORKSPACE_ID))

      await waitFor(() => {
        expect(MockWebSocket.instances.length).toBe(1)
      })

      const ws = MockWebSocket.instances[0]

      act(() => {
        ws.simulateMessage({
          type: "orchestrator_state_changed",
          state: "stopping",
          workspaceId: TEST_WORKSPACE_ID,
        })
      })

      await waitFor(() => {
        expect(result.current.state).toBe("stopping")
      })
    })

    it("should ignore messages from different workspace", async () => {
      const { useWorkerOrchestrator } = await import("../useWorkerOrchestrator")
      const { result } = renderHook(() => useWorkerOrchestrator(TEST_WORKSPACE_ID))

      await waitFor(() => {
        expect(MockWebSocket.instances.length).toBe(1)
      })

      const ws = MockWebSocket.instances[0]

      act(() => {
        ws.simulateMessage({
          type: "orchestrator_state_changed",
          state: "running",
          workspaceId: "other/workspace",
        })
      })

      // State should remain default (stopped)
      expect(result.current.state).toBe("stopped")
    })
  })

  describe("worker lifecycle events", () => {
    it("should add worker when receiving worker_started message", async () => {
      const { useWorkerOrchestrator } = await import("../useWorkerOrchestrator")
      const { result } = renderHook(() => useWorkerOrchestrator(TEST_WORKSPACE_ID))

      await waitFor(() => {
        expect(MockWebSocket.instances.length).toBe(1)
      })

      const ws = MockWebSocket.instances[0]

      act(() => {
        ws.simulateMessage({
          type: "worker_started",
          workerName: "Ralph",
          workspaceId: TEST_WORKSPACE_ID,
        })
      })

      await waitFor(() => {
        expect(result.current.workers["Ralph"]).toEqual({
          workerName: "Ralph",
          state: "running",
          currentTaskId: null,
        })
      })
    })

    it("should remove worker when receiving worker_stopped message", async () => {
      const { useWorkerOrchestrator } = await import("../useWorkerOrchestrator")
      const { result } = renderHook(() => useWorkerOrchestrator(TEST_WORKSPACE_ID))

      await waitFor(() => {
        expect(MockWebSocket.instances.length).toBe(1)
      })

      const ws = MockWebSocket.instances[0]

      // First add a worker
      act(() => {
        ws.simulateMessage({
          type: "worker_started",
          workerName: "Ralph",
          workspaceId: TEST_WORKSPACE_ID,
        })
      })

      await waitFor(() => {
        expect(result.current.workers["Ralph"]).toBeDefined()
      })

      // Then stop it
      act(() => {
        ws.simulateMessage({
          type: "worker_stopped",
          workerName: "Ralph",
          reason: "completed",
          workspaceId: TEST_WORKSPACE_ID,
        })
      })

      await waitFor(() => {
        expect(result.current.workers["Ralph"]).toBeUndefined()
      })
    })

    it("should update worker state when receiving worker_paused message", async () => {
      const { useWorkerOrchestrator } = await import("../useWorkerOrchestrator")
      const { result } = renderHook(() => useWorkerOrchestrator(TEST_WORKSPACE_ID))

      await waitFor(() => {
        expect(MockWebSocket.instances.length).toBe(1)
      })

      const ws = MockWebSocket.instances[0]

      // First add a running worker
      act(() => {
        ws.simulateMessage({
          type: "worker_started",
          workerName: "Ralph",
          workspaceId: TEST_WORKSPACE_ID,
        })
      })

      await waitFor(() => {
        expect(result.current.workers["Ralph"]?.state).toBe("running")
      })

      // Pause it
      act(() => {
        ws.simulateMessage({
          type: "worker_paused",
          workerName: "Ralph",
          workspaceId: TEST_WORKSPACE_ID,
        })
      })

      await waitFor(() => {
        expect(result.current.workers["Ralph"]?.state).toBe("paused")
      })
    })

    it("should update worker state when receiving worker_resumed message", async () => {
      const { useWorkerOrchestrator } = await import("../useWorkerOrchestrator")
      const { result } = renderHook(() => useWorkerOrchestrator(TEST_WORKSPACE_ID))

      await waitFor(() => {
        expect(MockWebSocket.instances.length).toBe(1)
      })

      const ws = MockWebSocket.instances[0]

      // Set up a paused worker
      act(() => {
        ws.simulateMessage({
          type: "orchestrator_state",
          state: "running",
          maxWorkers: 3,
          activeWorkerCount: 1,
          workers: {
            Ralph: { workerName: "Ralph", state: "paused", currentTaskId: "r-abc123" },
          },
          workspaceId: TEST_WORKSPACE_ID,
        })
      })

      await waitFor(() => {
        expect(result.current.workers["Ralph"]?.state).toBe("paused")
      })

      // Resume it
      act(() => {
        ws.simulateMessage({
          type: "worker_resumed",
          workerName: "Ralph",
          workspaceId: TEST_WORKSPACE_ID,
        })
      })

      await waitFor(() => {
        expect(result.current.workers["Ralph"]?.state).toBe("running")
      })
    })
  })

  describe("task lifecycle events", () => {
    it("should update worker task when receiving task_started message", async () => {
      const { useWorkerOrchestrator } = await import("../useWorkerOrchestrator")
      const { result } = renderHook(() => useWorkerOrchestrator(TEST_WORKSPACE_ID))

      await waitFor(() => {
        expect(MockWebSocket.instances.length).toBe(1)
      })

      const ws = MockWebSocket.instances[0]

      // Add a worker
      act(() => {
        ws.simulateMessage({
          type: "worker_started",
          workerName: "Ralph",
          workspaceId: TEST_WORKSPACE_ID,
        })
      })

      await waitFor(() => {
        expect(result.current.workers["Ralph"]).toBeDefined()
      })

      // Start a task
      act(() => {
        ws.simulateMessage({
          type: "task_started",
          workerName: "Ralph",
          taskId: "r-xyz789",
          title: "Fix the bug",
          workspaceId: TEST_WORKSPACE_ID,
        })
      })

      await waitFor(() => {
        expect(result.current.workers["Ralph"]?.currentTaskId).toBe("r-xyz789")
      })
    })

    it("should clear worker task when receiving task_completed message", async () => {
      const { useWorkerOrchestrator } = await import("../useWorkerOrchestrator")
      const { result } = renderHook(() => useWorkerOrchestrator(TEST_WORKSPACE_ID))

      await waitFor(() => {
        expect(MockWebSocket.instances.length).toBe(1)
      })

      const ws = MockWebSocket.instances[0]

      // Set up a worker with a task
      act(() => {
        ws.simulateMessage({
          type: "orchestrator_state",
          state: "running",
          maxWorkers: 3,
          activeWorkerCount: 1,
          workers: {
            Ralph: { workerName: "Ralph", state: "running", currentTaskId: "r-abc123" },
          },
          workspaceId: TEST_WORKSPACE_ID,
        })
      })

      await waitFor(() => {
        expect(result.current.workers["Ralph"]?.currentTaskId).toBe("r-abc123")
      })

      // Complete the task
      act(() => {
        ws.simulateMessage({
          type: "task_completed",
          workerName: "Ralph",
          taskId: "r-abc123",
          workspaceId: TEST_WORKSPACE_ID,
        })
      })

      await waitFor(() => {
        expect(result.current.workers["Ralph"]?.currentTaskId).toBeNull()
      })
    })
  })

  describe("control actions", () => {
    it("should send orchestrator_start message when start is called", async () => {
      const { useWorkerOrchestrator } = await import("../useWorkerOrchestrator")
      const { result } = renderHook(() => useWorkerOrchestrator(TEST_WORKSPACE_ID))

      await waitFor(() => {
        expect(MockWebSocket.instances.length).toBe(1)
      })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      const ws = MockWebSocket.instances[0]

      act(() => {
        result.current.start()
      })

      const messages = ws.getSentMessages()
      expect(messages).toContainEqual({
        type: "orchestrator_start",
        workspaceId: TEST_WORKSPACE_ID,
      })
    })

    it("should send orchestrator_stop message when stop is called", async () => {
      const { useWorkerOrchestrator } = await import("../useWorkerOrchestrator")
      const { result } = renderHook(() => useWorkerOrchestrator(TEST_WORKSPACE_ID))

      await waitFor(() => {
        expect(MockWebSocket.instances.length).toBe(1)
      })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      const ws = MockWebSocket.instances[0]

      act(() => {
        result.current.stop()
      })

      const messages = ws.getSentMessages()
      expect(messages).toContainEqual({
        type: "orchestrator_stop",
        workspaceId: TEST_WORKSPACE_ID,
      })
    })

    it("should send orchestrator_stop_after_current message when stopAfterCurrent is called", async () => {
      const { useWorkerOrchestrator } = await import("../useWorkerOrchestrator")
      const { result } = renderHook(() => useWorkerOrchestrator(TEST_WORKSPACE_ID))

      await waitFor(() => {
        expect(MockWebSocket.instances.length).toBe(1)
      })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      const ws = MockWebSocket.instances[0]

      act(() => {
        result.current.stopAfterCurrent()
      })

      const messages = ws.getSentMessages()
      expect(messages).toContainEqual({
        type: "orchestrator_stop_after_current",
        workspaceId: TEST_WORKSPACE_ID,
      })
    })

    it("should send orchestrator_cancel_stop message when cancelStopAfterCurrent is called", async () => {
      const { useWorkerOrchestrator } = await import("../useWorkerOrchestrator")
      const { result } = renderHook(() => useWorkerOrchestrator(TEST_WORKSPACE_ID))

      await waitFor(() => {
        expect(MockWebSocket.instances.length).toBe(1)
      })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      const ws = MockWebSocket.instances[0]

      act(() => {
        result.current.cancelStopAfterCurrent()
      })

      const messages = ws.getSentMessages()
      expect(messages).toContainEqual({
        type: "orchestrator_cancel_stop",
        workspaceId: TEST_WORKSPACE_ID,
      })
    })
  })

  describe("per-worker control actions", () => {
    it("should send worker_pause message when pauseWorker is called", async () => {
      const { useWorkerOrchestrator } = await import("../useWorkerOrchestrator")
      const { result } = renderHook(() => useWorkerOrchestrator(TEST_WORKSPACE_ID))

      await waitFor(() => {
        expect(MockWebSocket.instances.length).toBe(1)
      })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      const ws = MockWebSocket.instances[0]

      act(() => {
        result.current.pauseWorker("Ralph")
      })

      const messages = ws.getSentMessages()
      expect(messages).toContainEqual({
        type: "worker_pause",
        workerName: "Ralph",
        workspaceId: TEST_WORKSPACE_ID,
      })
    })

    it("should send worker_resume message when resumeWorker is called", async () => {
      const { useWorkerOrchestrator } = await import("../useWorkerOrchestrator")
      const { result } = renderHook(() => useWorkerOrchestrator(TEST_WORKSPACE_ID))

      await waitFor(() => {
        expect(MockWebSocket.instances.length).toBe(1)
      })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      const ws = MockWebSocket.instances[0]

      act(() => {
        result.current.resumeWorker("Ralph")
      })

      const messages = ws.getSentMessages()
      expect(messages).toContainEqual({
        type: "worker_resume",
        workerName: "Ralph",
        workspaceId: TEST_WORKSPACE_ID,
      })
    })

    it("should send worker_stop message when stopWorker is called", async () => {
      const { useWorkerOrchestrator } = await import("../useWorkerOrchestrator")
      const { result } = renderHook(() => useWorkerOrchestrator(TEST_WORKSPACE_ID))

      await waitFor(() => {
        expect(MockWebSocket.instances.length).toBe(1)
      })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      const ws = MockWebSocket.instances[0]

      act(() => {
        result.current.stopWorker("Ralph")
      })

      const messages = ws.getSentMessages()
      expect(messages).toContainEqual({
        type: "worker_stop",
        workerName: "Ralph",
        workspaceId: TEST_WORKSPACE_ID,
      })
    })
  })

  describe("connection status", () => {
    it("should set isConnected to true when connected message is received", async () => {
      const { useWorkerOrchestrator } = await import("../useWorkerOrchestrator")
      const { result } = renderHook(() => useWorkerOrchestrator(TEST_WORKSPACE_ID))

      await waitFor(() => {
        expect(MockWebSocket.instances.length).toBe(1)
      })

      const ws = MockWebSocket.instances[0]

      act(() => {
        ws.simulateMessage({
          type: "connected",
        })
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })
    })

    it("should set isConnected to false when WebSocket closes", async () => {
      const { useWorkerOrchestrator } = await import("../useWorkerOrchestrator")
      const { result } = renderHook(() => useWorkerOrchestrator(TEST_WORKSPACE_ID))

      await waitFor(() => {
        expect(MockWebSocket.instances.length).toBe(1)
      })

      const ws = MockWebSocket.instances[0]

      // First connect
      act(() => {
        ws.simulateMessage({ type: "connected" })
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      // Then close
      act(() => {
        ws.close()
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(false)
      })
    })
  })

  describe("error handling", () => {
    it("should handle orchestrator_error message", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

      const { useWorkerOrchestrator } = await import("../useWorkerOrchestrator")
      renderHook(() => useWorkerOrchestrator(TEST_WORKSPACE_ID))

      await waitFor(() => {
        expect(MockWebSocket.instances.length).toBe(1)
      })

      const ws = MockWebSocket.instances[0]

      act(() => {
        ws.simulateMessage({
          type: "orchestrator_error",
          workerName: "Ralph",
          error: "Something went wrong",
          workspaceId: TEST_WORKSPACE_ID,
        })
      })

      expect(consoleError).toHaveBeenCalledWith(
        "[useWorkerOrchestrator] Error:",
        "Something went wrong",
        "Ralph",
      )

      consoleError.mockRestore()
    })
  })

  describe("React StrictMode double-mount handling", () => {
    it("should not create a WebSocket if component unmounts synchronously before timeout fires", async () => {
      // This test simulates React StrictMode's synchronous mount → unmount → remount behavior
      // The hook should defer WebSocket creation via setTimeout(0) so that if unmount happens
      // before the timer fires, no WebSocket is created (preventing ECONNRESET errors)
      const { useWorkerOrchestrator } = await import("../useWorkerOrchestrator")

      // Mount the hook
      const { unmount } = renderHook(() => useWorkerOrchestrator(TEST_WORKSPACE_ID))

      // Unmount immediately (synchronously, before any timers fire)
      unmount()

      // At this point, no WebSocket should have been created yet
      // because the connection is deferred via setTimeout(0)
      expect(MockWebSocket.instances.length).toBe(0)

      // Now let the timer fire
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      // Still no WebSocket should be created because the timer was cleared on unmount
      expect(MockWebSocket.instances.length).toBe(0)
    })

    it("should only create one WebSocket after deferred connection in normal mount", async () => {
      const { useWorkerOrchestrator } = await import("../useWorkerOrchestrator")

      renderHook(() => useWorkerOrchestrator(TEST_WORKSPACE_ID))

      // Before timer fires, no WebSocket yet
      // (This may be 0 or 1 depending on if timer already ran - need to check)

      // After timer fires, exactly one WebSocket should exist
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      expect(MockWebSocket.instances.length).toBe(1)
    })
  })
})
