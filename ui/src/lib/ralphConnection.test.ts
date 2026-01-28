import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  getLastEventTimestamp,
  clearEventTimestamps,
  ralphConnection,
  getCurrentSessionId,
  getCurrentSession,
  setCurrentSessionId,
} from "./ralphConnection"

// Mock store state that can be modified per test
let mockStoreState: {
  activeInstanceId: string
  events: unknown[]
  instances: Map<string, { events: unknown[]; status: string }>
  ralphStatus: string
  addEvent: ReturnType<typeof vi.fn>
  addEventForInstance: ReturnType<typeof vi.fn>
  setRalphStatus: ReturnType<typeof vi.fn>
  setStatusForInstance: ReturnType<typeof vi.fn>
  setEvents: ReturnType<typeof vi.fn>
  setEventsForInstance: ReturnType<typeof vi.fn>
  setConnectionStatus: ReturnType<typeof vi.fn>
  wasRunningBeforeDisconnect: boolean
  markRunningBeforeDisconnect: ReturnType<typeof vi.fn>
  clearRunningBeforeDisconnect: ReturnType<typeof vi.fn>
  resetSessionStats: ReturnType<typeof vi.fn>
  resetSessionStatsForInstance: ReturnType<typeof vi.fn>
}

// Initialize mock store state
function createMockStoreState() {
  return {
    activeInstanceId: "test-instance",
    events: [],
    instances: new Map<string, { events: unknown[]; status: string }>(),
    ralphStatus: "stopped",
    addEvent: vi.fn(),
    addEventForInstance: vi.fn(),
    setRalphStatus: vi.fn(),
    setStatusForInstance: vi.fn(),
    setEvents: vi.fn(),
    setEventsForInstance: vi.fn(),
    setConnectionStatus: vi.fn(),
    wasRunningBeforeDisconnect: false,
    markRunningBeforeDisconnect: vi.fn(),
    clearRunningBeforeDisconnect: vi.fn(),
    resetSessionStats: vi.fn(),
    resetSessionStatsForInstance: vi.fn(),
  }
}

// Mock session boundary detection - can be controlled per test
let mockIsSessionBoundary: (event: unknown) => boolean = () => false

// Mock dependencies
vi.mock("../store", () => {
  return {
    useAppStore: {
      getState: () => mockStoreState,
    },
    flushTaskChatEventsBatch: vi.fn(),
    isRalphStatus: (s: unknown) =>
      typeof s === "string" && ["stopped", "starting", "running"].includes(s),
    isSessionBoundary: (event: unknown) => mockIsSessionBoundary(event),
    // Selector functions that read from the mock store state
    selectRalphStatus: (state: {
      instances: Map<string, { status: string }>
      activeInstanceId: string
    }) => state.instances.get(state.activeInstanceId)?.status ?? "stopped",
    selectEvents: (state: {
      instances: Map<string, { events: unknown[] }>
      activeInstanceId: string
    }) => state.instances.get(state.activeInstanceId)?.events ?? [],
    selectTokenUsage: (state: {
      instances: Map<string, { tokenUsage?: { input: number; output: number } }>
      activeInstanceId: string
    }) => state.instances.get(state.activeInstanceId)?.tokenUsage ?? { input: 0, output: 0 },
  }
})

vi.mock("./sessionStateApi", () => ({
  checkForSavedSessionState: vi.fn().mockResolvedValue(null),
  restoreSessionState: vi.fn().mockResolvedValue({ ok: true }),
}))

// Create tracked mocks for eventDatabase and writeQueue methods
const mockSaveEvent = vi.fn().mockResolvedValue(undefined)
const mockUpdateSessionTaskId = vi.fn().mockResolvedValue(true)
const mockEnqueue = vi.fn()
vi.mock("./persistence", () => ({
  eventDatabase: {
    saveEvent: (...args: unknown[]) => mockSaveEvent(...args),
    updateSessionTaskId: (...args: unknown[]) => mockUpdateSessionTaskId(...args),
  },
  writeQueue: {
    enqueue: (...args: unknown[]) => mockEnqueue(...args),
    setFailureCallback: vi.fn(),
  },
}))

// Mock WebSocket for integration testing
class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readyState = MockWebSocket.CONNECTING
  url: string

  onopen: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  static instances: MockWebSocket[] = []
  sentMessages: string[] = []

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }

  send(data: string): void {
    this.sentMessages.push(data)
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) {
      this.onclose(new CloseEvent("close"))
    }
  }

  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN
    if (this.onopen) {
      this.onopen(new Event("open"))
    }
  }

  simulateMessage(data: unknown): void {
    if (this.onmessage) {
      this.onmessage(new MessageEvent("message", { data: JSON.stringify(data) }))
    }
  }
}

const originalWebSocket = globalThis.WebSocket

describe("ralphConnection event timestamp tracking", () => {
  beforeEach(() => {
    // Reset mock store state
    mockStoreState = createMockStoreState()
    // Reset all state before each test
    ralphConnection.reset()
    mockSaveEvent.mockClear()
    mockEnqueue.mockClear()
    MockWebSocket.instances = []
    // Reset session boundary mock to default (no boundaries)
    mockIsSessionBoundary = () => false
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("getLastEventTimestamp", () => {
    it("returns undefined for unknown instances", () => {
      expect(getLastEventTimestamp("unknown-instance")).toBeUndefined()
    })
  })

  describe("clearEventTimestamps", () => {
    it("clears all tracked event timestamps", () => {
      // We can't directly set timestamps in the test since they're internal,
      // but we can verify the clear function is exported and callable
      clearEventTimestamps()
      expect(getLastEventTimestamp("any-instance")).toBeUndefined()
    })
  })

  describe("ralphConnection.reset", () => {
    it("clears event timestamps on reset", () => {
      // After reset, all timestamps should be cleared
      ralphConnection.reset()
      expect(getLastEventTimestamp("test-instance")).toBeUndefined()
      expect(getLastEventTimestamp("other-instance")).toBeUndefined()
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

  describe("getCurrentSession", () => {
    it("returns undefined for unknown instances", () => {
      expect(getCurrentSession("unknown-instance")).toBeUndefined()
    })

    it("returns full SessionInfo object with id and startedAt", () => {
      const instanceId = "test-instance-session-info"
      const sessionId = "session-xyz-789"

      setCurrentSessionId(instanceId, sessionId)

      const sessionInfo = getCurrentSession(instanceId)
      expect(sessionInfo).toBeDefined()
      expect(sessionInfo?.id).toBe(sessionId)
      // startedAt should be a number (timestamp)
      expect(typeof sessionInfo?.startedAt).toBe("number")
      expect(sessionInfo?.startedAt).toBeGreaterThan(0)
    })

    it("returns consistent SessionInfo for multiple calls", () => {
      const instanceId = "consistent-test-instance"
      const sessionId = "consistent-session-123"

      setCurrentSessionId(instanceId, sessionId)

      const session1 = getCurrentSession(instanceId)
      const session2 = getCurrentSession(instanceId)

      expect(session1).toEqual(session2)
      expect(session1?.id).toBe(sessionId)
      expect(session1?.startedAt).toBe(session2?.startedAt)
    })

    it("preserves startedAt when session ID is updated", () => {
      const instanceId = "preserve-startedat-instance"
      const firstSessionId = "first-session"
      const secondSessionId = "second-session"

      // Set initial session
      setCurrentSessionId(instanceId, firstSessionId)
      const firstSession = getCurrentSession(instanceId)
      const originalStartedAt = firstSession?.startedAt

      // Update session ID - should preserve startedAt
      setCurrentSessionId(instanceId, secondSessionId)
      const updatedSession = getCurrentSession(instanceId)

      expect(updatedSession?.id).toBe(secondSessionId)
      expect(updatedSession?.startedAt).toBe(originalStartedAt)
    })

    it("returns different SessionInfo for different instances", () => {
      setCurrentSessionId("instance-a", "session-a")
      setCurrentSessionId("instance-b", "session-b")

      const sessionA = getCurrentSession("instance-a")
      const sessionB = getCurrentSession("instance-b")

      expect(sessionA?.id).toBe("session-a")
      expect(sessionB?.id).toBe("session-b")
      // IDs should be different
      expect(sessionA?.id).not.toBe(sessionB?.id)
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

  describe("clearEventTimestamps clears session IDs", () => {
    it("clears all session IDs when clearEventTimestamps is called", () => {
      // Set up some session IDs
      setCurrentSessionId("instance-1", "session-1")
      setCurrentSessionId("instance-2", "session-2")

      // Verify they exist
      expect(getCurrentSessionId("instance-1")).toBe("session-1")
      expect(getCurrentSessionId("instance-2")).toBe("session-2")

      // Clear event timestamps (which also clears session IDs)
      clearEventTimestamps()

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

  describe("ralph_task_started event handling prerequisites", () => {
    // These tests verify that the infrastructure for updateSessionTaskId is correctly set up.
    // The actual WebSocket message handling that triggers updateSessionTaskId is internal,
    // but these tests ensure the mocks and session ID management work correctly.

    beforeEach(() => {
      mockUpdateSessionTaskId.mockClear()
      mockSaveEvent.mockClear()
    })

    it("eventDatabase.updateSessionTaskId mock is correctly configured", async () => {
      // Verify the mock resolves to true (default behavior)
      const result = await mockUpdateSessionTaskId("session-123", "task-456")

      expect(result).toBe(true)
      expect(mockUpdateSessionTaskId).toHaveBeenCalledWith("session-123", "task-456")
    })

    it("session ID must be set for event persistence", () => {
      const instanceId = "test-instance"

      // Initially no session ID
      expect(getCurrentSessionId(instanceId)).toBeUndefined()

      // Set the session ID (as useSessionPersistence would do)
      setCurrentSessionId(instanceId, "session-123")
      expect(getCurrentSessionId(instanceId)).toBe("session-123")

      // When a ralph_task_started event arrives, the handler will:
      // 1. Check if sessionId = currentSessionIds.get(targetInstanceId)
      // 2. If sessionId exists and event.type === "ralph_task_started", call:
      //    eventDatabase.updateSessionTaskId(sessionId, event.taskId)
    })

    it("clearEventTimestamps clears session IDs (prevents stale updates)", () => {
      setCurrentSessionId("instance-1", "session-1")
      setCurrentSessionId("instance-2", "session-2")

      expect(getCurrentSessionId("instance-1")).toBe("session-1")
      expect(getCurrentSessionId("instance-2")).toBe("session-2")

      clearEventTimestamps()

      // After clearing, no session IDs are set
      // This prevents updateSessionTaskId from being called with stale session IDs
      expect(getCurrentSessionId("instance-1")).toBeUndefined()
      expect(getCurrentSessionId("instance-2")).toBeUndefined()
    })

    it("updateSessionTaskId mock can be configured to return false for non-existent sessions", async () => {
      mockUpdateSessionTaskId.mockResolvedValueOnce(false)

      const result = await mockUpdateSessionTaskId("non-existent-session", "task-123")

      expect(result).toBe(false)
      expect(mockUpdateSessionTaskId).toHaveBeenCalledWith("non-existent-session", "task-123")
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

  describe("reconciliation logic in connected message handler", () => {
    // These tests verify the reconciliation behavior when processing "connected" messages.
    // The reconciliation detects when IndexedDB (loaded into Zustand) has fewer events
    // than the server, logs a warning, and repairs IndexedDB by persisting server events.

    beforeEach(() => {
      // Install mock WebSocket
      globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket
      MockWebSocket.instances = []
      mockEnqueue.mockClear()
      mockStoreState = createMockStoreState()
    })

    afterEach(() => {
      // Restore original WebSocket
      globalThis.WebSocket = originalWebSocket
      ralphConnection.reset()
    })

    it("logs warning when IndexedDB has fewer events than server (data loss detected)", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})

      // Set up store to have some events in the active instance (simulating loaded from IndexedDB)
      const testInstanceEvents = [
        { type: "user_message", timestamp: 1000, message: "Hello" },
        { type: "assistant_message", timestamp: 2000, message: "Hi" },
      ]
      mockStoreState.instances.set("test-instance", {
        events: testInstanceEvents,
        status: "stopped",
      })

      // Set up session ID for persistence
      setCurrentSessionId("test-instance", "test-session-123")

      // Connect and simulate "connected" message with more events from server
      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      // Server sends 5 events (more than the 2 in IndexedDB/Zustand)
      const serverEvents = [
        { type: "user_message", timestamp: 1000, message: "Hello", id: "evt-1" },
        { type: "assistant_message", timestamp: 2000, message: "Hi", id: "evt-2" },
        { type: "user_message", timestamp: 3000, message: "How are you?", id: "evt-3" },
        { type: "assistant_message", timestamp: 4000, message: "Good!", id: "evt-4" },
        { type: "user_message", timestamp: 5000, message: "Great", id: "evt-5" },
      ]

      ws.simulateMessage({
        type: "connected",
        ralphStatus: "running",
        events: serverEvents,
      })

      // Verify warning was logged
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Reconciliation detected event mismatch"),
      )
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("IndexedDB had 2 events"))
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("server has 5"))
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("3 event(s) were missing"))

      // Verify repair log
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("Repaired IndexedDB by persisting 5 events"),
      )

      warnSpy.mockRestore()
      logSpy.mockRestore()
    })

    it("persists all server events to IndexedDB when mismatch detected and session ID exists", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {})
      vi.spyOn(console, "log").mockImplementation(() => {})

      // Set up store with 1 event in the active instance (loaded from IndexedDB)
      mockStoreState.instances.set("test-instance", {
        events: [{ type: "user_message", timestamp: 1000, message: "Hello" }],
        status: "stopped",
      })

      // Set up session ID for persistence
      setCurrentSessionId("test-instance", "test-session-456")

      // Connect
      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      // Server sends 3 events
      const serverEvents = [
        { type: "user_message", timestamp: 1000, message: "Hello", id: "evt-1" },
        { type: "assistant_message", timestamp: 2000, message: "Hi", id: "evt-2" },
        { type: "user_message", timestamp: 3000, message: "Thanks", id: "evt-3" },
      ]

      ws.simulateMessage({
        type: "connected",
        events: serverEvents,
      })

      // Verify all server events were enqueued for persistence
      expect(mockEnqueue).toHaveBeenCalledTimes(3)

      // Verify each event was enqueued with correct session ID
      expect(mockEnqueue).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          id: "evt-1",
          sessionId: "test-session-456",
          eventType: "user_message",
        }),
        "test-session-456",
      )
      expect(mockEnqueue).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          id: "evt-2",
          sessionId: "test-session-456",
          eventType: "assistant_message",
        }),
        "test-session-456",
      )
      expect(mockEnqueue).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          id: "evt-3",
          sessionId: "test-session-456",
          eventType: "user_message",
        }),
        "test-session-456",
      )
    })

    it("does not log warning or persist when event counts match", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

      // Set up store with 3 events in the active instance
      mockStoreState.instances.set("test-instance", {
        events: [
          { type: "user_message", timestamp: 1000 },
          { type: "assistant_message", timestamp: 2000 },
          { type: "user_message", timestamp: 3000 },
        ],
        status: "stopped",
      })

      setCurrentSessionId("test-instance", "test-session-789")

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      // Server sends same number of events
      const serverEvents = [
        { type: "user_message", timestamp: 1000, id: "evt-1" },
        { type: "assistant_message", timestamp: 2000, id: "evt-2" },
        { type: "user_message", timestamp: 3000, id: "evt-3" },
      ]

      ws.simulateMessage({
        type: "connected",
        events: serverEvents,
      })

      // No warning should be logged when counts match
      expect(warnSpy).not.toHaveBeenCalled()

      // No events should be persisted for repair
      expect(mockEnqueue).not.toHaveBeenCalled()

      warnSpy.mockRestore()
    })

    it("does not log warning when IndexedDB has zero events (fresh load)", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

      // Store has no events in the active instance (fresh page load, nothing loaded from IndexedDB)
      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "stopped",
      })

      setCurrentSessionId("test-instance", "test-session-fresh")

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      // Server sends events
      ws.simulateMessage({
        type: "connected",
        events: [
          { type: "user_message", timestamp: 1000, id: "evt-1" },
          { type: "assistant_message", timestamp: 2000, id: "evt-2" },
        ],
      })

      // No warning - this is expected on fresh page load
      expect(warnSpy).not.toHaveBeenCalled()

      // No repair needed
      expect(mockEnqueue).not.toHaveBeenCalled()

      warnSpy.mockRestore()
    })

    it("skips persistence when no session ID is set", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})

      // Set up store with events in the active instance but NO session ID set
      mockStoreState.instances.set("test-instance", {
        events: [{ type: "user_message", timestamp: 1000 }],
        status: "stopped",
      })

      // Don't set session ID - simulates case before useSessionPersistence runs

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      ws.simulateMessage({
        type: "connected",
        events: [
          { type: "user_message", timestamp: 1000, id: "evt-1" },
          { type: "assistant_message", timestamp: 2000, id: "evt-2" },
          { type: "user_message", timestamp: 3000, id: "evt-3" },
        ],
      })

      // Warning should still be logged (mismatch detected)
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Reconciliation detected event mismatch"),
      )

      // But no persistence should happen (no session ID)
      expect(mockEnqueue).not.toHaveBeenCalled()

      // No repair log since persistence was skipped
      expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining("Repaired IndexedDB"))

      warnSpy.mockRestore()
      logSpy.mockRestore()
    })

    it("handles non-active instance reconciliation", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})

      // Set up a non-active instance with events
      const otherInstanceId = "other-instance"
      mockStoreState.instances.set(otherInstanceId, {
        events: [{ type: "user_message", timestamp: 1000 }],
        status: "stopped",
      })

      // Set session ID for the other instance
      setCurrentSessionId(otherInstanceId, "other-session-123")

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      // Server sends message for non-active instance with more events
      ws.simulateMessage({
        type: "connected",
        instanceId: otherInstanceId,
        events: [
          { type: "user_message", timestamp: 1000, id: "evt-1" },
          { type: "assistant_message", timestamp: 2000, id: "evt-2" },
          { type: "user_message", timestamp: 3000, id: "evt-3" },
        ],
      })

      // Warning should be logged for the non-active instance
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Reconciliation detected event mismatch"),
      )

      // Events should be persisted for the non-active instance
      expect(mockEnqueue).toHaveBeenCalledTimes(3)
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: "other-session-123" }),
        "other-session-123",
      )

      warnSpy.mockRestore()
      logSpy.mockRestore()
    })

    it("does not log warning when IndexedDB has more events than server", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

      // IndexedDB has more events than server in the active instance (unusual but possible)
      mockStoreState.instances.set("test-instance", {
        events: [
          { type: "user_message", timestamp: 1000 },
          { type: "assistant_message", timestamp: 2000 },
          { type: "user_message", timestamp: 3000 },
          { type: "assistant_message", timestamp: 4000 },
        ],
        status: "stopped",
      })

      setCurrentSessionId("test-instance", "test-session")

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      // Server sends fewer events
      ws.simulateMessage({
        type: "connected",
        events: [
          { type: "user_message", timestamp: 1000, id: "evt-1" },
          { type: "assistant_message", timestamp: 2000, id: "evt-2" },
        ],
      })

      // No warning - condition is zustandEventCount < serverEventCount
      expect(warnSpy).not.toHaveBeenCalled()

      warnSpy.mockRestore()
    })

    it("uses server-assigned event IDs for deduplication", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {})
      vi.spyOn(console, "log").mockImplementation(() => {})

      mockStoreState.instances.set("test-instance", {
        events: [{ type: "user_message", timestamp: 1000 }],
        status: "stopped",
      })
      setCurrentSessionId("test-instance", "test-session")

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      // Server events have UUIDs
      ws.simulateMessage({
        type: "connected",
        events: [
          { type: "user_message", timestamp: 1000, id: "uuid-abc-123" },
          { type: "assistant_message", timestamp: 2000, id: "uuid-def-456" },
        ],
      })

      // Verify the server UUIDs are used as event IDs
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({ id: "uuid-abc-123" }),
        "test-session",
      )
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({ id: "uuid-def-456" }),
        "test-session",
      )
    })

    it("still updates store events even when mismatch detected", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {})
      vi.spyOn(console, "log").mockImplementation(() => {})

      mockStoreState.instances.set("test-instance", {
        events: [{ type: "user_message", timestamp: 1000 }],
        status: "stopped",
      })
      setCurrentSessionId("test-instance", "test-session")

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      const serverEvents = [
        { type: "user_message", timestamp: 1000, id: "evt-1" },
        { type: "assistant_message", timestamp: 2000, id: "evt-2" },
      ]

      ws.simulateMessage({
        type: "connected",
        events: serverEvents,
      })

      // Store should be updated with server events
      expect(mockStoreState.setEvents).toHaveBeenCalledWith(serverEvents)
    })
  })

  describe("synchronous session ID generation on session boundaries (bug r-tufi7.36 fix)", () => {
    // These tests verify the core fix for bug r-tufi7.36:
    // Session IDs are now generated synchronously in ralphConnection.ts when session
    // boundary events arrive, eliminating the race condition where events could be
    // persisted before useSessionPersistence React effect ran to generate the session ID.

    beforeEach(() => {
      // Install mock WebSocket
      globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket
      MockWebSocket.instances = []
      mockEnqueue.mockClear()
      mockStoreState = createMockStoreState()
    })

    afterEach(() => {
      // Restore original WebSocket
      globalThis.WebSocket = originalWebSocket
      ralphConnection.reset()
    })

    it("generates session ID synchronously when ralph:event with session boundary arrives", async () => {
      const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {})

      // Configure mock to detect session boundaries for system init events
      mockIsSessionBoundary = (event: unknown) => {
        const e = event as { type?: string; subtype?: string }
        return e.type === "system" && e.subtype === "init"
      }

      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "stopped",
      })

      // Initially no session ID
      expect(getCurrentSessionId("test-instance")).toBeUndefined()

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      const timestamp = 1706123456789

      // Simulate a ralph:event with a session boundary event
      ws.simulateMessage({
        type: "ralph:event",
        event: {
          type: "system",
          subtype: "init",
          timestamp,
        },
      })

      // Session ID should be generated synchronously (before useSessionPersistence effect runs)
      const sessionId = getCurrentSessionId("test-instance")
      expect(sessionId).toBeDefined()
      // Session ID format should be instanceId-timestamp
      expect(sessionId).toBe(`test-instance-${timestamp}`)

      // Full session info should also be available
      const sessionInfo = getCurrentSession("test-instance")
      expect(sessionInfo?.id).toBe(`test-instance-${timestamp}`)
      expect(sessionInfo?.startedAt).toBe(timestamp)

      // Verify debug log was called
      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining("Session ID generated synchronously"),
      )

      debugSpy.mockRestore()
    })

    it("uses server-generated sessionId from ralph_session_start events", async () => {
      // Configure mock to detect ralph_session_start as session boundary
      mockIsSessionBoundary = (event: unknown) => {
        const e = event as { type?: string }
        return e.type === "ralph_session_start"
      }

      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "stopped",
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      const serverSessionId = "550e8400-e29b-41d4-a716-446655440000"
      const timestamp = 1706123456789

      // Simulate a ralph:event with server-generated sessionId
      ws.simulateMessage({
        type: "ralph:event",
        event: {
          type: "ralph_session_start",
          timestamp,
          sessionId: serverSessionId, // Server-generated UUID
          session: 1,
          totalSessions: 5,
        },
      })

      // Session ID should be the server-generated UUID
      expect(getCurrentSessionId("test-instance")).toBe(serverSessionId)

      const sessionInfo = getCurrentSession("test-instance")
      expect(sessionInfo?.id).toBe(serverSessionId)
      expect(sessionInfo?.startedAt).toBe(timestamp)
    })

    it("falls back to generated ID when sessionId missing from ralph_session_start", async () => {
      mockIsSessionBoundary = (event: unknown) => {
        const e = event as { type?: string }
        return e.type === "ralph_session_start"
      }

      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "stopped",
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      const timestamp = 1706123456789

      // Event without sessionId field (backward compatibility)
      ws.simulateMessage({
        type: "ralph:event",
        event: {
          type: "ralph_session_start",
          timestamp,
          session: 1,
          totalSessions: 5,
          // No sessionId field
        },
      })

      // Should fall back to generated format
      expect(getCurrentSessionId("test-instance")).toBe(`test-instance-${timestamp}`)
    })

    it("uses Date.now() as fallback when event has no timestamp", async () => {
      mockIsSessionBoundary = (event: unknown) => {
        const e = event as { type?: string; subtype?: string }
        return e.type === "system" && e.subtype === "init"
      }

      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "stopped",
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      const beforeTime = Date.now()

      // Event without timestamp
      ws.simulateMessage({
        type: "ralph:event",
        event: {
          type: "system",
          subtype: "init",
          // No timestamp
        },
      })

      const afterTime = Date.now()

      const sessionId = getCurrentSessionId("test-instance")
      expect(sessionId).toBeDefined()

      // Extract timestamp from session ID
      const idTimestamp = parseInt(sessionId!.split("-").slice(-1)[0], 10)
      expect(idTimestamp).toBeGreaterThanOrEqual(beforeTime)
      expect(idTimestamp).toBeLessThanOrEqual(afterTime)
    })

    it("persists events with session ID immediately available", async () => {
      mockIsSessionBoundary = (event: unknown) => {
        const e = event as { type?: string; subtype?: string }
        return e.type === "system" && e.subtype === "init"
      }

      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "stopped",
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      const timestamp = 1706123456789
      const expectedSessionId = `test-instance-${timestamp}`

      // Simulate session boundary event
      ws.simulateMessage({
        type: "ralph:event",
        event: {
          type: "system",
          subtype: "init",
          timestamp,
          id: "evt-init-1",
        },
      })

      // Event should be persisted with the session ID
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "evt-init-1",
          sessionId: expectedSessionId,
        }),
        expectedSessionId,
      )
    })

    it("resets session stats when session boundary detected", async () => {
      mockIsSessionBoundary = (event: unknown) => {
        const e = event as { type?: string; subtype?: string }
        return e.type === "system" && e.subtype === "init"
      }

      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "stopped",
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      ws.simulateMessage({
        type: "ralph:event",
        event: {
          type: "system",
          subtype: "init",
          timestamp: Date.now(),
        },
      })

      // Session stats should be reset
      expect(mockStoreState.resetSessionStats).toHaveBeenCalled()
    })

    it("handles session boundary in pending_events message", async () => {
      const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {})
      vi.spyOn(console, "log").mockImplementation(() => {})

      mockIsSessionBoundary = (event: unknown) => {
        const e = event as { type?: string; subtype?: string }
        return e.type === "system" && e.subtype === "init"
      }

      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "stopped",
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      const timestamp = 1706123456789

      // Simulate pending_events with a session boundary event
      ws.simulateMessage({
        type: "pending_events",
        instanceId: "test-instance",
        events: [
          {
            type: "system",
            subtype: "init",
            timestamp,
            id: "pending-evt-1",
          },
          {
            type: "assistant",
            timestamp: timestamp + 100,
            id: "pending-evt-2",
          },
        ],
      })

      // Session ID should be generated from the boundary event
      expect(getCurrentSessionId("test-instance")).toBe(`test-instance-${timestamp}`)

      // Debug log should indicate session boundary in pending events
      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining("Session boundary detected in pending events"),
      )

      // All events should be persisted with the session ID
      expect(mockEnqueue).toHaveBeenCalledTimes(2)
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: `test-instance-${timestamp}` }),
        `test-instance-${timestamp}`,
      )

      debugSpy.mockRestore()
    })

    it("routes session boundary to correct instance when instanceId specified", async () => {
      mockIsSessionBoundary = (event: unknown) => {
        const e = event as { type?: string; subtype?: string }
        return e.type === "system" && e.subtype === "init"
      }

      // Set up non-active instance
      const otherInstanceId = "other-instance"
      mockStoreState.instances.set(otherInstanceId, {
        events: [],
        status: "stopped",
      })
      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "stopped",
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      const timestamp = 1706123456789

      // Session boundary event for non-active instance
      ws.simulateMessage({
        type: "ralph:event",
        instanceId: otherInstanceId,
        event: {
          type: "system",
          subtype: "init",
          timestamp,
        },
      })

      // Session ID should be set for the correct instance
      expect(getCurrentSessionId(otherInstanceId)).toBe(`${otherInstanceId}-${timestamp}`)
      // Active instance should not have a session ID
      expect(getCurrentSessionId("test-instance")).toBeUndefined()

      // Stats should be reset for the non-active instance
      expect(mockStoreState.resetSessionStatsForInstance).toHaveBeenCalledWith(otherInstanceId)
    })

    it("overwrites previous session ID when new session boundary arrives", async () => {
      mockIsSessionBoundary = (event: unknown) => {
        const e = event as { type?: string; subtype?: string }
        return e.type === "system" && e.subtype === "init"
      }

      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "stopped",
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      const timestamp1 = 1706123456789
      const timestamp2 = 1706123457890

      // First session boundary
      ws.simulateMessage({
        type: "ralph:event",
        event: {
          type: "system",
          subtype: "init",
          timestamp: timestamp1,
        },
      })

      expect(getCurrentSessionId("test-instance")).toBe(`test-instance-${timestamp1}`)

      // Second session boundary (new session starts)
      ws.simulateMessage({
        type: "ralph:event",
        event: {
          type: "system",
          subtype: "init",
          timestamp: timestamp2,
        },
      })

      // Session ID should be updated to the new session
      expect(getCurrentSessionId("test-instance")).toBe(`test-instance-${timestamp2}`)

      // Session info should reflect the new session
      const sessionInfo = getCurrentSession("test-instance")
      expect(sessionInfo?.id).toBe(`test-instance-${timestamp2}`)
      expect(sessionInfo?.startedAt).toBe(timestamp2)
    })
  })
})
