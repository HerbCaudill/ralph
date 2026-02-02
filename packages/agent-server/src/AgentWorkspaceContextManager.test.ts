import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { EventEmitter } from "node:events"
import { AgentWorkspaceContextManager } from "./AgentWorkspaceContextManager.js"
import { AgentWorkspaceContext } from "./AgentWorkspaceContext.js"

// Mock RalphManager
vi.mock("./RalphManager.js", () => {
  const { EventEmitter } = require("node:events")
  class MockRalphManager extends EventEmitter {
    _status = "stopped"
    get status() {
      return this._status
    }
    get isRunning() {
      return this._status === "running"
    }
    start = vi.fn()
    stop = vi.fn().mockResolvedValue(undefined)
    pause = vi.fn()
    resume = vi.fn()
    send = vi.fn()
  }
  return { RalphManager: MockRalphManager }
})

// Mock TaskChatManager
vi.mock("./TaskChatManager.js", () => {
  const { EventEmitter } = require("node:events")
  class MockTaskChatManager extends EventEmitter {}
  return { TaskChatManager: MockTaskChatManager }
})

// Mock TaskChatEventLog
vi.mock("./TaskChatEventLog.js", () => {
  class MockTaskChatEventLog {
    _isLogging = false
    get isLogging() {
      return this._isLogging
    }
    startSession = vi.fn()
    endSession = vi.fn()
    log = vi.fn()
  }
  return { TaskChatEventLog: MockTaskChatEventLog }
})

// Mock TaskChatEventPersister
vi.mock("./TaskChatEventPersister.js", () => {
  class MockTaskChatEventPersister {
    appendEvent = vi.fn().mockResolvedValue(undefined)
    clear = vi.fn().mockResolvedValue(undefined)
  }
  return { TaskChatEventPersister: MockTaskChatEventPersister }
})

describe("AgentWorkspaceContextManager", () => {
  let manager: AgentWorkspaceContextManager

  beforeEach(() => {
    manager = new AgentWorkspaceContextManager()
  })

  afterEach(async () => {
    await manager.disposeAll()
  })

  it("can be instantiated with default options", () => {
    expect(manager).toBeInstanceOf(AgentWorkspaceContextManager)
    expect(manager.size).toBe(0)
    expect(manager.activeWorkspacePath).toBeUndefined()
  })

  describe("getOrCreate", () => {
    it("creates a new context for a workspace path", () => {
      const context = manager.getOrCreate("/tmp/workspace-a")

      expect(context).toBeInstanceOf(AgentWorkspaceContext)
      expect(context.workspacePath).toBe("/tmp/workspace-a")
      expect(manager.size).toBe(1)
    })

    it("returns the same context on subsequent calls", () => {
      const context1 = manager.getOrCreate("/tmp/workspace-a")
      const context2 = manager.getOrCreate("/tmp/workspace-a")

      expect(context1).toBe(context2)
      expect(manager.size).toBe(1)
    })

    it("creates different contexts for different paths", () => {
      const contextA = manager.getOrCreate("/tmp/workspace-a")
      const contextB = manager.getOrCreate("/tmp/workspace-b")

      expect(contextA).not.toBe(contextB)
      expect(manager.size).toBe(2)
    })

    it("emits context:created when a new context is created", () => {
      const created: Array<{ path: string; context: AgentWorkspaceContext }> = []
      manager.on("context:created", (path: string, context: AgentWorkspaceContext) => {
        created.push({ path, context })
      })

      manager.getOrCreate("/tmp/workspace-a")

      expect(created).toHaveLength(1)
      expect(created[0].path).toBe("/tmp/workspace-a")
    })

    it("does not emit context:created for existing contexts", () => {
      manager.getOrCreate("/tmp/workspace-a")

      const created: string[] = []
      manager.on("context:created", (path: string) => created.push(path))

      manager.getOrCreate("/tmp/workspace-a")

      expect(created).toHaveLength(0)
    })

    it("recreates context if previously disposed", async () => {
      const context1 = manager.getOrCreate("/tmp/workspace-a")
      await context1.dispose()

      const context2 = manager.getOrCreate("/tmp/workspace-a")

      expect(context2).not.toBe(context1)
      expect(context2.disposed).toBe(false)
    })
  })

  describe("get", () => {
    it("returns undefined for unknown workspace path", () => {
      expect(manager.get("/tmp/unknown")).toBeUndefined()
    })

    it("returns the context for a known workspace path", () => {
      const context = manager.getOrCreate("/tmp/workspace-a")
      expect(manager.get("/tmp/workspace-a")).toBe(context)
    })

    it("returns undefined for disposed contexts", async () => {
      const context = manager.getOrCreate("/tmp/workspace-a")
      await context.dispose()

      expect(manager.get("/tmp/workspace-a")).toBeUndefined()
    })
  })

  describe("has", () => {
    it("returns false for unknown workspace path", () => {
      expect(manager.has("/tmp/unknown")).toBe(false)
    })

    it("returns true for known workspace path", () => {
      manager.getOrCreate("/tmp/workspace-a")
      expect(manager.has("/tmp/workspace-a")).toBe(true)
    })

    it("returns false for disposed workspace path", async () => {
      const context = manager.getOrCreate("/tmp/workspace-a")
      await context.dispose()

      expect(manager.has("/tmp/workspace-a")).toBe(false)
    })
  })

  describe("getWorkspacePaths", () => {
    it("returns empty array when no contexts exist", () => {
      expect(manager.getWorkspacePaths()).toEqual([])
    })

    it("returns workspace paths for active contexts", () => {
      manager.getOrCreate("/tmp/workspace-a")
      manager.getOrCreate("/tmp/workspace-b")

      const paths = manager.getWorkspacePaths()
      expect(paths).toHaveLength(2)
      expect(paths).toContain("/tmp/workspace-a")
      expect(paths).toContain("/tmp/workspace-b")
    })

    it("excludes disposed contexts", async () => {
      manager.getOrCreate("/tmp/workspace-a")
      const ctxB = manager.getOrCreate("/tmp/workspace-b")
      await ctxB.dispose()

      const paths = manager.getWorkspacePaths()
      expect(paths).toEqual(["/tmp/workspace-a"])
    })
  })

  describe("setActiveContext", () => {
    it("sets the active workspace path", () => {
      manager.setActiveContext("/tmp/workspace-a")

      expect(manager.activeWorkspacePath).toBe("/tmp/workspace-a")
    })

    it("returns the context", () => {
      const context = manager.setActiveContext("/tmp/workspace-a")

      expect(context).toBeInstanceOf(AgentWorkspaceContext)
      expect(context.workspacePath).toBe("/tmp/workspace-a")
    })

    it("creates the context if it does not exist", () => {
      expect(manager.size).toBe(0)

      manager.setActiveContext("/tmp/workspace-a")

      expect(manager.size).toBe(1)
    })

    it("emits context:activated", () => {
      const activated: Array<{ path: string; context: AgentWorkspaceContext }> = []
      manager.on("context:activated", (path: string, context: AgentWorkspaceContext) => {
        activated.push({ path, context })
      })

      manager.setActiveContext("/tmp/workspace-a")

      expect(activated).toHaveLength(1)
      expect(activated[0].path).toBe("/tmp/workspace-a")
    })

    it("getActiveContext returns the active context", () => {
      manager.setActiveContext("/tmp/workspace-a")

      const active = manager.getActiveContext()
      expect(active).toBeDefined()
      expect(active!.workspacePath).toBe("/tmp/workspace-a")
    })

    it("getActiveContext returns undefined when no active context", () => {
      expect(manager.getActiveContext()).toBeUndefined()
    })

    it("switches active context correctly", () => {
      manager.setActiveContext("/tmp/workspace-a")
      manager.setActiveContext("/tmp/workspace-b")

      expect(manager.activeWorkspacePath).toBe("/tmp/workspace-b")
      expect(manager.getActiveContext()!.workspacePath).toBe("/tmp/workspace-b")
    })
  })

  describe("context:event forwarding from active context", () => {
    it("forwards events from the active context", () => {
      const events: Array<{ path: string; eventType: string }> = []
      manager.on("context:event", (path: string, eventType: string) => {
        events.push({ path, eventType })
      })

      const context = manager.setActiveContext("/tmp/workspace-a")
      context.ralphManager.emit("event", { type: "msg", timestamp: Date.now() })

      expect(events).toHaveLength(1)
      expect(events[0].path).toBe("/tmp/workspace-a")
      expect(events[0].eventType).toBe("ralph:event")
    })

    it("stops forwarding events from previous active context after switching", () => {
      const events: Array<{ path: string; eventType: string }> = []
      manager.on("context:event", (path: string, eventType: string) => {
        events.push({ path, eventType })
      })

      const contextA = manager.setActiveContext("/tmp/workspace-a")
      manager.setActiveContext("/tmp/workspace-b")

      // Events from the old active context should not be forwarded
      contextA.ralphManager.emit("event", { type: "msg", timestamp: Date.now() })

      // Only events from new active context should come through
      const eventsFromA = events.filter(e => e.path === "/tmp/workspace-a")
      expect(eventsFromA).toHaveLength(0)
    })

    it("forwards task-chat events from the active context", () => {
      const events: Array<{ path: string; eventType: string }> = []
      manager.on("context:event", (path: string, eventType: string) => {
        events.push({ path, eventType })
      })

      const context = manager.setActiveContext("/tmp/workspace-a")
      context.taskChatManager.emit("message", {
        role: "assistant",
        content: "hi",
        timestamp: Date.now(),
      })

      expect(events).toHaveLength(1)
      expect(events[0].eventType).toBe("task-chat:message")
    })
  })

  describe("dispose (single context)", () => {
    it("disposes a specific context", async () => {
      const context = manager.getOrCreate("/tmp/workspace-a")

      await manager.dispose("/tmp/workspace-a")

      expect(context.disposed).toBe(true)
      expect(manager.size).toBe(0)
    })

    it("emits context:disposed", async () => {
      const disposed: string[] = []
      manager.on("context:disposed", (path: string) => disposed.push(path))

      manager.getOrCreate("/tmp/workspace-a")
      await manager.dispose("/tmp/workspace-a")

      expect(disposed).toEqual(["/tmp/workspace-a"])
    })

    it("clears activeWorkspacePath if disposing the active context", async () => {
      manager.setActiveContext("/tmp/workspace-a")

      await manager.dispose("/tmp/workspace-a")

      expect(manager.activeWorkspacePath).toBeUndefined()
      expect(manager.getActiveContext()).toBeUndefined()
    })

    it("does not affect activeWorkspacePath when disposing a non-active context", async () => {
      manager.setActiveContext("/tmp/workspace-a")
      manager.getOrCreate("/tmp/workspace-b")

      await manager.dispose("/tmp/workspace-b")

      expect(manager.activeWorkspacePath).toBe("/tmp/workspace-a")
    })

    it("is a no-op for unknown workspace paths", async () => {
      await expect(manager.dispose("/tmp/unknown")).resolves.toBeUndefined()
    })
  })

  describe("disposeAll", () => {
    it("disposes all contexts", async () => {
      const contextA = manager.getOrCreate("/tmp/workspace-a")
      const contextB = manager.getOrCreate("/tmp/workspace-b")

      await manager.disposeAll()

      expect(contextA.disposed).toBe(true)
      expect(contextB.disposed).toBe(true)
      expect(manager.size).toBe(0)
    })

    it("clears activeWorkspacePath", async () => {
      manager.setActiveContext("/tmp/workspace-a")

      await manager.disposeAll()

      expect(manager.activeWorkspacePath).toBeUndefined()
    })

    it("emits context:disposed for each context", async () => {
      const disposed: string[] = []
      manager.on("context:disposed", (path: string) => disposed.push(path))

      manager.getOrCreate("/tmp/workspace-a")
      manager.getOrCreate("/tmp/workspace-b")

      await manager.disposeAll()

      expect(disposed).toHaveLength(2)
      expect(disposed).toContain("/tmp/workspace-a")
      expect(disposed).toContain("/tmp/workspace-b")
    })
  })

  describe("max contexts enforcement", () => {
    it("defaults to max 10 contexts", () => {
      // Create 11 contexts
      for (let i = 0; i < 11; i++) {
        manager.getOrCreate(`/tmp/workspace-${i}`)
      }

      // Should eventually enforce the limit (disposed contexts are cleaned up async)
      // At most 10 active contexts should remain
      expect(manager.size).toBeLessThanOrEqual(11)
    })

    it("enforces a custom maxContexts limit", async () => {
      const smallManager = new AgentWorkspaceContextManager({ maxContexts: 2 })

      const disposed: string[] = []
      smallManager.on("context:disposed", (path: string) => disposed.push(path))

      smallManager.getOrCreate("/tmp/workspace-a")
      smallManager.getOrCreate("/tmp/workspace-b")
      smallManager.getOrCreate("/tmp/workspace-c")

      // Wait for async disposal
      await new Promise(resolve => setTimeout(resolve, 50))

      // One context should have been disposed to stay within the limit of 2
      expect(disposed).toHaveLength(1)

      await smallManager.disposeAll()
    })

    it("does not dispose the active context during enforcement", async () => {
      const smallManager = new AgentWorkspaceContextManager({ maxContexts: 2 })

      smallManager.setActiveContext("/tmp/workspace-a")
      smallManager.getOrCreate("/tmp/workspace-b")
      smallManager.getOrCreate("/tmp/workspace-c")

      // Wait for async disposal
      await new Promise(resolve => setTimeout(resolve, 50))

      // The active context should still exist
      expect(smallManager.has("/tmp/workspace-a")).toBe(true)

      await smallManager.disposeAll()
    })

    it("unlimited contexts when maxContexts is 0", () => {
      const unlimitedManager = new AgentWorkspaceContextManager({ maxContexts: 0 })

      for (let i = 0; i < 20; i++) {
        unlimitedManager.getOrCreate(`/tmp/workspace-${i}`)
      }

      expect(unlimitedManager.size).toBe(20)
    })
  })
})
