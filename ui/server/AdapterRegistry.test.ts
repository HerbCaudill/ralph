import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { EventEmitter } from "node:events"
import {
  registerAdapter,
  unregisterAdapter,
  getRegisteredAdapters,
  isAdapterRegistered,
  getAdapterRegistration,
  createAdapter,
  isAdapterAvailable,
  getAvailableAdapters,
  getFirstAvailableAdapter,
  clearRegistry,
  registerDefaultAdapters,
} from "./AdapterRegistry"
import {
  AgentAdapter,
  type AgentInfo,
  type AgentStartOptions,
  type AgentMessage,
} from "./AgentAdapter"

// Mock Adapter for Testing

class MockAdapter extends AgentAdapter {
  private _available: boolean
  public startCalled = false
  public stopCalled = false
  public lastMessage: AgentMessage | null = null

  constructor(options?: { available?: boolean }) {
    super()
    this._available = options?.available ?? true
  }

  getInfo(): AgentInfo {
    return {
      id: "mock",
      name: "Mock Agent",
      description: "A mock adapter for testing",
      features: {
        streaming: true,
        tools: true,
        pauseResume: false,
        systemPrompt: true,
      },
    }
  }

  async isAvailable(): Promise<boolean> {
    return this._available
  }

  async start(_options?: AgentStartOptions): Promise<void> {
    this.startCalled = true
    this.setStatus("running")
  }

  send(message: AgentMessage): void {
    this.lastMessage = message
  }

  async stop(_force?: boolean): Promise<void> {
    this.stopCalled = true
    this.setStatus("stopped")
  }
}

// Tests

describe("AdapterRegistry", () => {
  beforeEach(() => {
    // Start with a clean registry for each test
    clearRegistry()
  })

  afterEach(() => {
    clearRegistry()
  })

  describe("registerAdapter", () => {
    it("registers an adapter", () => {
      registerAdapter({
        id: "test",
        name: "Test Adapter",
        factory: () => new MockAdapter(),
      })

      expect(isAdapterRegistered("test")).toBe(true)
    })

    it("throws if adapter with same ID is already registered", () => {
      registerAdapter({
        id: "test",
        name: "Test Adapter",
        factory: () => new MockAdapter(),
      })

      expect(() =>
        registerAdapter({
          id: "test",
          name: "Another Test",
          factory: () => new MockAdapter(),
        }),
      ).toThrow('Adapter with id "test" is already registered')
    })

    it("includes description when provided", () => {
      registerAdapter({
        id: "test",
        name: "Test Adapter",
        description: "A test adapter",
        factory: () => new MockAdapter(),
      })

      const registration = getAdapterRegistration("test")
      expect(registration?.description).toBe("A test adapter")
    })
  })

  describe("unregisterAdapter", () => {
    it("unregisters an existing adapter", () => {
      registerAdapter({
        id: "test",
        name: "Test Adapter",
        factory: () => new MockAdapter(),
      })

      const result = unregisterAdapter("test")

      expect(result).toBe(true)
      expect(isAdapterRegistered("test")).toBe(false)
    })

    it("returns false for non-existent adapter", () => {
      const result = unregisterAdapter("nonexistent")

      expect(result).toBe(false)
    })
  })

  describe("getRegisteredAdapters", () => {
    it("returns empty array when no adapters registered", () => {
      expect(getRegisteredAdapters()).toEqual([])
    })

    it("returns all registered adapter IDs", () => {
      registerAdapter({
        id: "adapter1",
        name: "Adapter 1",
        factory: () => new MockAdapter(),
      })
      registerAdapter({
        id: "adapter2",
        name: "Adapter 2",
        factory: () => new MockAdapter(),
      })

      const ids = getRegisteredAdapters()

      expect(ids).toContain("adapter1")
      expect(ids).toContain("adapter2")
      expect(ids).toHaveLength(2)
    })
  })

  describe("isAdapterRegistered", () => {
    it("returns true for registered adapter", () => {
      registerAdapter({
        id: "test",
        name: "Test",
        factory: () => new MockAdapter(),
      })

      expect(isAdapterRegistered("test")).toBe(true)
    })

    it("returns false for unregistered adapter", () => {
      expect(isAdapterRegistered("nonexistent")).toBe(false)
    })
  })

  describe("getAdapterRegistration", () => {
    it("returns registration info for registered adapter", () => {
      const factory = () => new MockAdapter()
      registerAdapter({
        id: "test",
        name: "Test Adapter",
        description: "Test description",
        factory,
      })

      const registration = getAdapterRegistration("test")

      expect(registration).toBeDefined()
      expect(registration?.id).toBe("test")
      expect(registration?.name).toBe("Test Adapter")
      expect(registration?.description).toBe("Test description")
      expect(registration?.factory).toBe(factory)
    })

    it("returns undefined for unregistered adapter", () => {
      const registration = getAdapterRegistration("nonexistent")

      expect(registration).toBeUndefined()
    })
  })

  describe("createAdapter", () => {
    it("creates adapter instance for registered adapter", () => {
      registerAdapter({
        id: "test",
        name: "Test",
        factory: () => new MockAdapter(),
      })

      const adapter = createAdapter("test")

      expect(adapter).toBeInstanceOf(MockAdapter)
    })

    it("passes options to factory", () => {
      registerAdapter({
        id: "test",
        name: "Test",
        factory: (options?: { available?: boolean }) => new MockAdapter(options),
      })

      const adapter = createAdapter<MockAdapter>("test", { available: false })

      expect(adapter).toBeInstanceOf(MockAdapter)
    })

    it("throws for unknown adapter ID", () => {
      expect(() => createAdapter("unknown")).toThrow(
        'Unknown adapter "unknown". Available adapters: none (no adapters registered)',
      )
    })

    it("lists available adapters in error message", () => {
      registerAdapter({
        id: "adapter1",
        name: "Adapter 1",
        factory: () => new MockAdapter(),
      })
      registerAdapter({
        id: "adapter2",
        name: "Adapter 2",
        factory: () => new MockAdapter(),
      })

      expect(() => createAdapter("unknown")).toThrow(/Available adapters: adapter1, adapter2/)
    })
  })

  describe("isAdapterAvailable", () => {
    it("returns true when adapter is available", async () => {
      registerAdapter({
        id: "test",
        name: "Test",
        factory: () => new MockAdapter({ available: true }),
      })

      const available = await isAdapterAvailable("test")

      expect(available).toBe(true)
    })

    it("returns false when adapter is not available", async () => {
      registerAdapter({
        id: "test",
        name: "Test",
        factory: () => new MockAdapter({ available: false }),
      })

      const available = await isAdapterAvailable("test")

      expect(available).toBe(false)
    })

    it("throws for unknown adapter ID", async () => {
      await expect(isAdapterAvailable("unknown")).rejects.toThrow('Unknown adapter "unknown"')
    })
  })

  describe("getAvailableAdapters", () => {
    it("returns empty array when no adapters registered", async () => {
      const available = await getAvailableAdapters()

      expect(available).toEqual([])
    })

    it("returns availability info for all registered adapters", async () => {
      registerAdapter({
        id: "available",
        name: "Available Adapter",
        description: "This one is available",
        factory: () => new MockAdapter({ available: true }),
      })
      registerAdapter({
        id: "unavailable",
        name: "Unavailable Adapter",
        description: "This one is not",
        factory: () => new MockAdapter({ available: false }),
      })

      const available = await getAvailableAdapters()

      expect(available).toHaveLength(2)

      const availableAdapter = available.find(a => a.id === "available")
      expect(availableAdapter?.name).toBe("Available Adapter")
      expect(availableAdapter?.description).toBe("This one is available")
      expect(availableAdapter?.available).toBe(true)
      expect(availableAdapter?.info).toBeDefined()

      const unavailableAdapter = available.find(a => a.id === "unavailable")
      expect(unavailableAdapter?.name).toBe("Unavailable Adapter")
      expect(unavailableAdapter?.available).toBe(false)
    })

    it("marks adapter as unavailable if factory throws", async () => {
      registerAdapter({
        id: "broken",
        name: "Broken Adapter",
        factory: () => {
          throw new Error("Factory failed")
        },
      })

      const available = await getAvailableAdapters()

      expect(available).toHaveLength(1)
      expect(available[0].id).toBe("broken")
      expect(available[0].available).toBe(false)
      expect(available[0].info).toBeUndefined()
    })
  })

  describe("getFirstAvailableAdapter", () => {
    it("returns undefined when no adapters registered", async () => {
      const result = await getFirstAvailableAdapter()

      expect(result).toBeUndefined()
    })

    it("returns first available adapter in registration order", async () => {
      registerAdapter({
        id: "unavailable",
        name: "Unavailable",
        factory: () => new MockAdapter({ available: false }),
      })
      registerAdapter({
        id: "available",
        name: "Available",
        factory: () => new MockAdapter({ available: true }),
      })

      const result = await getFirstAvailableAdapter()

      expect(result).toBe("available")
    })

    it("respects preferred order", async () => {
      registerAdapter({
        id: "first",
        name: "First",
        factory: () => new MockAdapter({ available: true }),
      })
      registerAdapter({
        id: "second",
        name: "Second",
        factory: () => new MockAdapter({ available: true }),
      })

      const result = await getFirstAvailableAdapter(["second", "first"])

      expect(result).toBe("second")
    })

    it("skips unavailable adapters in preferred order", async () => {
      registerAdapter({
        id: "first",
        name: "First",
        factory: () => new MockAdapter({ available: false }),
      })
      registerAdapter({
        id: "second",
        name: "Second",
        factory: () => new MockAdapter({ available: true }),
      })

      const result = await getFirstAvailableAdapter(["first", "second"])

      expect(result).toBe("second")
    })

    it("ignores unknown IDs in preferred order", async () => {
      registerAdapter({
        id: "known",
        name: "Known",
        factory: () => new MockAdapter({ available: true }),
      })

      const result = await getFirstAvailableAdapter(["unknown", "known"])

      expect(result).toBe("known")
    })

    it("returns undefined when no adapters available", async () => {
      registerAdapter({
        id: "unavailable1",
        name: "Unavailable 1",
        factory: () => new MockAdapter({ available: false }),
      })
      registerAdapter({
        id: "unavailable2",
        name: "Unavailable 2",
        factory: () => new MockAdapter({ available: false }),
      })

      const result = await getFirstAvailableAdapter()

      expect(result).toBeUndefined()
    })
  })

  describe("clearRegistry", () => {
    it("removes all registered adapters", () => {
      registerAdapter({
        id: "adapter1",
        name: "Adapter 1",
        factory: () => new MockAdapter(),
      })
      registerAdapter({
        id: "adapter2",
        name: "Adapter 2",
        factory: () => new MockAdapter(),
      })

      clearRegistry()

      expect(getRegisteredAdapters()).toEqual([])
    })
  })

  describe("registerDefaultAdapters", () => {
    it("registers claude adapter", () => {
      registerDefaultAdapters()

      expect(isAdapterRegistered("claude")).toBe(true)
    })

    it("does not duplicate if called multiple times", () => {
      registerDefaultAdapters()
      registerDefaultAdapters()

      expect(getRegisteredAdapters().filter(id => id === "claude")).toHaveLength(1)
    })

    it("creates working claude adapter", () => {
      registerDefaultAdapters()

      const adapter = createAdapter("claude")

      expect(adapter.getInfo().id).toBe("claude")
      expect(adapter.getInfo().name).toBe("Claude")
    })
  })
})
