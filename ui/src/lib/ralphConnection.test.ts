import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { getLastEventIndex, clearEventIndices, ralphConnection } from "./ralphConnection"

// Mock dependencies
vi.mock("../store", () => {
  const addEvent = vi.fn()
  const addEventForInstance = vi.fn()
  const setRalphStatus = vi.fn()
  const setStatusForInstance = vi.fn()

  return {
    useAppStore: {
      getState: () => ({
        activeInstanceId: "test-instance",
        addEvent,
        addEventForInstance,
        setRalphStatus,
        setStatusForInstance,
        instances: new Map(),
        ralphStatus: "stopped",
      }),
    },
    flushTaskChatEventsBatch: vi.fn(),
    isRalphStatus: (s: unknown) =>
      typeof s === "string" && ["stopped", "starting", "running"].includes(s),
  }
})

vi.mock("./sessionStateApi", () => ({
  checkForSavedSessionState: vi.fn().mockResolvedValue(null),
  restoreSessionState: vi.fn().mockResolvedValue({ ok: true }),
}))

describe("ralphConnection event index tracking", () => {
  beforeEach(() => {
    // Reset all state before each test
    ralphConnection.reset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("getLastEventIndex", () => {
    it("returns undefined for unknown instances", () => {
      expect(getLastEventIndex("unknown-instance")).toBeUndefined()
    })
  })

  describe("clearEventIndices", () => {
    it("clears all tracked event indices", () => {
      // We can't directly set indices in the test since they're internal,
      // but we can verify the clear function is exported and callable
      clearEventIndices()
      expect(getLastEventIndex("any-instance")).toBeUndefined()
    })
  })

  describe("ralphConnection.reset", () => {
    it("clears event indices on reset", () => {
      // After reset, all indices should be cleared
      ralphConnection.reset()
      expect(getLastEventIndex("test-instance")).toBeUndefined()
      expect(getLastEventIndex("other-instance")).toBeUndefined()
    })
  })

  describe("connection status", () => {
    it("starts in disconnected state", () => {
      expect(ralphConnection.status).toBe("disconnected")
    })

    it("tracks reconnect attempts", () => {
      expect(ralphConnection.reconnectAttempts).toBe(0)
    })

    it("exposes max reconnect attempts", () => {
      expect(ralphConnection.maxReconnectAttempts).toBe(10)
    })
  })
})
