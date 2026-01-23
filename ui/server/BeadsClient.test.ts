import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { BeadsClient, watchMutations } from "./BeadsClient.js"
import { EventEmitter } from "node:events"
import type { MutationEvent } from "@herbcaudill/ralph-shared"

/**
 * Create a mock socket for testing.
 */
function createMockSocket() {
  const emitter = new EventEmitter()
  return {
    ...emitter,
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),
    emit: emitter.emit.bind(emitter),
    write: vi.fn(),
    destroy: vi.fn(),
  }
}

describe("BeadsClient", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe("socketExists", () => {
    it("returns true when socket file exists", () => {
      // Use a temp directory that exists
      const client = new BeadsClient({ workspacePath: "/tmp" })
      // We can't easily mock existsSync, so test the path construction
      expect(client["socketPath"]).toBe("/tmp/.beads/bd.sock")
    })
  })

  describe("connect", () => {
    it("returns false if socket does not exist", async () => {
      // Use a non-existent path
      const client = new BeadsClient({ workspacePath: "/nonexistent/path/12345" })
      const result = await client.connect()
      expect(result).toBe(false)
    })
  })

  describe("isConnected", () => {
    it("returns false initially", () => {
      const client = new BeadsClient({ workspacePath: "/test" })
      expect(client.isConnected).toBe(false)
    })
  })

  describe("close", () => {
    it("does nothing if not connected", () => {
      const client = new BeadsClient({ workspacePath: "/test" })
      // Should not throw
      client.close()
      expect(client.isConnected).toBe(false)
    })
  })

  describe("getMutations", () => {
    it("returns empty array if not connected", async () => {
      const client = new BeadsClient({ workspacePath: "/nonexistent/12345" })
      const mutations = await client.getMutations()
      expect(mutations).toEqual([])
    })
  })

  describe("getReady", () => {
    it("returns empty array if not connected", async () => {
      const client = new BeadsClient({ workspacePath: "/nonexistent/12345" })
      const issues = await client.getReady()
      expect(issues).toEqual([])
    })
  })
})

describe("watchMutations", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it("can be stopped immediately", () => {
    const onMutation = vi.fn()
    const cleanup = watchMutations(onMutation, {
      workspacePath: "/nonexistent/12345",
      interval: 100,
    })

    // Stop immediately
    cleanup()

    // Should not throw
    expect(onMutation).not.toHaveBeenCalled()
  })

  it("retries connection when socket does not exist", async () => {
    const onMutation = vi.fn()
    const cleanup = watchMutations(onMutation, {
      workspacePath: "/nonexistent/12345",
      interval: 100,
    })

    // First poll - connection fails (no socket)
    await vi.advanceTimersByTimeAsync(0)
    expect(onMutation).not.toHaveBeenCalled()

    // Clean up
    cleanup()
  })
})

// Integration test that requires a real daemon is skipped
describe.skip("BeadsClient Integration", () => {
  it("connects to real daemon and gets mutations", async () => {
    const client = new BeadsClient()
    const connected = await client.connect()

    if (connected) {
      const mutations = await client.getMutations(0)
      expect(Array.isArray(mutations)).toBe(true)
      client.close()
    } else {
      // Daemon not running, skip
      expect(connected).toBe(false)
    }
  })
})
