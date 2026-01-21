import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { EventEmitter } from "node:events"
import { WorkspaceContextManager } from "./WorkspaceContextManager.js"

// Mock the WorkspaceContext to avoid creating real RalphManager/BdProxy instances
vi.mock("./WorkspaceContext.js", async () => {
  const { EventEmitter } = await import("node:events")

  class MockWorkspaceContext extends EventEmitter {
    workspacePath: string
    disposed = false

    constructor(options: { workspacePath: string }) {
      super()
      this.workspacePath = options.workspacePath
    }

    get ralphManager() {
      return { status: "idle", isRunning: false }
    }
    get bdProxy() {
      return {}
    }
    get taskChatManager() {
      return {}
    }
    get eventHistory() {
      return []
    }
    get currentTask() {
      return { taskId: undefined, taskTitle: undefined }
    }

    clearHistory() {}

    async dispose() {
      this.disposed = true
    }
  }

  return {
    WorkspaceContext: MockWorkspaceContext,
  }
})

describe("WorkspaceContextManager", () => {
  let manager: WorkspaceContextManager

  beforeEach(() => {
    vi.clearAllMocks()
    manager = new WorkspaceContextManager()
  })

  afterEach(async () => {
    await manager.disposeAll()
  })

  describe("getOrCreate", () => {
    it("creates a new context for a workspace path", () => {
      const context = manager.getOrCreate("/path/to/workspace")

      expect(context).toBeDefined()
      expect(context.workspacePath).toBe("/path/to/workspace")
    })

    it("returns the same context for the same workspace path", () => {
      const context1 = manager.getOrCreate("/path/to/workspace")
      const context2 = manager.getOrCreate("/path/to/workspace")

      expect(context1).toBe(context2)
    })

    it("creates different contexts for different workspace paths", () => {
      const context1 = manager.getOrCreate("/path/to/workspace1")
      const context2 = manager.getOrCreate("/path/to/workspace2")

      expect(context1).not.toBe(context2)
      expect(context1.workspacePath).toBe("/path/to/workspace1")
      expect(context2.workspacePath).toBe("/path/to/workspace2")
    })

    it("recreates a disposed context", async () => {
      const context1 = manager.getOrCreate("/path/to/workspace")
      await context1.dispose()

      const context2 = manager.getOrCreate("/path/to/workspace")

      expect(context2).not.toBe(context1)
    })

    it("emits context:created event when creating a new context", () => {
      const createdHandler = vi.fn()
      manager.on("context:created", createdHandler)

      const context = manager.getOrCreate("/path/to/workspace")

      expect(createdHandler).toHaveBeenCalledWith("/path/to/workspace", context)
    })
  })

  describe("get", () => {
    it("returns undefined for non-existent workspace", () => {
      const context = manager.get("/nonexistent")

      expect(context).toBeUndefined()
    })

    it("returns the context if it exists", () => {
      manager.getOrCreate("/path/to/workspace")
      const context = manager.get("/path/to/workspace")

      expect(context).toBeDefined()
      expect(context!.workspacePath).toBe("/path/to/workspace")
    })

    it("returns undefined for disposed contexts", async () => {
      const context = manager.getOrCreate("/path/to/workspace")
      await context.dispose()

      const retrieved = manager.get("/path/to/workspace")

      expect(retrieved).toBeUndefined()
    })
  })

  describe("has", () => {
    it("returns false for non-existent workspace", () => {
      expect(manager.has("/nonexistent")).toBe(false)
    })

    it("returns true for existing workspace", () => {
      manager.getOrCreate("/path/to/workspace")

      expect(manager.has("/path/to/workspace")).toBe(true)
    })

    it("returns false for disposed workspace", async () => {
      const context = manager.getOrCreate("/path/to/workspace")
      await context.dispose()

      expect(manager.has("/path/to/workspace")).toBe(false)
    })
  })

  describe("getWorkspacePaths", () => {
    it("returns empty array when no contexts exist", () => {
      expect(manager.getWorkspacePaths()).toEqual([])
    })

    it("returns all workspace paths", () => {
      manager.getOrCreate("/path/to/workspace1")
      manager.getOrCreate("/path/to/workspace2")

      const paths = manager.getWorkspacePaths()

      expect(paths).toHaveLength(2)
      expect(paths).toContain("/path/to/workspace1")
      expect(paths).toContain("/path/to/workspace2")
    })

    it("excludes disposed contexts", async () => {
      manager.getOrCreate("/path/to/workspace1")
      const context2 = manager.getOrCreate("/path/to/workspace2")
      await context2.dispose()

      const paths = manager.getWorkspacePaths()

      expect(paths).toEqual(["/path/to/workspace1"])
    })
  })

  describe("size", () => {
    it("returns 0 when no contexts exist", () => {
      expect(manager.size).toBe(0)
    })

    it("returns the correct count of active contexts", () => {
      manager.getOrCreate("/path/to/workspace1")
      manager.getOrCreate("/path/to/workspace2")

      expect(manager.size).toBe(2)
    })

    it("excludes disposed contexts from count", async () => {
      manager.getOrCreate("/path/to/workspace1")
      const context2 = manager.getOrCreate("/path/to/workspace2")
      await context2.dispose()

      expect(manager.size).toBe(1)
    })
  })

  describe("setActiveContext", () => {
    it("sets the active context and returns it", () => {
      const context = manager.setActiveContext("/path/to/workspace")

      expect(context.workspacePath).toBe("/path/to/workspace")
      expect(manager.activeWorkspacePath).toBe("/path/to/workspace")
    })

    it("creates the context if it does not exist", () => {
      manager.setActiveContext("/path/to/workspace")

      expect(manager.has("/path/to/workspace")).toBe(true)
    })

    it("emits context:activated event", () => {
      const activatedHandler = vi.fn()
      manager.on("context:activated", activatedHandler)

      const context = manager.setActiveContext("/path/to/workspace")

      expect(activatedHandler).toHaveBeenCalledWith("/path/to/workspace", context)
    })

    it("can switch between active contexts", () => {
      manager.setActiveContext("/path/to/workspace1")
      expect(manager.activeWorkspacePath).toBe("/path/to/workspace1")

      manager.setActiveContext("/path/to/workspace2")
      expect(manager.activeWorkspacePath).toBe("/path/to/workspace2")
    })
  })

  describe("getActiveContext", () => {
    it("returns undefined when no context is active", () => {
      expect(manager.getActiveContext()).toBeUndefined()
    })

    it("returns the active context", () => {
      manager.setActiveContext("/path/to/workspace")

      const active = manager.getActiveContext()

      expect(active).toBeDefined()
      expect(active!.workspacePath).toBe("/path/to/workspace")
    })

    it("returns undefined if the active context was disposed", async () => {
      const context = manager.setActiveContext("/path/to/workspace")
      await context.dispose()

      expect(manager.getActiveContext()).toBeUndefined()
    })
  })

  describe("dispose", () => {
    it("disposes a specific context", async () => {
      const context = manager.getOrCreate("/path/to/workspace")
      const disposeSpy = vi.spyOn(context, "dispose")

      await manager.dispose("/path/to/workspace")

      expect(disposeSpy).toHaveBeenCalled()
      expect(manager.has("/path/to/workspace")).toBe(false)
    })

    it("does nothing for non-existent workspace", async () => {
      await expect(manager.dispose("/nonexistent")).resolves.toBeUndefined()
    })

    it("clears active state if disposing the active context", async () => {
      manager.setActiveContext("/path/to/workspace")

      await manager.dispose("/path/to/workspace")

      expect(manager.activeWorkspacePath).toBeUndefined()
      expect(manager.getActiveContext()).toBeUndefined()
    })

    it("emits context:disposed event", async () => {
      const disposedHandler = vi.fn()
      manager.on("context:disposed", disposedHandler)
      manager.getOrCreate("/path/to/workspace")

      await manager.dispose("/path/to/workspace")

      expect(disposedHandler).toHaveBeenCalledWith("/path/to/workspace")
    })
  })

  describe("disposeAll", () => {
    it("disposes all contexts", async () => {
      const context1 = manager.getOrCreate("/path/to/workspace1")
      const context2 = manager.getOrCreate("/path/to/workspace2")
      const disposeSpy1 = vi.spyOn(context1, "dispose")
      const disposeSpy2 = vi.spyOn(context2, "dispose")

      await manager.disposeAll()

      expect(disposeSpy1).toHaveBeenCalled()
      expect(disposeSpy2).toHaveBeenCalled()
      expect(manager.size).toBe(0)
    })

    it("clears the active context", async () => {
      manager.setActiveContext("/path/to/workspace")

      await manager.disposeAll()

      expect(manager.activeWorkspacePath).toBeUndefined()
    })

    it("emits context:disposed event for each context", async () => {
      const disposedHandler = vi.fn()
      manager.on("context:disposed", disposedHandler)
      manager.getOrCreate("/path/to/workspace1")
      manager.getOrCreate("/path/to/workspace2")

      await manager.disposeAll()

      expect(disposedHandler).toHaveBeenCalledTimes(2)
    })
  })

  describe("maxContexts limit", () => {
    it("respects maxContexts limit", async () => {
      const limitedManager = new WorkspaceContextManager({ maxContexts: 2 })

      limitedManager.getOrCreate("/path/to/workspace1")
      limitedManager.getOrCreate("/path/to/workspace2")
      limitedManager.getOrCreate("/path/to/workspace3")

      // Wait for async dispose to complete
      await new Promise(resolve => setTimeout(resolve, 10))

      // The oldest context that isn't active should be disposed
      // Note: since no context is active, any of the first two could be disposed
      expect(limitedManager.size).toBeLessThanOrEqual(2)
    })

    it("does not dispose the active context when enforcing limit", async () => {
      const limitedManager = new WorkspaceContextManager({ maxContexts: 2 })

      limitedManager.setActiveContext("/path/to/workspace1")
      limitedManager.getOrCreate("/path/to/workspace2")
      limitedManager.getOrCreate("/path/to/workspace3")

      // Wait for async dispose to complete
      await new Promise(resolve => setTimeout(resolve, 10))

      // The active context should still exist
      expect(limitedManager.has("/path/to/workspace1")).toBe(true)
      expect(limitedManager.activeWorkspacePath).toBe("/path/to/workspace1")
    })

    it("allows unlimited contexts when maxContexts is 0", () => {
      const unlimitedManager = new WorkspaceContextManager({ maxContexts: 0 })

      for (let i = 0; i < 20; i++) {
        unlimitedManager.getOrCreate(`/path/to/workspace${i}`)
      }

      expect(unlimitedManager.size).toBe(20)
    })
  })

  describe("event forwarding", () => {
    it("forwards events from the active context", () => {
      const eventHandler = vi.fn()
      manager.on("context:event", eventHandler)

      const context = manager.setActiveContext("/path/to/workspace")

      // Simulate an event from the context
      context.emit("ralph:status", "running")

      expect(eventHandler).toHaveBeenCalledWith("/path/to/workspace", "ralph:status", "running")
    })

    it("stops forwarding events from inactive contexts", () => {
      const eventHandler = vi.fn()
      manager.on("context:event", eventHandler)

      const context1 = manager.setActiveContext("/path/to/workspace1")
      manager.setActiveContext("/path/to/workspace2")

      // Emit from the now-inactive context
      context1.emit("ralph:status", "stopped")

      // The handler should not have been called for the inactive context's event
      const calls = eventHandler.mock.calls.filter(
        (call: unknown[]) => call[0] === "/path/to/workspace1",
      )
      expect(calls).toHaveLength(0)
    })

    it("includes workspace path in forwarded events", () => {
      const eventHandler = vi.fn()
      manager.on("context:event", eventHandler)

      const context = manager.setActiveContext("/path/to/workspace")
      context.emit("ralph:event", { type: "test", timestamp: Date.now() })

      expect(eventHandler).toHaveBeenCalled()
      expect(eventHandler.mock.calls[0][0]).toBe("/path/to/workspace")
      expect(eventHandler.mock.calls[0][1]).toBe("ralph:event")
    })
  })
})
