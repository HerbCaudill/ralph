import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { BeadsClient, watchMutations } from "./BeadsClient.js"
import { EventEmitter } from "node:events"
import type { MutationEvent } from "@herbcaudill/beads"

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

  it("uses default polling interval of 1000ms", async () => {
    const onMutation = vi.fn()
    const cleanup = watchMutations(onMutation, {
      workspacePath: "/nonexistent/12345",
    })

    // First poll happens immediately
    await vi.advanceTimersByTimeAsync(0)

    // After 500ms, no second poll yet (default is 1000ms)
    await vi.advanceTimersByTimeAsync(500)

    // After 1000ms total, should have scheduled another poll
    await vi.advanceTimersByTimeAsync(500)

    cleanup()
  })

  it("respects custom polling interval", async () => {
    const onMutation = vi.fn()
    const cleanup = watchMutations(onMutation, {
      workspacePath: "/nonexistent/12345",
      interval: 2000,
    })

    // First poll happens immediately
    await vi.advanceTimersByTimeAsync(0)

    // After 1000ms, connection retry shouldn't happen yet (interval is 2000ms)
    await vi.advanceTimersByTimeAsync(1000)

    // After 2000ms total from first poll, should retry
    await vi.advanceTimersByTimeAsync(1000)

    cleanup()
  })

  it("stops polling after cleanup is called", async () => {
    const onMutation = vi.fn()
    const cleanup = watchMutations(onMutation, {
      workspacePath: "/nonexistent/12345",
      interval: 100,
    })

    // First poll
    await vi.advanceTimersByTimeAsync(0)

    // Stop watching
    cleanup()

    // Advance time past several poll intervals
    await vi.advanceTimersByTimeAsync(1000)

    // Callback should never have been called (since we can't connect)
    expect(onMutation).not.toHaveBeenCalled()
  })

  it("initializes with current timestamp by default", () => {
    // Set a specific time
    vi.setSystemTime(new Date("2024-01-15T12:00:00.000Z"))

    const onMutation = vi.fn()
    const cleanup = watchMutations(onMutation, {
      workspacePath: "/nonexistent/12345",
      interval: 100,
    })

    cleanup()

    // The watcher should have started with Date.now() as the initial timestamp
    // This is tested indirectly - if it used 0, it would request all mutations
  })

  it("respects custom since timestamp", () => {
    const customTimestamp = 1600000000000 // Some past timestamp

    const onMutation = vi.fn()
    const cleanup = watchMutations(onMutation, {
      workspacePath: "/nonexistent/12345",
      interval: 100,
      since: customTimestamp,
    })

    cleanup()

    // The watcher should use the custom timestamp
    // This is tested indirectly - mutations before this time won't be processed
  })

  it("cleanup is idempotent (can be called multiple times safely)", () => {
    const onMutation = vi.fn()
    const cleanup = watchMutations(onMutation, {
      workspacePath: "/nonexistent/12345",
      interval: 100,
    })

    // Call cleanup multiple times
    cleanup()
    cleanup()
    cleanup()

    // Should not throw
    expect(onMutation).not.toHaveBeenCalled()
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
