import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { EventEmitter } from "node:events"
import {
  RalphRegistry,
  type CreateInstanceOptions,
  eventsToConversationContext,
} from "./RalphRegistry.js"
import type { RalphStatus } from "./RalphManager.js"
import type { IterationStateStore, PersistedIterationState } from "./IterationStateStore.js"

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

  /**
   * Create test options for creating a registry instance with optional overrides.
   */
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

      // Wait for async save to complete before exit is emitted
      await new Promise(resolve => setTimeout(resolve, 20))

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

  describe("iteration state persistence", () => {
    /**
     * Create a mock IterationStateStore for testing iteration state persistence.
     */
    function createMockStore(): IterationStateStore & {
      savedStates: Map<string, PersistedIterationState>
      saveCalls: PersistedIterationState[]
      deleteCalls: string[]
      loadCalls: string[]
    } {
      const savedStates = new Map<string, PersistedIterationState>()
      const saveCalls: PersistedIterationState[] = []
      const deleteCalls: string[] = []
      const loadCalls: string[] = []

      return {
        savedStates,
        saveCalls,
        deleteCalls,
        loadCalls,
        getWorkspacePath: () => "/test/workspace",
        getStoreDir: () => "/test/workspace/.ralph/iterations",
        exists: async () => true,
        has: async (instanceId: string) => savedStates.has(instanceId),
        load: async (instanceId: string) => {
          loadCalls.push(instanceId)
          return savedStates.get(instanceId) ?? null
        },
        save: async (state: PersistedIterationState) => {
          saveCalls.push(state)
          savedStates.set(state.instanceId, state)
        },
        delete: async (instanceId: string) => {
          deleteCalls.push(instanceId)
          return savedStates.delete(instanceId)
        },
        getAll: async () => Array.from(savedStates.values()),
        getAllInstanceIds: async () => Array.from(savedStates.keys()),
        count: async () => savedStates.size,
        cleanupStale: async () => 0,
        clear: async () => savedStates.clear(),
      }
    }

    describe("setIterationStateStore and getIterationStateStore", () => {
      it("can set and get the iteration state store", () => {
        const mockStore = createMockStore()

        registry.setIterationStateStore(mockStore)

        expect(registry.getIterationStateStore()).toBe(mockStore)
      })

      it("can set store to null to disable persistence", () => {
        const mockStore = createMockStore()

        registry.setIterationStateStore(mockStore)
        registry.setIterationStateStore(null)

        expect(registry.getIterationStateStore()).toBeNull()
      })

      it("can pass store in constructor options", () => {
        const mockStore = createMockStore()
        const registryWithStore = new RalphRegistry({ iterationStateStore: mockStore })

        expect(registryWithStore.getIterationStateStore()).toBe(mockStore)
      })
    })

    describe("saveIterationState", () => {
      it("does nothing when no store is configured", async () => {
        registry.create(createTestOptions())

        // Should not throw
        await expect(registry.saveIterationState("test-instance")).resolves.toBeUndefined()
      })

      it("does nothing for non-existent instance", async () => {
        const mockStore = createMockStore()
        registry.setIterationStateStore(mockStore)

        await registry.saveIterationState("nonexistent")

        expect(mockStore.saveCalls).toHaveLength(0)
      })

      it("saves iteration state for an instance", async () => {
        const mockStore = createMockStore()
        registry.setIterationStateStore(mockStore)

        const state = registry.create(createTestOptions())
        await state.manager.start()

        await registry.saveIterationState("test-instance")

        expect(mockStore.saveCalls).toHaveLength(1)
        expect(mockStore.saveCalls[0].instanceId).toBe("test-instance")
        expect(mockStore.saveCalls[0].status).toBe("running")
      })

      it("includes conversation context derived from event history", async () => {
        const mockStore = createMockStore()
        registry.setIterationStateStore(mockStore)

        const state = registry.create(createTestOptions())
        const simulateEvent = (
          state.manager as unknown as {
            simulateEvent: (e: { type: string; timestamp: number; [k: string]: unknown }) => void
          }
        ).simulateEvent.bind(state.manager)

        // Simulate a conversation
        simulateEvent({ type: "user_message", timestamp: 1000, message: "Hello" })
        simulateEvent({ type: "message", timestamp: 2000, content: "Hi there!" })

        await registry.saveIterationState("test-instance")

        expect(mockStore.saveCalls).toHaveLength(1)
        const context = mockStore.saveCalls[0].conversationContext
        expect(context.messages).toHaveLength(2)
        expect(context.lastPrompt).toBe("Hello")
      })
    })

    describe("deleteIterationState", () => {
      it("returns false when no store is configured", async () => {
        const result = await registry.deleteIterationState("test-instance")
        expect(result).toBe(false)
      })

      it("returns true when state is deleted", async () => {
        const mockStore = createMockStore()
        mockStore.savedStates.set("test-instance", {
          instanceId: "test-instance",
          conversationContext: {
            messages: [],
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            timestamp: Date.now(),
          },
          status: "running",
          currentTaskId: null,
          savedAt: Date.now(),
          version: 1,
        })
        registry.setIterationStateStore(mockStore)

        const result = await registry.deleteIterationState("test-instance")

        expect(result).toBe(true)
        expect(mockStore.deleteCalls).toContain("test-instance")
      })

      it("returns false when state does not exist", async () => {
        const mockStore = createMockStore()
        registry.setIterationStateStore(mockStore)

        const result = await registry.deleteIterationState("nonexistent")

        expect(result).toBe(false)
      })
    })

    describe("loadIterationState", () => {
      it("returns null when no store is configured", async () => {
        const result = await registry.loadIterationState("test-instance")
        expect(result).toBeNull()
      })

      it("returns saved state when it exists", async () => {
        const mockStore = createMockStore()
        const savedState: PersistedIterationState = {
          instanceId: "test-instance",
          conversationContext: {
            messages: [{ role: "user", content: "Hello", timestamp: 1000 }],
            lastPrompt: "Hello",
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            timestamp: Date.now(),
          },
          status: "running",
          currentTaskId: "task-123",
          savedAt: Date.now(),
          version: 1,
        }
        mockStore.savedStates.set("test-instance", savedState)
        registry.setIterationStateStore(mockStore)

        const result = await registry.loadIterationState("test-instance")

        expect(result).toEqual(savedState)
      })

      it("returns null when state does not exist", async () => {
        const mockStore = createMockStore()
        registry.setIterationStateStore(mockStore)

        const result = await registry.loadIterationState("nonexistent")

        expect(result).toBeNull()
      })
    })

    describe("saveAllIterationStates", () => {
      it("does nothing when no store is configured", async () => {
        registry.create(createTestOptions({ id: "instance-1" }))

        await expect(registry.saveAllIterationStates()).resolves.toBeUndefined()
      })

      it("saves state for all running instances", async () => {
        const mockStore = createMockStore()
        registry.setIterationStateStore(mockStore)

        const state1 = registry.create(createTestOptions({ id: "instance-1" }))
        const state2 = registry.create(createTestOptions({ id: "instance-2" }))
        registry.create(createTestOptions({ id: "instance-3" })) // Stopped

        await state1.manager.start()
        await state2.manager.start()

        await registry.saveAllIterationStates()

        expect(mockStore.saveCalls.map(s => s.instanceId).sort()).toEqual([
          "instance-1",
          "instance-2",
        ])
      })

      it("includes paused instances", async () => {
        const mockStore = createMockStore()
        registry.setIterationStateStore(mockStore)

        const state1 = registry.create(createTestOptions({ id: "instance-1" }))
        await state1.manager.start()
        state1.manager.pause() // Now paused - this triggers auto-save

        // Wait for auto-save from pause
        await new Promise(resolve => setTimeout(resolve, 10))
        mockStore.saveCalls.length = 0 // Clear auto-saves

        await registry.saveAllIterationStates()

        // Should have exactly one save from saveAllIterationStates
        expect(mockStore.saveCalls).toHaveLength(1)
        expect(mockStore.saveCalls[0].instanceId).toBe("instance-1")
      })
    })

    describe("auto-save on events", () => {
      it("auto-saves on result event", async () => {
        const mockStore = createMockStore()
        registry.setIterationStateStore(mockStore)

        const state = registry.create(createTestOptions())
        const simulateEvent = (
          state.manager as unknown as {
            simulateEvent: (e: { type: string; timestamp: number; [k: string]: unknown }) => void
          }
        ).simulateEvent.bind(state.manager)

        simulateEvent({ type: "result", timestamp: Date.now() })

        // Wait for async save
        await new Promise(resolve => setTimeout(resolve, 10))

        expect(mockStore.saveCalls.length).toBeGreaterThan(0)
      })

      it("auto-saves on ralph_task_completed event", async () => {
        const mockStore = createMockStore()
        registry.setIterationStateStore(mockStore)

        const state = registry.create(createTestOptions())
        const simulateEvent = (
          state.manager as unknown as {
            simulateEvent: (e: { type: string; timestamp: number; [k: string]: unknown }) => void
          }
        ).simulateEvent.bind(state.manager)

        simulateEvent({ type: "ralph_task_completed", timestamp: Date.now(), taskId: "task-1" })

        // Wait for async save
        await new Promise(resolve => setTimeout(resolve, 10))

        expect(mockStore.saveCalls.length).toBeGreaterThan(0)
      })

      it("auto-saves on status change to paused", async () => {
        const mockStore = createMockStore()
        registry.setIterationStateStore(mockStore)

        const state = registry.create(createTestOptions())
        await state.manager.start()
        mockStore.saveCalls.length = 0 // Clear saves from start

        state.manager.pause()

        // Wait for async save
        await new Promise(resolve => setTimeout(resolve, 10))

        expect(mockStore.saveCalls.length).toBeGreaterThan(0)
      })
    })

    describe("auto-save on dispose", () => {
      it("saves state before stopping running instance", async () => {
        const mockStore = createMockStore()
        registry.setIterationStateStore(mockStore)

        const state = registry.create(createTestOptions())
        await state.manager.start()
        mockStore.saveCalls.length = 0 // Clear any saves from start

        await registry.dispose("test-instance")

        // Should have saved state before stopping
        expect(mockStore.saveCalls.length).toBeGreaterThan(0)
        expect(mockStore.saveCalls[0].instanceId).toBe("test-instance")
      })
    })
  })
})

describe("eventsToConversationContext", () => {
  it("converts user_message events to user messages", () => {
    const events = [{ type: "user_message", timestamp: 1000, message: "Hello" }]

    const context = eventsToConversationContext(events)

    expect(context.messages).toHaveLength(1)
    expect(context.messages[0]).toEqual({
      role: "user",
      content: "Hello",
      timestamp: 1000,
    })
    expect(context.lastPrompt).toBe("Hello")
  })

  it("converts message events to assistant messages", () => {
    const events = [
      { type: "user_message", timestamp: 1000, message: "Hello" },
      { type: "message", timestamp: 2000, content: "Hi there!", isPartial: false },
    ]

    const context = eventsToConversationContext(events)

    expect(context.messages).toHaveLength(2)
    expect(context.messages[1]).toEqual({
      role: "assistant",
      content: "Hi there!",
      timestamp: 2000,
    })
  })

  it("accumulates partial messages", () => {
    const events = [
      { type: "user_message", timestamp: 1000, message: "Hello" },
      { type: "message", timestamp: 2000, content: "Hi ", isPartial: true },
      { type: "message", timestamp: 2100, content: "there!", isPartial: true },
    ]

    const context = eventsToConversationContext(events)

    // Should have accumulated the partial messages
    expect(context.messages).toHaveLength(2)
    expect(context.messages[1].content).toBe("Hi there!")
  })

  it("tracks tool uses in assistant messages", () => {
    const events = [
      { type: "user_message", timestamp: 1000, message: "Read file" },
      {
        type: "tool_use",
        timestamp: 2000,
        toolUseId: "tool-1",
        tool: "Read",
        input: { path: "/test" },
      },
      {
        type: "tool_result",
        timestamp: 3000,
        toolUseId: "tool-1",
        output: "file contents",
        isError: false,
      },
    ]

    const context = eventsToConversationContext(events)

    expect(context.messages).toHaveLength(2)
    const assistantMessage = context.messages[1]
    expect(assistantMessage.toolUses).toHaveLength(1)
    expect(assistantMessage.toolUses![0]).toEqual({
      id: "tool-1",
      name: "Read",
      input: { path: "/test" },
      result: {
        output: "file contents",
        error: undefined,
        isError: false,
      },
    })
  })

  it("tracks usage stats from result events", () => {
    const events = [
      { type: "result", timestamp: 1000, usage: { input_tokens: 100, output_tokens: 50 } },
    ]

    const context = eventsToConversationContext(events)

    expect(context.usage).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    })
  })

  it("tracks usage stats from message_start and message_delta", () => {
    const events = [
      { type: "message_start", timestamp: 1000, message: { usage: { input_tokens: 80 } } },
      { type: "message_delta", timestamp: 2000, usage: { output_tokens: 40 } },
    ]

    const context = eventsToConversationContext(events)

    expect(context.usage).toEqual({
      inputTokens: 80,
      outputTokens: 40,
      totalTokens: 120,
    })
  })

  it("handles content_block_start and content_block_delta for streaming", () => {
    const events = [
      {
        type: "content_block_start",
        timestamp: 1000,
        content_block: { type: "text", text: "Hello " },
      },
      {
        type: "content_block_delta",
        timestamp: 1100,
        delta: { type: "text_delta", text: "world" },
      },
    ]

    const context = eventsToConversationContext(events)

    // Should have accumulated the streaming text
    expect(context.messages).toHaveLength(1)
    expect(context.messages[0].content).toBe("Hello world")
  })

  it("returns empty context for empty events", () => {
    const context = eventsToConversationContext([])

    expect(context.messages).toEqual([])
    expect(context.lastPrompt).toBeUndefined()
    expect(context.usage).toEqual({ inputTokens: 0, outputTokens: 0, totalTokens: 0 })
  })
})
