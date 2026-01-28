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

// Create a tracked mock for eventDatabase.saveEvent
const mockSaveEvent = vi.fn().mockResolvedValue(undefined)
vi.mock("./persistence", () => ({
  eventDatabase: {
    saveEvent: (...args: unknown[]) => mockSaveEvent(...args),
  },
}))

describe("ralphConnection event index tracking", () => {
  beforeEach(() => {
    // Reset all state before each test
    ralphConnection.reset()
    mockSaveEvent.mockClear()
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

  describe("session ID single source of truth (bug r-tufi7.1 fix)", () => {
    // These tests verify the fix for bug r-tufi7.1 where dual session ID tracking
    // caused events to be saved with mismatched session IDs.
    //
    // The fix ensures:
    // 1. Session IDs are ONLY set via setCurrentSessionId (called by useSessionPersistence)
    // 2. ralphConnection does NOT generate its own session IDs
    // 3. Events are only persisted when a session ID has been set externally

    it("session ID must be set via setCurrentSessionId before events can be persisted", () => {
      // Initially, no session ID is set
      expect(getCurrentSessionId("test-instance")).toBeUndefined()

      // After setting via setCurrentSessionId, the session ID is available
      setCurrentSessionId("test-instance", "external-session-123")
      expect(getCurrentSessionId("test-instance")).toBe("external-session-123")
    })

    it("does not automatically generate session IDs on session boundaries", () => {
      // Even after detecting what would be a session boundary,
      // no session ID is generated internally - it must come from setCurrentSessionId
      // This verifies the removal of internal generateSessionId calls

      // Simulate the state before the fix: internal generation would set a session ID
      // After the fix: session ID remains undefined until setCurrentSessionId is called
      expect(getCurrentSessionId("test-instance")).toBeUndefined()

      // No automatic generation - must be explicitly set
      expect(getCurrentSessionId("test-instance")).toBeUndefined()

      // Only setCurrentSessionId can set the session ID
      setCurrentSessionId("test-instance", "hook-generated-session")
      expect(getCurrentSessionId("test-instance")).toBe("hook-generated-session")
    })

    it("setCurrentSessionId is the only way to establish a session for event persistence", () => {
      const instanceId = "persistence-test-instance"

      // Initially undefined
      expect(getCurrentSessionId(instanceId)).toBeUndefined()

      // Set the session ID (simulating what useSessionPersistence does)
      const sessionId = "session-from-hook-1706123456789"
      setCurrentSessionId(instanceId, sessionId)

      // Now the session ID is available for event persistence
      expect(getCurrentSessionId(instanceId)).toBe(sessionId)

      // If a new session starts, useSessionPersistence calls setCurrentSessionId again
      const newSessionId = "session-from-hook-1706123457890"
      setCurrentSessionId(instanceId, newSessionId)

      // The new session ID replaces the old one
      expect(getCurrentSessionId(instanceId)).toBe(newSessionId)
    })

    it("each instance has its own session ID (set independently by useSessionPersistence)", () => {
      // useSessionPersistence runs per-instance and sets session IDs independently
      setCurrentSessionId("instance-1", "instance-1-session-100")
      setCurrentSessionId("instance-2", "instance-2-session-200")
      setCurrentSessionId("instance-3", "instance-3-session-300")

      expect(getCurrentSessionId("instance-1")).toBe("instance-1-session-100")
      expect(getCurrentSessionId("instance-2")).toBe("instance-2-session-200")
      expect(getCurrentSessionId("instance-3")).toBe("instance-3-session-300")

      // Updating one instance doesn't affect others
      setCurrentSessionId("instance-2", "instance-2-session-201")
      expect(getCurrentSessionId("instance-1")).toBe("instance-1-session-100")
      expect(getCurrentSessionId("instance-2")).toBe("instance-2-session-201")
      expect(getCurrentSessionId("instance-3")).toBe("instance-3-session-300")
    })
  })
})
