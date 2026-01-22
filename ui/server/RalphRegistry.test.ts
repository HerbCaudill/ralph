import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { EventEmitter } from "node:events"
import { RalphRegistry, type CreateInstanceOptions } from "./RalphRegistry.js"
import type { RalphStatus } from "./RalphManager.js"

// Mock the RalphManager to avoid spawning real processes
vi.mock("./RalphManager.js", async () => {
  const { EventEmitter } = await import("node:events")

  class MockRalphManager extends EventEmitter {
    private _status: RalphStatus = "stopped"
    options: { cwd: string; watch?: boolean; env?: Record<string, string> }

    constructor(options: { cwd?: string; watch?: boolean; env?: Record<string, string> } = {}) {
      super()
      this.options = {
        cwd: options.cwd ?? process.cwd(),
        watch: options.watch,
        env: options.env,
      }
    }

    get status(): RalphStatus {
      return this._status
    }

    get isRunning(): boolean {
      return this._status === "running"
    }

    async start(): Promise<void> {
      this._status = "running"
      this.emit("status", this._status)
    }

    async stop(): Promise<void> {
      this._status = "stopped"
      this.emit("status", this._status)
      this.emit("exit", { code: 0, signal: null })
    }

    pause(): void {
      this._status = "paused"
      this.emit("status", this._status)
    }

    resume(): void {
      this._status = "running"
      this.emit("status", this._status)
    }

    // Test helper to simulate events
    simulateEvent(event: { type: string; timestamp: number; [key: string]: unknown }): void {
      this.emit("event", event)
    }

    simulateOutput(line: string): void {
      this.emit("output", line)
    }

    simulateError(error: Error): void {
      this.emit("error", error)
    }
  }

  return {
    RalphManager: MockRalphManager,
  }
})

describe("RalphRegistry", () => {
  let registry: RalphRegistry

  const createTestOptions = (
    overrides: Partial<CreateInstanceOptions> = {},
  ): CreateInstanceOptions => ({
    id: "test-instance",
    name: "Test Instance",
    agentName: "Ralph-1",
    worktreePath: null,
    branch: "main",
    ...overrides,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    registry = new RalphRegistry()
  })

  afterEach(async () => {
    await registry.disposeAll()
  })

  describe("create", () => {
    it("creates a new instance with the given options", () => {
      const state = registry.create(createTestOptions())

      expect(state.id).toBe("test-instance")
      expect(state.name).toBe("Test Instance")
      expect(state.agentName).toBe("Ralph-1")
      expect(state.worktreePath).toBeNull()
      expect(state.branch).toBe("main")
      expect(state.manager).toBeDefined()
      expect(state.createdAt).toBeLessThanOrEqual(Date.now())
    })

    it("creates RalphManager with worktree path as cwd when provided", () => {
      const state = registry.create(
        createTestOptions({
          worktreePath: "/path/to/worktree",
        }),
      )

      // The mock stores options for inspection
      const managerOptions = (state.manager as unknown as { options: { cwd: string } }).options
      expect(managerOptions.cwd).toBe("/path/to/worktree")
    })

    it("throws error if instance ID already exists", () => {
      registry.create(createTestOptions())

      expect(() => registry.create(createTestOptions())).toThrow(
        "Instance with ID 'test-instance' already exists",
      )
    })

    it("emits instance:created event", () => {
      const createdHandler = vi.fn()
      registry.on("instance:created", createdHandler)

      const state = registry.create(createTestOptions())

      expect(createdHandler).toHaveBeenCalledWith("test-instance", state)
    })

    it("initializes event history for the instance", () => {
      registry.create(createTestOptions())

      const history = registry.getEventHistory("test-instance")
      expect(history).toEqual([])
    })

    it("passes manager options to RalphManager", () => {
      const state = registry.create(
        createTestOptions({
          managerOptions: { watch: true, env: { TEST: "value" } },
        }),
      )

      const managerOptions = (
        state.manager as unknown as { options: { watch?: boolean; env?: Record<string, string> } }
      ).options
      expect(managerOptions.watch).toBe(true)
      expect(managerOptions.env).toEqual({ TEST: "value" })
    })
  })

  describe("get", () => {
    it("returns undefined for non-existent instance", () => {
      expect(registry.get("nonexistent")).toBeUndefined()
    })

    it("returns the instance state if it exists", () => {
      registry.create(createTestOptions())

      const state = registry.get("test-instance")

      expect(state).toBeDefined()
      expect(state!.id).toBe("test-instance")
    })
  })

  describe("has", () => {
    it("returns false for non-existent instance", () => {
      expect(registry.has("nonexistent")).toBe(false)
    })

    it("returns true for existing instance", () => {
      registry.create(createTestOptions())

      expect(registry.has("test-instance")).toBe(true)
    })
  })

  describe("getInstanceIds", () => {
    it("returns empty array when no instances exist", () => {
      expect(registry.getInstanceIds()).toEqual([])
    })

    it("returns all instance IDs", () => {
      registry.create(createTestOptions({ id: "instance-1" }))
      registry.create(createTestOptions({ id: "instance-2" }))

      const ids = registry.getInstanceIds()

      expect(ids).toHaveLength(2)
      expect(ids).toContain("instance-1")
      expect(ids).toContain("instance-2")
    })
  })

  describe("getAll", () => {
    it("returns empty array when no instances exist", () => {
      expect(registry.getAll()).toEqual([])
    })

    it("returns all instance states", () => {
      registry.create(createTestOptions({ id: "instance-1", name: "Instance 1" }))
      registry.create(createTestOptions({ id: "instance-2", name: "Instance 2" }))

      const states = registry.getAll()

      expect(states).toHaveLength(2)
      expect(states.map(s => s.name)).toContain("Instance 1")
      expect(states.map(s => s.name)).toContain("Instance 2")
    })
  })

  describe("size", () => {
    it("returns 0 when no instances exist", () => {
      expect(registry.size).toBe(0)
    })

    it("returns the correct count of instances", () => {
      registry.create(createTestOptions({ id: "instance-1" }))
      registry.create(createTestOptions({ id: "instance-2" }))

      expect(registry.size).toBe(2)
    })
  })

  describe("getEventHistory", () => {
    it("returns empty array for non-existent instance", () => {
      expect(registry.getEventHistory("nonexistent")).toEqual([])
    })

    it("returns events recorded for the instance", () => {
      const state = registry.create(createTestOptions())
      const event = { type: "test_event", timestamp: Date.now() }

      // Simulate an event from the manager
      ;(state.manager as unknown as { simulateEvent: (e: typeof event) => void }).simulateEvent(
        event,
      )

      const history = registry.getEventHistory("test-instance")
      expect(history).toHaveLength(1)
      expect(history[0]).toEqual(event)
    })

    it("returns a copy of the history array", () => {
      registry.create(createTestOptions())

      const history1 = registry.getEventHistory("test-instance")
      const history2 = registry.getEventHistory("test-instance")

      expect(history1).not.toBe(history2)
    })
  })

  describe("clearEventHistory", () => {
    it("does nothing for non-existent instance", () => {
      expect(() => registry.clearEventHistory("nonexistent")).not.toThrow()
    })

    it("clears the event history for the instance", () => {
      const state = registry.create(createTestOptions())
      const event = { type: "test_event", timestamp: Date.now() }
      ;(state.manager as unknown as { simulateEvent: (e: typeof event) => void }).simulateEvent(
        event,
      )

      registry.clearEventHistory("test-instance")

      expect(registry.getEventHistory("test-instance")).toEqual([])
    })
  })

  describe("getCurrentTask", () => {
    it("returns undefined for non-existent instance", () => {
      expect(registry.getCurrentTask("nonexistent")).toBeUndefined()
    })

    it("returns null task info initially", () => {
      registry.create(createTestOptions())

      const task = registry.getCurrentTask("test-instance")

      expect(task).toEqual({ taskId: null, taskTitle: null })
    })

    it("tracks current task from ralph_task_started event", () => {
      const state = registry.create(createTestOptions())
      const event = {
        type: "ralph_task_started",
        timestamp: Date.now(),
        taskId: "task-123",
        taskTitle: "Fix the bug",
      }
      ;(state.manager as unknown as { simulateEvent: (e: typeof event) => void }).simulateEvent(
        event,
      )

      const task = registry.getCurrentTask("test-instance")

      expect(task).toEqual({ taskId: "task-123", taskTitle: "Fix the bug" })
    })

    it("clears current task on ralph_task_completed event", () => {
      const state = registry.create(createTestOptions())
      const startEvent = {
        type: "ralph_task_started",
        timestamp: Date.now(),
        taskId: "task-123",
        taskTitle: "Fix the bug",
      }
      const completeEvent = {
        type: "ralph_task_completed",
        timestamp: Date.now(),
        taskId: "task-123",
      }

      const simulateEvent = (
        state.manager as unknown as {
          simulateEvent: (e: typeof startEvent | typeof completeEvent) => void
        }
      ).simulateEvent.bind(state.manager)
      simulateEvent(startEvent)
      simulateEvent(completeEvent)

      const task = registry.getCurrentTask("test-instance")

      expect(task).toEqual({ taskId: null, taskTitle: null })
    })
  })

  describe("dispose", () => {
    it("does nothing for non-existent instance", async () => {
      await expect(registry.dispose("nonexistent")).resolves.toBeUndefined()
    })

    it("stops the RalphManager if running", async () => {
      const state = registry.create(createTestOptions())
      await state.manager.start()
      const stopSpy = vi.spyOn(state.manager, "stop")

      await registry.dispose("test-instance")

      expect(stopSpy).toHaveBeenCalled()
    })

    it("removes the instance from the registry", async () => {
      registry.create(createTestOptions())

      await registry.dispose("test-instance")

      expect(registry.has("test-instance")).toBe(false)
    })

    it("removes event history for the instance", async () => {
      const state = registry.create(createTestOptions())
      const event = { type: "test_event", timestamp: Date.now() }
      ;(state.manager as unknown as { simulateEvent: (e: typeof event) => void }).simulateEvent(
        event,
      )

      await registry.dispose("test-instance")

      expect(registry.getEventHistory("test-instance")).toEqual([])
    })

    it("emits instance:disposed event", async () => {
      const disposedHandler = vi.fn()
      registry.on("instance:disposed", disposedHandler)
      registry.create(createTestOptions())

      await registry.dispose("test-instance")

      expect(disposedHandler).toHaveBeenCalledWith("test-instance")
    })

    it("removes all listeners from the manager", async () => {
      const state = registry.create(createTestOptions())
      const removeAllListenersSpy = vi.spyOn(state.manager, "removeAllListeners")

      await registry.dispose("test-instance")

      expect(removeAllListenersSpy).toHaveBeenCalled()
    })
  })

  describe("disposeAll", () => {
    it("disposes all instances", async () => {
      registry.create(createTestOptions({ id: "instance-1" }))
      registry.create(createTestOptions({ id: "instance-2" }))

      await registry.disposeAll()

      expect(registry.size).toBe(0)
    })

    it("emits instance:disposed for each instance", async () => {
      const disposedHandler = vi.fn()
      registry.on("instance:disposed", disposedHandler)
      registry.create(createTestOptions({ id: "instance-1" }))
      registry.create(createTestOptions({ id: "instance-2" }))

      await registry.disposeAll()

      expect(disposedHandler).toHaveBeenCalledTimes(2)
    })
  })

  describe("event forwarding", () => {
    it("forwards ralph:event from instances", () => {
      const eventHandler = vi.fn()
      registry.on("instance:event", eventHandler)

      const state = registry.create(createTestOptions())
      const event = { type: "test_event", timestamp: Date.now() }
      ;(state.manager as unknown as { simulateEvent: (e: typeof event) => void }).simulateEvent(
        event,
      )

      expect(eventHandler).toHaveBeenCalledWith("test-instance", "ralph:event", event)
    })

    it("forwards ralph:status from instances", async () => {
      const eventHandler = vi.fn()
      registry.on("instance:event", eventHandler)

      const state = registry.create(createTestOptions())
      await state.manager.start()

      expect(eventHandler).toHaveBeenCalledWith("test-instance", "ralph:status", "running")
    })

    it("forwards ralph:output from instances", () => {
      const eventHandler = vi.fn()
      registry.on("instance:event", eventHandler)

      const state = registry.create(createTestOptions())
      ;(state.manager as unknown as { simulateOutput: (line: string) => void }).simulateOutput(
        "test output",
      )

      expect(eventHandler).toHaveBeenCalledWith("test-instance", "ralph:output", "test output")
    })

    it("forwards ralph:error from instances", () => {
      const eventHandler = vi.fn()
      registry.on("instance:event", eventHandler)

      const state = registry.create(createTestOptions())
      const error = new Error("test error")
      ;(state.manager as unknown as { simulateError: (e: Error) => void }).simulateError(error)

      expect(eventHandler).toHaveBeenCalledWith("test-instance", "ralph:error", error)
    })

    it("forwards ralph:exit from instances", async () => {
      const eventHandler = vi.fn()
      registry.on("instance:event", eventHandler)

      const state = registry.create(createTestOptions())
      await state.manager.start()
      await state.manager.stop()

      expect(eventHandler).toHaveBeenCalledWith("test-instance", "ralph:exit", {
        code: 0,
        signal: null,
      })
    })

    it("includes instance ID in forwarded events", () => {
      const eventHandler = vi.fn()
      registry.on("instance:event", eventHandler)

      const state = registry.create(createTestOptions({ id: "my-instance" }))
      const event = { type: "test_event", timestamp: Date.now() }
      ;(state.manager as unknown as { simulateEvent: (e: typeof event) => void }).simulateEvent(
        event,
      )

      expect(eventHandler.mock.calls[0][0]).toBe("my-instance")
    })
  })

  describe("maxInstances limit", () => {
    it("respects maxInstances limit", async () => {
      const limitedRegistry = new RalphRegistry({ maxInstances: 2 })

      limitedRegistry.create(createTestOptions({ id: "instance-1" }))
      limitedRegistry.create(createTestOptions({ id: "instance-2" }))
      limitedRegistry.create(createTestOptions({ id: "instance-3" }))

      // Wait for async dispose to complete
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(limitedRegistry.size).toBeLessThanOrEqual(2)

      await limitedRegistry.disposeAll()
    })

    it("prefers disposing stopped instances over running ones", async () => {
      const limitedRegistry = new RalphRegistry({ maxInstances: 2 })

      const state1 = limitedRegistry.create(createTestOptions({ id: "instance-1" }))
      await state1.manager.start() // Running

      limitedRegistry.create(createTestOptions({ id: "instance-2" })) // Stopped

      limitedRegistry.create(createTestOptions({ id: "instance-3" }))

      // Wait for async dispose to complete
      await new Promise(resolve => setTimeout(resolve, 10))

      // instance-2 should be disposed because it was stopped
      expect(limitedRegistry.has("instance-1")).toBe(true) // Was running
      expect(limitedRegistry.has("instance-2")).toBe(false) // Was stopped, should be disposed
      expect(limitedRegistry.has("instance-3")).toBe(true) // Newest

      await limitedRegistry.disposeAll()
    })

    it("allows unlimited instances when maxInstances is 0", () => {
      const unlimitedRegistry = new RalphRegistry({ maxInstances: 0 })

      for (let i = 0; i < 20; i++) {
        unlimitedRegistry.create(createTestOptions({ id: `instance-${i}` }))
      }

      expect(unlimitedRegistry.size).toBe(20)

      // Don't need to await disposeAll since no managers were started
      unlimitedRegistry.disposeAll()
    })
  })

  describe("event history limit", () => {
    it("limits event history to MAX_EVENT_HISTORY events", () => {
      const state = registry.create(createTestOptions())
      const simulateEvent = (
        state.manager as unknown as {
          simulateEvent: (e: { type: string; timestamp: number }) => void
        }
      ).simulateEvent.bind(state.manager)

      // Add more than MAX_EVENT_HISTORY events
      for (let i = 0; i < 1100; i++) {
        simulateEvent({ type: `event_${i}`, timestamp: Date.now() })
      }

      const history = registry.getEventHistory("test-instance")

      // Should be trimmed to MAX_EVENT_HISTORY (1000)
      expect(history.length).toBe(1000)

      // Should keep the newest events
      expect(history[0].type).toBe("event_100")
      expect(history[999].type).toBe("event_1099")
    })
  })
})
