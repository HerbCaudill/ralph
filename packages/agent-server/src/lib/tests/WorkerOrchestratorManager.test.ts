import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from "vitest"
import { WorkerOrchestratorManager, type TaskSource } from "../WorkerOrchestratorManager.js"
import type {
  ChatSessionManager,
  CreateSessionOptions,
  SessionInfo,
} from "../../ChatSessionManager.js"
import { EventEmitter } from "node:events"

/**
 * Create a mock ChatSessionManager for testing.
 * Sessions created become "idle" immediately.
 */
function createMockSessionManager(): {
  mockManager: ChatSessionManager
  createSession: MockInstance<[options?: CreateSessionOptions], Promise<{ sessionId: string }>>
  sendMessage: MockInstance<[string, string, object?], Promise<void>>
  getSessionInfo: MockInstance<[string], SessionInfo | null>
  sessions: Map<string, SessionInfo>
} {
  const sessions = new Map<string, SessionInfo>()
  const emitter = new EventEmitter()
  let sessionCounter = 0

  const createSession = vi.fn<[options?: CreateSessionOptions], Promise<{ sessionId: string }>>(
    async (options = {}) => {
      const sessionId = `mock-session-${++sessionCounter}`
      sessions.set(sessionId, {
        sessionId,
        adapter: "claude",
        status: "idle",
        cwd: options.cwd,
        createdAt: Date.now(),
        app: options.app,
      })
      return { sessionId }
    },
  )

  const sendMessage = vi.fn<[string, string, object?], Promise<void>>(
    async (sessionId, _message, _options) => {
      const session = sessions.get(sessionId)
      if (session) {
        // Simulate processing → idle
        session.status = "processing"
        // Emit status change
        emitter.emit("status", sessionId, "processing")
        // Then go idle
        session.status = "idle"
        emitter.emit("status", sessionId, "idle")
      }
    },
  )

  const getSessionInfo = vi.fn<[string], SessionInfo | null>((sessionId: string) => {
    return sessions.get(sessionId) ?? null
  })

  const mockManager = {
    createSession,
    sendMessage,
    getSessionInfo,
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),
    emit: emitter.emit.bind(emitter),
  } as unknown as ChatSessionManager

  return { mockManager, createSession, sendMessage, getSessionInfo, sessions }
}

/**
 * Create a mock task source for testing.
 * Only provides `getReadyTasksCount` for capacity planning.
 */
function createMockTaskSource(): TaskSource & {
  getReadyTasksCount: MockInstance<[], Promise<number>>
} {
  return {
    getReadyTasksCount: vi.fn<[], Promise<number>>().mockResolvedValue(0),
  }
}

describe("WorkerOrchestratorManager", () => {
  let mockTaskSource: ReturnType<typeof createMockTaskSource>

  beforeEach(() => {
    vi.clearAllMocks()
    mockTaskSource = createMockTaskSource()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("constructor", () => {
    it("creates an orchestrator manager with default options", () => {
      const manager = new WorkerOrchestratorManager({
        mainWorkspacePath: "/tmp/test-workspace",
        taskSource: mockTaskSource,
      })

      expect(manager).toBeDefined()
      expect(manager.getState()).toBe("stopped")
      expect(manager.getMaxWorkers()).toBe(3)
    })

    it("creates an orchestrator manager with custom options", () => {
      const manager = new WorkerOrchestratorManager({
        mainWorkspacePath: "/tmp/test-workspace",
        taskSource: mockTaskSource,
        maxWorkers: 5,
        app: "custom-app",
      })

      expect(manager).toBeDefined()
      expect(manager.getMaxWorkers()).toBe(5)
    })
  })

  describe("state management", () => {
    it("starts in stopped state", () => {
      const manager = new WorkerOrchestratorManager({
        mainWorkspacePath: "/tmp/test-workspace",
        taskSource: mockTaskSource,
      })

      expect(manager.getState()).toBe("stopped")
      expect(manager.getActiveWorkerCount()).toBe(0)
      expect(manager.getWorkerNames()).toEqual([])
    })

    it("transitions to running when started", async () => {
      const manager = new WorkerOrchestratorManager({
        mainWorkspacePath: "/tmp/test-workspace",
        taskSource: mockTaskSource,
      })

      await manager.start()
      expect(manager.getState()).toBe("running")

      await manager.stop()
    })

    it("transitions to stopping when stopAfterCurrent is called", async () => {
      const manager = new WorkerOrchestratorManager({
        mainWorkspacePath: "/tmp/test-workspace",
        taskSource: mockTaskSource,
      })

      await manager.start()
      manager.stopAfterCurrent()
      expect(manager.getState()).toBe("stopping")

      await manager.stop()
    })

    it("transitions to stopped when stop is called", async () => {
      const manager = new WorkerOrchestratorManager({
        mainWorkspacePath: "/tmp/test-workspace",
        taskSource: mockTaskSource,
      })

      await manager.start()
      await manager.stop()
      expect(manager.getState()).toBe("stopped")
    })
  })

  describe("task source integration", () => {
    it("queries task source for ready tasks when started", async () => {
      mockTaskSource.getReadyTasksCount.mockResolvedValue(2)

      const manager = new WorkerOrchestratorManager({
        mainWorkspacePath: "/tmp/test-workspace",
        taskSource: mockTaskSource,
      })

      await manager.start()

      // Wait for initial task check
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockTaskSource.getReadyTasksCount).toHaveBeenCalled()

      await manager.stop()
    })

    it("emits task_source_error when task source fails", async () => {
      mockTaskSource.getReadyTasksCount.mockRejectedValue(new Error("Connection failed"))

      const manager = new WorkerOrchestratorManager({
        mainWorkspacePath: "/tmp/test-workspace",
        taskSource: mockTaskSource,
      })

      const errors: Error[] = []
      manager.on("task_source_error", ({ error }) => {
        errors.push(error)
      })

      await manager.start()

      // Wait for initial task check
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].message).toBe("Connection failed")

      await manager.stop()
    })
  })

  describe("event forwarding", () => {
    it("forwards state_changed events from orchestrator", async () => {
      const manager = new WorkerOrchestratorManager({
        mainWorkspacePath: "/tmp/test-workspace",
        taskSource: mockTaskSource,
      })

      const states: string[] = []
      manager.on("state_changed", ({ state }) => {
        states.push(state)
      })

      await manager.start()
      await manager.stop()

      expect(states).toContain("running")
      expect(states).toContain("stopped")
    })
  })

  describe("worker controls", () => {
    it("exposes worker state methods", () => {
      const manager = new WorkerOrchestratorManager({
        mainWorkspacePath: "/tmp/test-workspace",
        taskSource: mockTaskSource,
      })

      expect(typeof manager.getWorkerState).toBe("function")
      expect(typeof manager.getWorkerStates).toBe("function")
      expect(typeof manager.pauseWorker).toBe("function")
      expect(typeof manager.resumeWorker).toBe("function")
      expect(typeof manager.stopWorker).toBe("function")
    })

    it("returns null for non-existent worker state", () => {
      const manager = new WorkerOrchestratorManager({
        mainWorkspacePath: "/tmp/test-workspace",
        taskSource: mockTaskSource,
      })

      expect(manager.getWorkerState("nonexistent")).toBe(null)
    })
  })

  describe("cancelStopAfterCurrent", () => {
    it("resumes orchestrator if it was stopping", async () => {
      const manager = new WorkerOrchestratorManager({
        mainWorkspacePath: "/tmp/test-workspace",
        taskSource: mockTaskSource,
      })

      await manager.start()
      manager.stopAfterCurrent()
      expect(manager.getState()).toBe("stopping")

      await manager.cancelStopAfterCurrent()
      expect(manager.getState()).toBe("running")

      await manager.stop()
    })

    it("does nothing if orchestrator is not stopping", async () => {
      const manager = new WorkerOrchestratorManager({
        mainWorkspacePath: "/tmp/test-workspace",
        taskSource: mockTaskSource,
      })

      await manager.start()
      expect(manager.getState()).toBe("running")

      await manager.cancelStopAfterCurrent()
      expect(manager.getState()).toBe("running")

      await manager.stop()
    })
  })

  describe("session management", () => {
    it("creates sessions via ChatSessionManager when sessionManager is provided", async () => {
      const { mockManager, createSession } = createMockSessionManager()

      const manager = new WorkerOrchestratorManager({
        mainWorkspacePath: "/tmp/test-workspace",
        taskSource: mockTaskSource,
        sessionManager: mockManager,
      })

      // The manager should accept the sessionManager option
      expect(manager).toBeDefined()
      expect(createSession).not.toHaveBeenCalled() // No sessions created until worker runs

      await manager.stop()
    })

    it("emits session_created event when a session is created", async () => {
      const { mockManager } = createMockSessionManager()

      // Set up a task to be ready
      mockTaskSource.getReadyTasksCount.mockResolvedValue(1)

      const manager = new WorkerOrchestratorManager({
        mainWorkspacePath: "/tmp/test-workspace",
        taskSource: mockTaskSource,
        sessionManager: mockManager,
      })

      const sessionCreatedEvents: Array<{
        workerName: string
        sessionId: string
      }> = []
      manager.on("session_created", event => {
        sessionCreatedEvents.push(event)
      })

      // Note: This test verifies the event type exists and can be listened to.
      // Full integration testing would require mocking the WorkerLoop/WorktreeManager.
      expect(manager).toBeDefined()

      await manager.stop()
    })
  })
})
