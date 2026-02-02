import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  RalphRegistry,
  eventsToConversationContext,
  type CreateInstanceOptions,
} from ".././RalphRegistry.js"
import type { RalphEvent } from ".././RalphManager.js"

describe("RalphRegistry", () => {
  let registry: RalphRegistry

  const createOptions = (
    overrides: Partial<CreateInstanceOptions> = {},
  ): CreateInstanceOptions => ({
    id: "test-1",
    name: "TestInstance",
    agentName: "Ralph-1",
    worktreePath: null,
    workspaceId: null,
    branch: null,
    ...overrides,
  })

  beforeEach(() => {
    registry = new RalphRegistry({ maxInstances: 10 })
  })

  it("can be instantiated with default options", () => {
    const r = new RalphRegistry()
    expect(r).toBeInstanceOf(RalphRegistry)
    expect(r.size).toBe(0)
  })

  describe("create", () => {
    it("creates and registers a new instance", () => {
      const state = registry.create(createOptions())

      expect(state.id).toBe("test-1")
      expect(state.name).toBe("TestInstance")
      expect(state.agentName).toBe("Ralph-1")
      expect(state.manager).toBeDefined()
      expect(state.currentTaskId).toBeNull()
      expect(state.currentTaskTitle).toBeNull()
      expect(state.mergeConflict).toBeNull()
      expect(registry.size).toBe(1)
    })

    it("throws when creating a duplicate instance ID", () => {
      registry.create(createOptions())
      expect(() => registry.create(createOptions())).toThrow("already exists")
    })

    it("emits instance:created event", () => {
      const handler = vi.fn()
      registry.on("instance:created", handler)

      registry.create(createOptions())

      expect(handler).toHaveBeenCalledWith("test-1", expect.objectContaining({ id: "test-1" }))
    })
  })

  describe("get/has/getAll", () => {
    it("retrieves an instance by ID", () => {
      registry.create(createOptions())
      const state = registry.get("test-1")
      expect(state).toBeDefined()
      expect(state!.id).toBe("test-1")
    })

    it("returns undefined for non-existent instance", () => {
      expect(registry.get("nonexistent")).toBeUndefined()
    })

    it("checks if an instance exists", () => {
      registry.create(createOptions())
      expect(registry.has("test-1")).toBe(true)
      expect(registry.has("nonexistent")).toBe(false)
    })

    it("returns all instances", () => {
      registry.create(createOptions({ id: "a", name: "A", agentName: "Ralph-A" }))
      registry.create(createOptions({ id: "b", name: "B", agentName: "Ralph-B" }))

      const all = registry.getAll()
      expect(all).toHaveLength(2)
    })

    it("returns all instance IDs", () => {
      registry.create(createOptions({ id: "a", name: "A", agentName: "Ralph-A" }))
      registry.create(createOptions({ id: "b", name: "B", agentName: "Ralph-B" }))

      const ids = registry.getInstanceIds()
      expect(ids).toEqual(["a", "b"])
    })
  })

  describe("event history", () => {
    it("starts with empty event history", () => {
      registry.create(createOptions())
      const history = registry.getEventHistory("test-1")
      expect(history).toEqual([])
    })

    it("clears event history", () => {
      registry.create(createOptions())
      registry.clearEventHistory("test-1")
      expect(registry.getEventHistory("test-1")).toEqual([])
    })
  })

  describe("current task", () => {
    it("returns current task info", () => {
      registry.create(createOptions())
      const task = registry.getCurrentTask("test-1")
      expect(task).toEqual({ taskId: null, taskTitle: null })
    })

    it("returns undefined for non-existent instance", () => {
      expect(registry.getCurrentTask("nonexistent")).toBeUndefined()
    })
  })

  describe("merge conflicts", () => {
    it("sets and gets merge conflicts", () => {
      registry.create(createOptions())

      const conflict = {
        files: ["file1.ts", "file2.ts"],
        sourceBranch: "ralph/test-1",
        timestamp: Date.now(),
      }

      registry.setMergeConflict("test-1", conflict)
      expect(registry.getMergeConflict("test-1")).toEqual(conflict)

      registry.setMergeConflict("test-1", null)
      expect(registry.getMergeConflict("test-1")).toBeNull()
    })

    it("returns undefined for non-existent instance", () => {
      expect(registry.getMergeConflict("nonexistent")).toBeUndefined()
    })
  })

  describe("dispose", () => {
    it("removes an instance from the registry", async () => {
      registry.create(createOptions())
      expect(registry.size).toBe(1)

      await registry.dispose("test-1")
      expect(registry.size).toBe(0)
      expect(registry.get("test-1")).toBeUndefined()
    })

    it("emits instance:disposed event", async () => {
      const handler = vi.fn()
      registry.on("instance:disposed", handler)

      registry.create(createOptions())
      await registry.dispose("test-1")

      expect(handler).toHaveBeenCalledWith("test-1")
    })

    it("is a no-op for non-existent instance", async () => {
      await expect(registry.dispose("nonexistent")).resolves.toBeUndefined()
    })
  })

  describe("disposeAll", () => {
    it("removes all instances", async () => {
      registry.create(createOptions({ id: "a", name: "A", agentName: "Ralph-A" }))
      registry.create(createOptions({ id: "b", name: "B", agentName: "Ralph-B" }))
      expect(registry.size).toBe(2)

      await registry.disposeAll()
      expect(registry.size).toBe(0)
    })
  })

  describe("session state store", () => {
    it("can set and get a session state store", () => {
      expect(registry.getSessionStateStore()).toBeNull()

      const mockStore = { save: vi.fn(), load: vi.fn(), delete: vi.fn() } as any
      registry.setSessionStateStore(mockStore)
      expect(registry.getSessionStateStore()).toBe(mockStore)

      registry.setSessionStateStore(null)
      expect(registry.getSessionStateStore()).toBeNull()
    })
  })

  describe("session event persister", () => {
    it("can set and get a session event persister", () => {
      expect(registry.getSessionEventPersister()).toBeNull()

      const mockPersister = { appendEvent: vi.fn(), clear: vi.fn() } as any
      registry.setSessionEventPersister(mockPersister)
      expect(registry.getSessionEventPersister()).toBe(mockPersister)

      registry.setSessionEventPersister(null)
      expect(registry.getSessionEventPersister()).toBeNull()
    })
  })

  describe("bd proxy", () => {
    it("can set and get a bd proxy", () => {
      expect(registry.getBdProxy()).toBeNull()

      const mockProxy = { addComment: vi.fn() } as any
      registry.setBdProxy(mockProxy)
      expect(registry.getBdProxy()).toBe(mockProxy)

      registry.setBdProxy(null)
      expect(registry.getBdProxy()).toBeNull()
    })
  })
})

describe("eventsToConversationContext", () => {
  it("returns empty context for empty events", () => {
    const context = eventsToConversationContext([])
    expect(context.messages).toEqual([])
    expect(context.lastPrompt).toBeUndefined()
    expect(context.usage).toEqual({ inputTokens: 0, outputTokens: 0, totalTokens: 0 })
  })

  it("extracts user messages", () => {
    const events: RalphEvent[] = [{ type: "user_message", message: "hello", timestamp: 1000 }]

    const context = eventsToConversationContext(events)
    expect(context.messages).toHaveLength(1)
    expect(context.messages[0]).toEqual({
      role: "user",
      content: "hello",
      timestamp: 1000,
    })
    expect(context.lastPrompt).toBe("hello")
  })

  it("extracts normalized message events", () => {
    const events: RalphEvent[] = [
      { type: "message", content: "response text", isPartial: false, timestamp: 2000 },
    ]

    const context = eventsToConversationContext(events)
    expect(context.messages).toHaveLength(1)
    expect(context.messages[0].role).toBe("assistant")
    expect(context.messages[0].content).toBe("response text")
  })

  it("accumulates partial messages", () => {
    const events: RalphEvent[] = [
      { type: "message", content: "part1", isPartial: true, timestamp: 1000 },
      { type: "message", content: " part2", isPartial: true, timestamp: 1001 },
    ]

    const context = eventsToConversationContext(events)
    expect(context.messages).toHaveLength(1)
    expect(context.messages[0].content).toBe("part1 part2")
  })

  it("extracts tool use and tool result", () => {
    const events: RalphEvent[] = [
      {
        type: "tool_use",
        toolUseId: "tu-1",
        tool: "bash",
        input: { command: "ls" },
        timestamp: 1000,
      },
      {
        type: "tool_result",
        toolUseId: "tu-1",
        output: "file1.ts",
        isError: false,
        timestamp: 1001,
      },
    ]

    const context = eventsToConversationContext(events)
    expect(context.messages).toHaveLength(1)
    expect(context.messages[0].toolUses).toHaveLength(1)
    expect(context.messages[0].toolUses![0].name).toBe("bash")
    expect(context.messages[0].toolUses![0].result).toEqual({
      output: "file1.ts",
      error: undefined,
      isError: false,
    })
  })

  it("extracts usage from result events", () => {
    const events: RalphEvent[] = [
      {
        type: "result",
        usage: { input_tokens: 100, output_tokens: 50 },
        timestamp: 1000,
      },
    ]

    const context = eventsToConversationContext(events)
    expect(context.usage).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    })
  })

  it("flushes assistant content when user message arrives", () => {
    const events: RalphEvent[] = [
      { type: "message", content: "response1", isPartial: false, timestamp: 1000 },
      { type: "user_message", message: "follow up", timestamp: 2000 },
      { type: "message", content: "response2", isPartial: false, timestamp: 3000 },
    ]

    const context = eventsToConversationContext(events)
    expect(context.messages).toHaveLength(3)
    expect(context.messages[0].role).toBe("assistant")
    expect(context.messages[0].content).toBe("response1")
    expect(context.messages[1].role).toBe("user")
    expect(context.messages[1].content).toBe("follow up")
    expect(context.messages[2].role).toBe("assistant")
    expect(context.messages[2].content).toBe("response2")
  })
})
