import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from "vitest"
import { WorkerOrchestratorManager, type TaskSource } from "../WorkerOrchestratorManager.js"
import type { ReadyTask } from "../WorkerLoop.js"

// Mock findClaudeExecutable
vi.mock("../../findClaudeExecutable.js", () => ({
  findClaudeExecutable: vi.fn().mockReturnValue("/usr/bin/claude"),
}))

/**
 * Create a mock task source for testing.
 */
function createMockTaskSource(): TaskSource & {
  getReadyTasksCount: MockInstance<[], Promise<number>>
  getReadyTask: MockInstance<[string], Promise<ReadyTask | null>>
  claimTask: MockInstance<[string, string], Promise<void>>
  closeTask: MockInstance<[string], Promise<void>>
} {
  return {
    getReadyTasksCount: vi.fn<[], Promise<number>>().mockResolvedValue(0),
    getReadyTask: vi.fn<[string], Promise<ReadyTask | null>>().mockResolvedValue(null),
    claimTask: vi.fn<[string, string], Promise<void>>().mockResolvedValue(undefined),
    closeTask: vi.fn<[string], Promise<void>>().mockResolvedValue(undefined),
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
})
