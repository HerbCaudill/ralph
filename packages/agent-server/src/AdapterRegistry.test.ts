import { describe, it, expect, beforeEach } from "vitest"
import {
  registerAdapter,
  unregisterAdapter,
  getRegisteredAdapters,
  isAdapterRegistered,
  createAdapter,
  clearRegistry,
  registerDefaultAdapters,
} from "./AdapterRegistry.js"
import {
  AgentAdapter,
  type AgentInfo,
  type AgentStartOptions,
  type AgentMessage,
} from "./agentTypes.js"

class StubAdapter extends AgentAdapter {
  options: unknown

  constructor(options?: unknown) {
    super()
    this.options = options
  }

  getInfo(): AgentInfo {
    return {
      id: "stub",
      name: "Stub",
      features: { streaming: false, tools: false, pauseResume: false, systemPrompt: false },
    }
  }

  async isAvailable() {
    return true
  }

  async start(_options?: AgentStartOptions) {
    this.setStatus("running")
  }

  send(_message: AgentMessage) {}

  async stop() {
    this.setStatus("stopped")
  }
}

describe("AdapterRegistry", () => {
  beforeEach(() => {
    clearRegistry()
  })

  it("starts empty after clearRegistry", () => {
    expect(getRegisteredAdapters()).toEqual([])
  })

  it("registers and retrieves an adapter", () => {
    registerAdapter({ id: "stub", name: "Stub", factory: () => new StubAdapter() })
    expect(isAdapterRegistered("stub")).toBe(true)
    expect(getRegisteredAdapters()).toContain("stub")
  })

  it("throws on duplicate registration", () => {
    registerAdapter({ id: "stub", name: "Stub", factory: () => new StubAdapter() })
    expect(() =>
      registerAdapter({ id: "stub", name: "Stub 2", factory: () => new StubAdapter() }),
    ).toThrow("already registered")
  })

  it("creates an adapter via factory", () => {
    registerAdapter({ id: "stub", name: "Stub", factory: opts => new StubAdapter(opts) })
    const adapter = createAdapter("stub", { key: "value" })
    expect(adapter).toBeInstanceOf(StubAdapter)
    expect((adapter as StubAdapter).options).toEqual({ key: "value" })
  })

  it("throws when creating an unknown adapter", () => {
    expect(() => createAdapter("nonexistent")).toThrow('Unknown adapter "nonexistent"')
  })

  it("unregisters an adapter", () => {
    registerAdapter({ id: "stub", name: "Stub", factory: () => new StubAdapter() })
    expect(unregisterAdapter("stub")).toBe(true)
    expect(isAdapterRegistered("stub")).toBe(false)
  })

  it("returns false when unregistering a non-existent adapter", () => {
    expect(unregisterAdapter("nope")).toBe(false)
  })

  it("registerDefaultAdapters registers claude and codex", () => {
    registerDefaultAdapters()
    expect(isAdapterRegistered("claude")).toBe(true)
    expect(isAdapterRegistered("codex")).toBe(true)
  })
})
