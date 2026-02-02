import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { EventEmitter } from "node:events"
import { AgentWorkspaceContext } from "./AgentWorkspaceContext.js"
import type { RalphEvent } from "./RalphManager.js"

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

describe("AgentWorkspaceContext", () => {
  let context: AgentWorkspaceContext

  beforeEach(() => {
    context = new AgentWorkspaceContext({
      workspacePath: "/tmp/test-workspace",
    })
  })

  afterEach(async () => {
    if (!context.disposed) {
      await context.dispose()
    }
  })

  it("can be created with a workspace path", () => {
    expect(context).toBeInstanceOf(AgentWorkspaceContext)
    expect(context.workspacePath).toBe("/tmp/test-workspace")
    expect(context.disposed).toBe(false)
  })

  it("exposes ralphManager and taskChatManager", () => {
    expect(context.ralphManager).toBeDefined()
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

  describe("ralph event forwarding", () => {
    it("forwards ralph:event when RalphManager emits event", () => {
      const events: RalphEvent[] = []
      context.on("ralph:event", (e: RalphEvent) => events.push(e))

      const event: RalphEvent = { type: "message", timestamp: Date.now(), content: "hello" }
      context.ralphManager.emit("event", event)

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe("message")
    })

    it("forwards ralph:status when RalphManager emits status", () => {
      const statuses: string[] = []
      context.on("ralph:status", (s: string) => statuses.push(s))

      context.ralphManager.emit("status", "running")

      expect(statuses).toEqual(["running"])
    })

    it("forwards ralph:output when RalphManager emits output", () => {
      const outputs: string[] = []
      context.on("ralph:output", (line: string) => outputs.push(line))

      context.ralphManager.emit("output", "some output")

      expect(outputs).toEqual(["some output"])
    })

    it("forwards ralph:error when RalphManager emits error", () => {
      const errors: Error[] = []
      context.on("ralph:error", (e: Error) => errors.push(e))

      context.ralphManager.emit("error", new Error("test error"))

      expect(errors).toHaveLength(1)
      expect(errors[0].message).toBe("test error")
    })

    it("forwards ralph:exit when RalphManager emits exit", () => {
      const exits: Array<{ code: number | null; signal: string | null }> = []
      context.on("ralph:exit", (info: { code: number | null; signal: string | null }) =>
        exits.push(info),
      )

      context.ralphManager.emit("exit", { code: 0, signal: null })

      expect(exits).toHaveLength(1)
      expect(exits[0]).toEqual({ code: 0, signal: null })
    })
  })

  describe("task-chat event forwarding", () => {
    it("forwards task-chat:message when TaskChatManager emits message", () => {
      const messages: unknown[] = []
      context.on("task-chat:message", (m: unknown) => messages.push(m))

      context.taskChatManager.emit("message", {
        role: "assistant",
        content: "hello",
        timestamp: Date.now(),
      })

      expect(messages).toHaveLength(1)
    })

    it("forwards task-chat:chunk when TaskChatManager emits chunk", () => {
      const chunks: string[] = []
      context.on("task-chat:chunk", (text: string) => chunks.push(text))

      context.taskChatManager.emit("chunk", "text chunk")

      expect(chunks).toEqual(["text chunk"])
    })

    it("forwards task-chat:status when TaskChatManager emits status", () => {
      const statuses: string[] = []
      context.on("task-chat:status", (s: string) => statuses.push(s))

      context.taskChatManager.emit("status", "processing")

      expect(statuses).toEqual(["processing"])
    })

    it("forwards task-chat:error when TaskChatManager emits error", () => {
      const errors: Error[] = []
      context.on("task-chat:error", (e: Error) => errors.push(e))

      context.taskChatManager.emit("error", new Error("chat error"))

      expect(errors).toHaveLength(1)
      expect(errors[0].message).toBe("chat error")
    })

    it("forwards task-chat:tool_use when TaskChatManager emits tool_use", () => {
      const toolUses: unknown[] = []
      context.on("task-chat:tool_use", (t: unknown) => toolUses.push(t))

      context.taskChatManager.emit("tool_use", {
        toolUseId: "123",
        tool: "test_tool",
        input: {},
        status: "pending",
        timestamp: Date.now(),
        sequence: 0,
      })

      expect(toolUses).toHaveLength(1)
    })

    it("forwards task-chat:tool_update and task-chat:tool_result", () => {
      const updates: unknown[] = []
      const results: unknown[] = []
      context.on("task-chat:tool_update", (t: unknown) => updates.push(t))
      context.on("task-chat:tool_result", (t: unknown) => results.push(t))

      const toolUse = {
        toolUseId: "123",
        tool: "test",
        input: {},
        status: "running" as const,
        timestamp: Date.now(),
        sequence: 0,
      }

      context.taskChatManager.emit("tool_update", toolUse)
      context.taskChatManager.emit("tool_result", { ...toolUse, status: "success" })

      expect(updates).toHaveLength(1)
      expect(results).toHaveLength(1)
    })

    it("forwards task-chat:event when TaskChatManager emits event", () => {
      const events: unknown[] = []
      context.on("task-chat:event", (e: unknown) => events.push(e))

      context.taskChatManager.emit("event", { type: "stream_event", timestamp: Date.now() })

      expect(events).toHaveLength(1)
    })

    it("forwards task-chat:cleared when TaskChatManager emits historyCleared", () => {
      const cleared: boolean[] = []
      context.on("task-chat:cleared", () => cleared.push(true))

      context.taskChatManager.emit("historyCleared")

      expect(cleared).toHaveLength(1)
    })
  })

  describe("event history", () => {
    it("accumulates ralph events in history", () => {
      const event1: RalphEvent = { type: "message", timestamp: 1000 }
      const event2: RalphEvent = { type: "status", timestamp: 2000 }

      context.ralphManager.emit("event", event1)
      context.ralphManager.emit("event", event2)

      expect(context.eventHistory).toHaveLength(2)
      expect(context.eventHistory[0].type).toBe("message")
      expect(context.eventHistory[1].type).toBe("status")
    })

    it("returns a copy of event history (not a reference)", () => {
      const event: RalphEvent = { type: "test", timestamp: 1000 }
      context.ralphManager.emit("event", event)

      const history1 = context.eventHistory
      const history2 = context.eventHistory

      expect(history1).not.toBe(history2)
      expect(history1).toEqual(history2)
    })

    it("trims history when exceeding MAX_EVENT_HISTORY (1000)", () => {
      for (let i = 0; i < 1050; i++) {
        context.ralphManager.emit("event", { type: "msg", timestamp: i } as RalphEvent)
      }

      expect(context.eventHistory).toHaveLength(1000)
      // Should keep the most recent 1000 events
      expect(context.eventHistory[0].timestamp).toBe(50)
      expect(context.eventHistory[999].timestamp).toBe(1049)
    })

    it("clears history with clearHistory()", () => {
      context.ralphManager.emit("event", { type: "msg", timestamp: 1000 } as RalphEvent)
      expect(context.eventHistory).toHaveLength(1)

      context.clearHistory()

      expect(context.eventHistory).toHaveLength(0)
    })

    it("allows setting event history with setEventHistory()", () => {
      const events: RalphEvent[] = [
        { type: "a", timestamp: 1 },
        { type: "b", timestamp: 2 },
      ]

      context.setEventHistory(events)

      expect(context.eventHistory).toHaveLength(2)
      expect(context.eventHistory[0].type).toBe("a")
    })

    it("setEventHistory makes a defensive copy", () => {
      const events: RalphEvent[] = [{ type: "a", timestamp: 1 }]
      context.setEventHistory(events)

      events.push({ type: "b", timestamp: 2 })

      expect(context.eventHistory).toHaveLength(1)
    })
  })

  describe("current task tracking", () => {
    it("tracks current task on ralph_task_started event", () => {
      context.ralphManager.emit("event", {
        type: "ralph_task_started",
        timestamp: Date.now(),
        taskId: "task-1",
        taskTitle: "Fix bugs",
      } as RalphEvent)

      expect(context.currentTask).toEqual({
        taskId: "task-1",
        taskTitle: "Fix bugs",
      })
    })

    it("clears current task on ralph_task_completed event", () => {
      context.ralphManager.emit("event", {
        type: "ralph_task_started",
        timestamp: Date.now(),
        taskId: "task-1",
        taskTitle: "Fix bugs",
      } as RalphEvent)

      context.ralphManager.emit("event", {
        type: "ralph_task_completed",
        timestamp: Date.now(),
        taskId: "task-1",
      } as RalphEvent)

      expect(context.currentTask).toEqual({
        taskId: undefined,
        taskTitle: undefined,
      })
    })

    it("clearHistory also clears current task", () => {
      context.ralphManager.emit("event", {
        type: "ralph_task_started",
        timestamp: Date.now(),
        taskId: "task-1",
        taskTitle: "Fix bugs",
      } as RalphEvent)

      context.clearHistory()

      expect(context.currentTask).toEqual({
        taskId: undefined,
        taskTitle: undefined,
      })
    })
  })

  describe("dispose", () => {
    it("marks the context as disposed", async () => {
      await context.dispose()
      expect(context.disposed).toBe(true)
    })

    it("is idempotent (calling dispose twice does not throw)", async () => {
      await context.dispose()
      await context.dispose()
      expect(context.disposed).toBe(true)
    })

    it("throws when accessing ralphManager after dispose", async () => {
      await context.dispose()
      expect(() => context.ralphManager).toThrow("has been disposed")
    })

    it("throws when accessing taskChatManager after dispose", async () => {
      await context.dispose()
      expect(() => context.taskChatManager).toThrow("has been disposed")
    })

    it("throws when calling clearHistory after dispose", async () => {
      await context.dispose()
      expect(() => context.clearHistory()).toThrow("has been disposed")
    })

    it("throws when calling setEventHistory after dispose", async () => {
      await context.dispose()
      expect(() => context.setEventHistory([])).toThrow("has been disposed")
    })

    it("stops ralph manager if running during dispose", async () => {
      const rm = context.ralphManager as unknown as { _status: string; stop: ReturnType<typeof vi.fn> }
      rm._status = "running"

      await context.dispose()

      expect(rm.stop).toHaveBeenCalled()
    })

    it("stops ralph manager if paused during dispose", async () => {
      const rm = context.ralphManager as unknown as { _status: string; stop: ReturnType<typeof vi.fn> }
      rm._status = "paused"

      await context.dispose()

      expect(rm.stop).toHaveBeenCalled()
    })

    it("clears event history on dispose", async () => {
      context.ralphManager.emit("event", { type: "msg", timestamp: 1000 } as RalphEvent)
      expect(context.eventHistory).toHaveLength(1)

      await context.dispose()

      // eventHistory getter does not throw since it doesn't use assertNotDisposed
      // but internal history should be cleared
      expect(context.eventHistory).toHaveLength(0)
    })
  })

  describe("taskChatEventLog", () => {
    it("is null when enableTaskChatLogging is not set", () => {
      expect(context.taskChatEventLog).toBeNull()
    })

    it("is created when enableTaskChatLogging is true", () => {
      const ctx = new AgentWorkspaceContext({
        workspacePath: "/tmp/test",
        enableTaskChatLogging: true,
      })
      expect(ctx.taskChatEventLog).not.toBeNull()
    })
  })

  describe("taskChatEventPersister", () => {
    it("is always created", () => {
      expect(context.taskChatEventPersister).toBeDefined()
    })

    it("persists task-chat events via appendEvent", () => {
      const persister = context.taskChatEventPersister as unknown as {
        appendEvent: ReturnType<typeof vi.fn>
      }

      context.taskChatManager.emit("event", { type: "test", timestamp: Date.now() })

      expect(persister.appendEvent).toHaveBeenCalledWith("default", expect.objectContaining({ type: "test" }))
    })

    it("clears persisted events on historyCleared", () => {
      const persister = context.taskChatEventPersister as unknown as {
        clear: ReturnType<typeof vi.fn>
      }

      context.taskChatManager.emit("historyCleared")

      expect(persister.clear).toHaveBeenCalledWith("default")
    })
  })
})
