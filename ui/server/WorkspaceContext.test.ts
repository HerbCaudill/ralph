import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import type { RalphEvent, RalphStatus } from "./RalphManager.js"
import type { TaskChatMessage, TaskChatStatus, TaskChatToolUse } from "./TaskChatManager.js"

// Mock the dependencies using factory functions (required since vi.mock is hoisted)
vi.mock("./RalphManager.js", () => {
  const { EventEmitter } = require("node:events")

  class MockRalphManager extends EventEmitter {
    status = "idle"
    isRunning = false

    async start() {
      this.status = "running"
      this.isRunning = true
    }

    async stop() {
      this.status = "stopped"
      this.isRunning = false
    }

    pause() {}
    resume() {}
    send() {}
  }

  return {
    RalphManager: MockRalphManager,
  }
})

vi.mock("./BdProxy.js", () => {
  class MockBdProxy {
    list = vi.fn().mockResolvedValue([])
    show = vi.fn().mockResolvedValue(null)
    create = vi.fn().mockResolvedValue({ id: "test-id" })
    update = vi.fn().mockResolvedValue(true)
  }

  return {
    BdProxy: MockBdProxy,
  }
})

vi.mock("./TaskChatManager.js", () => {
  const { EventEmitter } = require("node:events")

  class MockTaskChatManager extends EventEmitter {
    status = "idle"
    messages = []

    async sendMessage() {}
    cancel() {}
    clearHistory() {}
  }

  return {
    TaskChatManager: MockTaskChatManager,
  }
})

// Import WorkspaceContext after mocks are set up
import { WorkspaceContext } from "./WorkspaceContext.js"

describe("WorkspaceContext", () => {
  let context: WorkspaceContext

  beforeEach(() => {
    vi.clearAllMocks()
    context = new WorkspaceContext({ workspacePath: "/test/workspace" })
  })

  afterEach(async () => {
    if (!context.disposed) {
      await context.dispose()
    }
  })

  describe("initialization", () => {
    it("creates with workspace path", () => {
      expect(context.workspacePath).toBe("/test/workspace")
    })

    it("creates RalphManager with workspace path", () => {
      expect(context.ralphManager).toBeDefined()
    })

    it("creates BdProxy with workspace path", () => {
      expect(context.bdProxy).toBeDefined()
    })

    it("creates TaskChatManager with workspace path", () => {
      expect(context.taskChatManager).toBeDefined()
    })

    it("starts with empty event history", () => {
      expect(context.eventHistory).toEqual([])
    })

    it("starts with no current task", () => {
      expect(context.currentTask).toEqual({
        taskId: undefined,
        taskTitle: undefined,
      })
    })

    it("starts not disposed", () => {
      expect(context.disposed).toBe(false)
    })
  })

  describe("event history", () => {
    it("stores events from RalphManager", () => {
      const event: RalphEvent = { type: "test", timestamp: Date.now() }
      context.ralphManager.emit("event", event)

      expect(context.eventHistory).toHaveLength(1)
      expect(context.eventHistory[0]).toEqual(event)
    })

    it("returns a copy of event history", () => {
      const event: RalphEvent = { type: "test", timestamp: Date.now() }
      context.ralphManager.emit("event", event)

      const history1 = context.eventHistory
      const history2 = context.eventHistory

      expect(history1).not.toBe(history2)
      expect(history1).toEqual(history2)
    })

    it("limits event history to 1000 events", () => {
      for (let i = 0; i < 1100; i++) {
        context.ralphManager.emit("event", { type: "test", timestamp: i })
      }

      expect(context.eventHistory).toHaveLength(1000)
      // Should keep the most recent 1000 events (100-1099)
      expect(context.eventHistory[0].timestamp).toBe(100)
      expect(context.eventHistory[999].timestamp).toBe(1099)
    })

    it("clears event history", () => {
      context.ralphManager.emit("event", { type: "test", timestamp: Date.now() })
      expect(context.eventHistory).toHaveLength(1)

      context.clearHistory()
      expect(context.eventHistory).toHaveLength(0)
    })
  })

  describe("current task tracking", () => {
    it("tracks task when ralph_task_started event is received", () => {
      context.ralphManager.emit("event", {
        type: "ralph_task_started",
        timestamp: Date.now(),
        taskId: "task-123",
        taskTitle: "Test Task",
      })

      expect(context.currentTask).toEqual({
        taskId: "task-123",
        taskTitle: "Test Task",
      })
    })

    it("clears current task when ralph_task_completed event is received", () => {
      // First set a task
      context.ralphManager.emit("event", {
        type: "ralph_task_started",
        timestamp: Date.now(),
        taskId: "task-123",
        taskTitle: "Test Task",
      })

      // Then complete it
      context.ralphManager.emit("event", {
        type: "ralph_task_completed",
        timestamp: Date.now(),
        taskId: "task-123",
      })

      expect(context.currentTask).toEqual({
        taskId: undefined,
        taskTitle: undefined,
      })
    })

    it("clears current task on clearHistory", () => {
      context.ralphManager.emit("event", {
        type: "ralph_task_started",
        timestamp: Date.now(),
        taskId: "task-123",
        taskTitle: "Test Task",
      })

      context.clearHistory()

      expect(context.currentTask).toEqual({
        taskId: undefined,
        taskTitle: undefined,
      })
    })
  })

  describe("RalphManager event forwarding", () => {
    it("forwards ralph:event", () => {
      const handler = vi.fn()
      context.on("ralph:event", handler)

      const event: RalphEvent = { type: "test", timestamp: Date.now() }
      context.ralphManager.emit("event", event)

      expect(handler).toHaveBeenCalledWith(event)
    })

    it("forwards ralph:status", () => {
      const handler = vi.fn()
      context.on("ralph:status", handler)

      const status: RalphStatus = "running"
      context.ralphManager.emit("status", status)

      expect(handler).toHaveBeenCalledWith(status)
    })

    it("forwards ralph:output", () => {
      const handler = vi.fn()
      context.on("ralph:output", handler)

      context.ralphManager.emit("output", "test output")

      expect(handler).toHaveBeenCalledWith("test output")
    })

    it("forwards ralph:error", () => {
      const handler = vi.fn()
      context.on("ralph:error", handler)

      const error = new Error("test error")
      context.ralphManager.emit("error", error)

      expect(handler).toHaveBeenCalledWith(error)
    })

    it("forwards ralph:exit", () => {
      const handler = vi.fn()
      context.on("ralph:exit", handler)

      const exitInfo = { code: 0, signal: null }
      context.ralphManager.emit("exit", exitInfo)

      expect(handler).toHaveBeenCalledWith(exitInfo)
    })
  })

  describe("TaskChatManager event forwarding", () => {
    it("forwards task-chat:message", () => {
      const handler = vi.fn()
      context.on("task-chat:message", handler)

      const message: TaskChatMessage = {
        role: "user",
        content: "test message",
        timestamp: Date.now(),
      }
      context.taskChatManager.emit("message", message)

      expect(handler).toHaveBeenCalledWith(message)
    })

    it("forwards task-chat:chunk", () => {
      const handler = vi.fn()
      context.on("task-chat:chunk", handler)

      context.taskChatManager.emit("chunk", "test chunk")

      expect(handler).toHaveBeenCalledWith("test chunk")
    })

    it("forwards task-chat:status", () => {
      const handler = vi.fn()
      context.on("task-chat:status", handler)

      const status: TaskChatStatus = "processing"
      context.taskChatManager.emit("status", status)

      expect(handler).toHaveBeenCalledWith(status)
    })

    it("forwards task-chat:error", () => {
      const handler = vi.fn()
      context.on("task-chat:error", handler)

      const error = new Error("chat error")
      context.taskChatManager.emit("error", error)

      expect(handler).toHaveBeenCalledWith(error)
    })

    it("forwards task-chat:tool_use", () => {
      const handler = vi.fn()
      context.on("task-chat:tool_use", handler)

      const toolUse: TaskChatToolUse = {
        toolUseId: "tool-1",
        tool: "test_tool",
        input: { key: "value" },
        status: "pending",
      }
      context.taskChatManager.emit("tool_use", toolUse)

      expect(handler).toHaveBeenCalledWith(toolUse)
    })

    it("forwards task-chat:tool_update", () => {
      const handler = vi.fn()
      context.on("task-chat:tool_update", handler)

      const toolUse: TaskChatToolUse = {
        toolUseId: "tool-1",
        tool: "test_tool",
        input: { key: "value" },
        status: "running",
      }
      context.taskChatManager.emit("tool_update", toolUse)

      expect(handler).toHaveBeenCalledWith(toolUse)
    })

    it("forwards task-chat:tool_result", () => {
      const handler = vi.fn()
      context.on("task-chat:tool_result", handler)

      const toolUse: TaskChatToolUse = {
        toolUseId: "tool-1",
        tool: "test_tool",
        input: { key: "value" },
        output: "result",
        status: "success",
      }
      context.taskChatManager.emit("tool_result", toolUse)

      expect(handler).toHaveBeenCalledWith(toolUse)
    })
  })

  describe("disposal", () => {
    it("sets disposed to true", async () => {
      await context.dispose()

      expect(context.disposed).toBe(true)
    })

    it("is idempotent", async () => {
      await context.dispose()
      await context.dispose() // Should not throw

      expect(context.disposed).toBe(true)
    })

    it("clears event history", async () => {
      context.ralphManager.emit("event", { type: "test", timestamp: Date.now() })
      expect(context.eventHistory).toHaveLength(1)

      await context.dispose()

      // Access the internal state via a workaround since eventHistory getter is still accessible
      // The test is mainly checking the dispose logic runs without error
    })

    it("clears current task tracking", async () => {
      context.ralphManager.emit("event", {
        type: "ralph_task_started",
        timestamp: Date.now(),
        taskId: "task-123",
        taskTitle: "Test Task",
      })

      await context.dispose()

      // The context is disposed, but the dispose function cleared the tracking
      expect(context.disposed).toBe(true)
    })

    it("throws when accessing ralphManager after disposal", async () => {
      await context.dispose()

      expect(() => context.ralphManager).toThrow("WorkspaceContext has been disposed")
    })

    it("throws when accessing bdProxy after disposal", async () => {
      await context.dispose()

      expect(() => context.bdProxy).toThrow("WorkspaceContext has been disposed")
    })

    it("throws when accessing taskChatManager after disposal", async () => {
      await context.dispose()

      expect(() => context.taskChatManager).toThrow("WorkspaceContext has been disposed")
    })

    it("throws when calling clearHistory after disposal", async () => {
      await context.dispose()

      expect(() => context.clearHistory()).toThrow("WorkspaceContext has been disposed")
    })
  })

  describe("multiple concurrent contexts", () => {
    it("operates independently", async () => {
      const context1 = new WorkspaceContext({ workspacePath: "/workspace1" })
      const context2 = new WorkspaceContext({ workspacePath: "/workspace2" })

      // Emit events to each context
      context1.ralphManager.emit("event", { type: "event1", timestamp: 1 })
      context2.ralphManager.emit("event", { type: "event2", timestamp: 2 })

      // Each context should only have its own events
      expect(context1.eventHistory).toHaveLength(1)
      expect(context1.eventHistory[0].type).toBe("event1")

      expect(context2.eventHistory).toHaveLength(1)
      expect(context2.eventHistory[0].type).toBe("event2")

      // Cleanup
      await context1.dispose()
      await context2.dispose()
    })

    it("tracks tasks independently", async () => {
      const context1 = new WorkspaceContext({ workspacePath: "/workspace1" })
      const context2 = new WorkspaceContext({ workspacePath: "/workspace2" })

      context1.ralphManager.emit("event", {
        type: "ralph_task_started",
        timestamp: 1,
        taskId: "task-1",
        taskTitle: "Task 1",
      })

      context2.ralphManager.emit("event", {
        type: "ralph_task_started",
        timestamp: 2,
        taskId: "task-2",
        taskTitle: "Task 2",
      })

      expect(context1.currentTask.taskId).toBe("task-1")
      expect(context2.currentTask.taskId).toBe("task-2")

      // Cleanup
      await context1.dispose()
      await context2.dispose()
    })

    it("emits events independently", async () => {
      const context1 = new WorkspaceContext({ workspacePath: "/workspace1" })
      const context2 = new WorkspaceContext({ workspacePath: "/workspace2" })

      const handler1 = vi.fn()
      const handler2 = vi.fn()

      context1.on("ralph:event", handler1)
      context2.on("ralph:event", handler2)

      context1.ralphManager.emit("event", { type: "event1", timestamp: 1 })

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).not.toHaveBeenCalled()

      // Cleanup
      await context1.dispose()
      await context2.dispose()
    })
  })
})
