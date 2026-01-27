import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  getLastEventIndex,
  clearEventIndices,
  ralphConnection,
  getCurrentSessionId,
  setCurrentSessionId,
} from "./ralphConnection"

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

vi.mock("./persistence", () => ({
  eventDatabase: {
    saveEvent: vi.fn().mockResolvedValue(undefined),
  },
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

  describe("getCurrentSessionId", () => {
    it("returns undefined for unknown instances", () => {
      expect(getCurrentSessionId("unknown-instance")).toBeUndefined()
    })
  })

  describe("setCurrentSessionId", () => {
    it("sets and getCurrentSessionId retrieves the session ID", () => {
      const instanceId = "test-instance-1"
      const sessionId = "test-session-123"

      setCurrentSessionId(instanceId, sessionId)

      expect(getCurrentSessionId(instanceId)).toBe(sessionId)
    })

    it("can set session IDs for multiple instances", () => {
      setCurrentSessionId("instance-a", "session-a")
      setCurrentSessionId("instance-b", "session-b")

      expect(getCurrentSessionId("instance-a")).toBe("session-a")
      expect(getCurrentSessionId("instance-b")).toBe("session-b")
    })

    it("overwrites existing session ID for same instance", () => {
      const instanceId = "test-instance"

      setCurrentSessionId(instanceId, "session-1")
      expect(getCurrentSessionId(instanceId)).toBe("session-1")

      setCurrentSessionId(instanceId, "session-2")
      expect(getCurrentSessionId(instanceId)).toBe("session-2")
    })
  })

  describe("clearEventIndices clears session IDs", () => {
    it("clears all session IDs when clearEventIndices is called", () => {
      // Set up some session IDs
      setCurrentSessionId("instance-1", "session-1")
      setCurrentSessionId("instance-2", "session-2")

      // Verify they exist
      expect(getCurrentSessionId("instance-1")).toBe("session-1")
      expect(getCurrentSessionId("instance-2")).toBe("session-2")

      // Clear event indices (which also clears session IDs)
      clearEventIndices()

      // Verify session IDs are cleared
      expect(getCurrentSessionId("instance-1")).toBeUndefined()
      expect(getCurrentSessionId("instance-2")).toBeUndefined()
    })
  })

  describe("ralphConnection.reset clears session IDs", () => {
    it("clears all session IDs on reset", () => {
      // Set up some session IDs
      setCurrentSessionId("instance-a", "session-a")
      setCurrentSessionId("instance-b", "session-b")

      // Verify they exist
      expect(getCurrentSessionId("instance-a")).toBe("session-a")
      expect(getCurrentSessionId("instance-b")).toBe("session-b")

      // Reset the connection
      ralphConnection.reset()

      // Verify session IDs are cleared
      expect(getCurrentSessionId("instance-a")).toBeUndefined()
      expect(getCurrentSessionId("instance-b")).toBeUndefined()
    })
  })
})
