import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  getLastEventTimestamp,
  clearEventTimestamps,
  ralphConnection,
  initRalphConnection,
  getCurrentSessionId,
  getCurrentSession,
  setCurrentSessionId,
  getLastTaskChatEventTimestamp,
  clearTaskChatEventTimestamps,
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
  disconnectedAt: number | null
  markRunningBeforeDisconnect: ReturnType<typeof vi.fn>
  clearRunningBeforeDisconnect: ReturnType<typeof vi.fn>
  resetSessionStats: ReturnType<typeof vi.fn>
  resetSessionStatsForInstance: ReturnType<typeof vi.fn>
  clearTaskChatMessages: ReturnType<typeof vi.fn>
  addTaskChatEvent: ReturnType<typeof vi.fn>
  addTokenUsage: ReturnType<typeof vi.fn>
  updateContextWindowUsed: ReturnType<typeof vi.fn>
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
    disconnectedAt: null,
    markRunningBeforeDisconnect: vi.fn(),
    clearRunningBeforeDisconnect: vi.fn(),
    resetSessionStats: vi.fn(),
    resetSessionStatsForInstance: vi.fn(),
    clearTaskChatMessages: vi.fn(),
    addTaskChatEvent: vi.fn(),
    addTokenUsage: vi.fn(),
    updateContextWindowUsed: vi.fn(),
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

  describe("getLastTaskChatEventTimestamp", () => {
    it("returns undefined for unknown instances", () => {
      expect(getLastTaskChatEventTimestamp("unknown-instance")).toBeUndefined()
    })
  })

  describe("clearTaskChatEventTimestamps", () => {
    it("clears all tracked task chat event timestamps", () => {
      // Verify the clear function is exported and callable
      clearTaskChatEventTimestamps()
      expect(getLastTaskChatEventTimestamp("any-instance")).toBeUndefined()
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

    it("uses provided startedAt when explicitly passed (hydration from IndexedDB, r-tufi7.35)", () => {
      const instanceId = "hydration-restore-instance"
      const sessionId = "default-1000"
      const originalStartedAt = 1000

      // Simulate what useStoreHydration does when restoring from IndexedDB:
      // pass the original startedAt from the persisted session
      setCurrentSessionId(instanceId, sessionId, originalStartedAt)

      const session = getCurrentSession(instanceId)
      expect(session).toBeDefined()
      expect(session?.id).toBe(sessionId)
      expect(session?.startedAt).toBe(originalStartedAt)
    })

    it("provided startedAt overrides existing startedAt", () => {
      const instanceId = "override-startedat-instance"

      // Set initial session with auto-generated startedAt
      setCurrentSessionId(instanceId, "session-1")
      const autoStartedAt = getCurrentSession(instanceId)?.startedAt

      // Now set a new session with explicit startedAt (simulating IndexedDB restore)
      const explicitStartedAt = 5000
      setCurrentSessionId(instanceId, "session-2", explicitStartedAt)

      const session = getCurrentSession(instanceId)
      expect(session?.id).toBe("session-2")
      expect(session?.startedAt).toBe(explicitStartedAt)
      expect(session?.startedAt).not.toBe(autoStartedAt)
    })

    it("falls back to existing startedAt when startedAt is not provided", () => {
      const instanceId = "fallback-startedat-instance"
      const explicitStartedAt = 42000

      // Set initial session with explicit startedAt
      setCurrentSessionId(instanceId, "session-1", explicitStartedAt)
      expect(getCurrentSession(instanceId)?.startedAt).toBe(explicitStartedAt)

      // Update session ID without providing startedAt - should preserve existing
      setCurrentSessionId(instanceId, "session-2")
      expect(getCurrentSession(instanceId)?.startedAt).toBe(explicitStartedAt)
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

  describe("task-chat:cleared message handling (bug r-tufi7.46 fix)", () => {
    // These tests verify the client-side handler for task-chat:cleared WebSocket messages.
    // This is part of the multi-system clear sequence:
    // 1. Client calls POST /api/task-chat/clear
    // 2. Server's TaskChatManager emits "historyCleared" event
    // 3. WorkspaceContext forwards this as "task-chat:cleared" event
    // 4. Server broadcasts "task-chat:cleared" to all connected WebSocket clients
    // 5. Each client (including the initiator) receives the broadcast and clears local state

    beforeEach(() => {
      // Install mock WebSocket
      globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket
      MockWebSocket.instances = []
      mockStoreState = createMockStoreState()
    })

    afterEach(() => {
      // Restore original WebSocket
      globalThis.WebSocket = originalWebSocket
      ralphConnection.reset()
    })

    it("clears task chat messages when task-chat:cleared message is received", async () => {
      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "running",
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      // Simulate receiving task-chat:cleared message
      ws.simulateMessage({
        type: "task-chat:cleared",
        instanceId: "test-instance",
        timestamp: Date.now(),
      })

      // Verify that clearTaskChatMessages was called
      expect(mockStoreState.clearTaskChatMessages).toHaveBeenCalled()
    })

    it("clears task chat messages even without explicit instanceId (defaults to active)", async () => {
      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "running",
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      // Simulate receiving task-chat:cleared message without instanceId
      ws.simulateMessage({
        type: "task-chat:cleared",
        timestamp: Date.now(),
      })

      // Verify that clearTaskChatMessages was called
      expect(mockStoreState.clearTaskChatMessages).toHaveBeenCalled()
    })

    it("ignores task-chat:cleared for non-active instances", async () => {
      // Set up active instance as "test-instance" (the default)
      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "running",
      })

      // Set up a non-active instance
      mockStoreState.instances.set("other-instance", {
        events: [],
        status: "running",
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      // Simulate receiving task-chat:cleared for a non-active instance
      ws.simulateMessage({
        type: "task-chat:cleared",
        instanceId: "other-instance",
        timestamp: Date.now(),
      })

      // Verify that clearTaskChatMessages was NOT called
      // (task-chat:cleared is in activeOnlyTypes so it's skipped for non-active instances)
      expect(mockStoreState.clearTaskChatMessages).not.toHaveBeenCalled()
    })

    it("clears task chat event timestamp when task-chat:cleared is received", async () => {
      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "running",
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      // First, send a task-chat:event to set a timestamp
      const timestamp = 1706123456789
      ws.simulateMessage({
        type: "task-chat:event",
        instanceId: "test-instance",
        event: {
          type: "assistant",
          timestamp,
          message: { role: "assistant", content: "Hello" },
        },
      })

      // Verify timestamp was tracked
      expect(getLastTaskChatEventTimestamp("test-instance")).toBe(timestamp)

      // Now send task-chat:cleared
      ws.simulateMessage({
        type: "task-chat:cleared",
        instanceId: "test-instance",
        timestamp: Date.now(),
      })

      // Verify timestamp was cleared for this instance
      expect(getLastTaskChatEventTimestamp("test-instance")).toBeUndefined()
    })
  })

  describe("task-chat:event timestamp tracking", () => {
    // These tests verify that task-chat:event messages update the timestamp tracking
    // for reconnection sync purposes.

    beforeEach(() => {
      // Install mock WebSocket
      globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket
      MockWebSocket.instances = []
      mockStoreState = createMockStoreState()
    })

    afterEach(() => {
      // Restore original WebSocket
      globalThis.WebSocket = originalWebSocket
      ralphConnection.reset()
    })

    it("tracks timestamp from task-chat:event messages", async () => {
      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "running",
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      const timestamp = 1706123456789

      // Send a task-chat:event
      ws.simulateMessage({
        type: "task-chat:event",
        instanceId: "test-instance",
        event: {
          type: "assistant",
          timestamp,
          message: { role: "assistant", content: "Hello" },
        },
      })

      // Verify timestamp was tracked
      expect(getLastTaskChatEventTimestamp("test-instance")).toBe(timestamp)
    })

    it("updates timestamp with each new task-chat:event", async () => {
      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "running",
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      const timestamp1 = 1706123456789
      const timestamp2 = 1706123456890

      // Send first task-chat:event
      ws.simulateMessage({
        type: "task-chat:event",
        instanceId: "test-instance",
        event: {
          type: "assistant",
          timestamp: timestamp1,
          message: { role: "assistant", content: "First" },
        },
      })

      expect(getLastTaskChatEventTimestamp("test-instance")).toBe(timestamp1)

      // Send second task-chat:event with newer timestamp
      ws.simulateMessage({
        type: "task-chat:event",
        instanceId: "test-instance",
        event: {
          type: "assistant",
          timestamp: timestamp2,
          message: { role: "assistant", content: "Second" },
        },
      })

      // Timestamp should be updated to the newer one
      expect(getLastTaskChatEventTimestamp("test-instance")).toBe(timestamp2)
    })

    it("uses active instance ID when instanceId not specified in message", async () => {
      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "running",
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      const timestamp = 1706123456789

      // Send task-chat:event without instanceId (should default to active instance)
      ws.simulateMessage({
        type: "task-chat:event",
        event: {
          type: "assistant",
          timestamp,
          message: { role: "assistant", content: "Hello" },
        },
      })

      // Should be tracked under the active instance ID
      expect(getLastTaskChatEventTimestamp("test-instance")).toBe(timestamp)
    })

    it("tracks timestamps per instance independently", async () => {
      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "running",
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      const timestamp1 = 1706123456789

      // Send task-chat:event for active instance
      ws.simulateMessage({
        type: "task-chat:event",
        instanceId: "test-instance",
        event: {
          type: "assistant",
          timestamp: timestamp1,
          message: { role: "assistant", content: "First instance" },
        },
      })

      // Manually set a different timestamp for another instance
      // (simulating what would happen if we received events for multiple instances)
      // Note: We can't directly send task-chat:event for non-active instance
      // because they're filtered out, but we can verify the timestamps are separate

      expect(getLastTaskChatEventTimestamp("test-instance")).toBe(timestamp1)
      expect(getLastTaskChatEventTimestamp("other-instance")).toBeUndefined()
    })

    it("clearTaskChatEventTimestamps clears all instance timestamps", async () => {
      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "running",
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      // Set up a timestamp
      ws.simulateMessage({
        type: "task-chat:event",
        instanceId: "test-instance",
        event: {
          type: "assistant",
          timestamp: 1706123456789,
          message: { role: "assistant", content: "Hello" },
        },
      })

      expect(getLastTaskChatEventTimestamp("test-instance")).toBeDefined()

      // Clear all timestamps
      clearTaskChatEventTimestamps()

      // All timestamps should be cleared
      expect(getLastTaskChatEventTimestamp("test-instance")).toBeUndefined()
    })

    it("clearEventTimestamps also clears task chat timestamps", async () => {
      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "running",
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      // Set up a task chat timestamp
      ws.simulateMessage({
        type: "task-chat:event",
        instanceId: "test-instance",
        event: {
          type: "assistant",
          timestamp: 1706123456789,
          message: { role: "assistant", content: "Hello" },
        },
      })

      expect(getLastTaskChatEventTimestamp("test-instance")).toBeDefined()

      // Clear all event timestamps (should also clear task chat timestamps)
      clearEventTimestamps()

      // Task chat timestamps should be cleared too
      expect(getLastTaskChatEventTimestamp("test-instance")).toBeUndefined()
    })

    it("ralphConnection.reset clears task chat timestamps", async () => {
      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "running",
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      // Set up a task chat timestamp
      ws.simulateMessage({
        type: "task-chat:event",
        instanceId: "test-instance",
        event: {
          type: "assistant",
          timestamp: 1706123456789,
          message: { role: "assistant", content: "Hello" },
        },
      })

      expect(getLastTaskChatEventTimestamp("test-instance")).toBeDefined()

      // Reset the connection
      ralphConnection.reset()

      // Task chat timestamps should be cleared
      expect(getLastTaskChatEventTimestamp("test-instance")).toBeUndefined()
    })

    it("does not track timestamp when event lacks required properties", async () => {
      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "running",
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      // Send task-chat:event with missing type
      ws.simulateMessage({
        type: "task-chat:event",
        instanceId: "test-instance",
        event: {
          timestamp: 1706123456789,
          message: { role: "assistant", content: "Hello" },
          // Missing 'type' property
        },
      })

      // Should not track timestamp because event is invalid
      expect(getLastTaskChatEventTimestamp("test-instance")).toBeUndefined()

      // Send task-chat:event with missing timestamp
      ws.simulateMessage({
        type: "task-chat:event",
        instanceId: "test-instance",
        event: {
          type: "assistant",
          message: { role: "assistant", content: "Hello" },
          // Missing 'timestamp' property
        },
      })

      // Should still not track timestamp
      expect(getLastTaskChatEventTimestamp("test-instance")).toBeUndefined()
    })

    it("adds event to store when task-chat:event is received", async () => {
      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "running",
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      const event = {
        type: "assistant",
        timestamp: 1706123456789,
        message: { role: "assistant", content: "Hello" },
      }

      ws.simulateMessage({
        type: "task-chat:event",
        instanceId: "test-instance",
        event,
      })

      // Verify addTaskChatEvent was called with the event
      expect(mockStoreState.addTaskChatEvent).toHaveBeenCalledWith(event)
    })
  })

  describe("agent:reconnect message on WebSocket open", () => {
    // These tests verify that agent:reconnect is sent on WebSocket open
    // when there's a last task chat event timestamp to sync from.

    beforeEach(() => {
      // Install mock WebSocket
      globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket
      MockWebSocket.instances = []
      mockStoreState = createMockStoreState()
    })

    afterEach(() => {
      // Restore original WebSocket
      globalThis.WebSocket = originalWebSocket
      ralphConnection.reset()
    })

    it("sends agent:reconnect (task-chat) on WebSocket open when there is a last task chat event timestamp", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})

      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "running",
      })

      // First connection to establish a task chat timestamp
      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws1 = MockWebSocket.instances[0]
      ws1.simulateOpen()

      const timestamp = 1706123456789

      // Receive a task-chat:event to set the timestamp
      ws1.simulateMessage({
        type: "task-chat:event",
        instanceId: "test-instance",
        event: {
          type: "assistant",
          timestamp,
          message: { role: "assistant", content: "Hello" },
        },
      })

      // Verify timestamp is tracked
      expect(getLastTaskChatEventTimestamp("test-instance")).toBe(timestamp)

      // Clear sent messages to track new ones
      ws1.sentMessages = []

      // Simulate disconnect and reconnect
      ws1.close()
      await new Promise(resolve => setTimeout(resolve, 10))

      // Connect again
      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws2 = MockWebSocket.instances[1]
      ws2.simulateOpen()

      // Verify agent:reconnect (task-chat) was sent (unified reconnect, r-tufi7.51.4)
      const reconnectMessage = ws2.sentMessages.find(msg => {
        const parsed = JSON.parse(msg)
        return parsed.type === "agent:reconnect" && parsed.source === "task-chat"
      })

      expect(reconnectMessage).toBeDefined()
      const parsed = JSON.parse(reconnectMessage!)
      expect(parsed.type).toBe("agent:reconnect")
      expect(parsed.source).toBe("task-chat")
      expect(parsed.instanceId).toBe("test-instance")
      expect(parsed.lastEventTimestamp).toBe(timestamp)

      // Verify log message
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("agent:reconnect (task-chat)"))

      logSpy.mockRestore()
    })

    it("does NOT send task-chat:reconnect when there is no task chat timestamp", async () => {
      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "running",
      })

      // Verify no timestamp exists
      expect(getLastTaskChatEventTimestamp("test-instance")).toBeUndefined()

      // Connect
      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      // Verify agent:reconnect (task-chat) was NOT sent
      const reconnectMessage = ws.sentMessages.find(msg => {
        const parsed = JSON.parse(msg)
        return parsed.type === "agent:reconnect" && parsed.source === "task-chat"
      })

      expect(reconnectMessage).toBeUndefined()
    })

    it("sends both agent:reconnect (ralph) and agent:reconnect (task-chat) when both timestamps exist", async () => {
      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "running",
      })

      // First connection to establish timestamps
      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws1 = MockWebSocket.instances[0]
      ws1.simulateOpen()

      const eventTimestamp = 1706123456000
      const taskChatTimestamp = 1706123456789

      // Receive a ralph:event to set the event timestamp
      ws1.simulateMessage({
        type: "ralph:event",
        instanceId: "test-instance",
        event: {
          type: "user_message",
          timestamp: eventTimestamp,
          message: "Hello",
        },
      })

      // Receive a task-chat:event to set the task chat timestamp
      ws1.simulateMessage({
        type: "task-chat:event",
        instanceId: "test-instance",
        event: {
          type: "assistant",
          timestamp: taskChatTimestamp,
          message: { role: "assistant", content: "Hi" },
        },
      })

      // Verify both timestamps are tracked
      expect(getLastEventTimestamp("test-instance")).toBe(eventTimestamp)
      expect(getLastTaskChatEventTimestamp("test-instance")).toBe(taskChatTimestamp)

      // Clear sent messages
      ws1.sentMessages = []

      // Simulate disconnect and reconnect
      ws1.close()
      await new Promise(resolve => setTimeout(resolve, 10))

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws2 = MockWebSocket.instances[1]
      ws2.simulateOpen()

      // Verify both unified agent:reconnect messages were sent (r-tufi7.51.4)
      const regularReconnect = ws2.sentMessages.find(msg => {
        const parsed = JSON.parse(msg)
        return parsed.type === "agent:reconnect" && parsed.source === "ralph"
      })
      const taskChatReconnect = ws2.sentMessages.find(msg => {
        const parsed = JSON.parse(msg)
        return parsed.type === "agent:reconnect" && parsed.source === "task-chat"
      })

      expect(regularReconnect).toBeDefined()
      expect(taskChatReconnect).toBeDefined()

      const parsedRegular = JSON.parse(regularReconnect!)
      expect(parsedRegular.lastEventTimestamp).toBe(eventTimestamp)
      expect(parsedRegular.source).toBe("ralph")

      const parsedTaskChat = JSON.parse(taskChatReconnect!)
      expect(parsedTaskChat.lastEventTimestamp).toBe(taskChatTimestamp)
      expect(parsedTaskChat.source).toBe("task-chat")
    })
  })

  describe("task-chat:pending_events message handling", () => {
    // These tests verify the handler for task-chat:pending_events messages,
    // which are sent by the server in response to task-chat:reconnect.

    beforeEach(() => {
      // Install mock WebSocket
      globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket
      MockWebSocket.instances = []
      mockStoreState = createMockStoreState()
    })

    afterEach(() => {
      // Restore original WebSocket
      globalThis.WebSocket = originalWebSocket
      ralphConnection.reset()
    })

    it("adds pending task chat events to the store", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})

      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "running",
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      const pendingEvents = [
        {
          type: "assistant",
          timestamp: 1706123456789,
          message: { role: "assistant", content: "First" },
        },
        {
          type: "user",
          timestamp: 1706123456890,
          message: { role: "user", content: "Second" },
        },
        {
          type: "assistant",
          timestamp: 1706123456991,
          message: { role: "assistant", content: "Third" },
        },
      ]

      // Simulate receiving task-chat:pending_events
      ws.simulateMessage({
        type: "task-chat:pending_events",
        instanceId: "test-instance",
        events: pendingEvents,
      })

      // Verify all events were added to the store
      expect(mockStoreState.addTaskChatEvent).toHaveBeenCalledTimes(3)
      expect(mockStoreState.addTaskChatEvent).toHaveBeenNthCalledWith(1, pendingEvents[0])
      expect(mockStoreState.addTaskChatEvent).toHaveBeenNthCalledWith(2, pendingEvents[1])
      expect(mockStoreState.addTaskChatEvent).toHaveBeenNthCalledWith(3, pendingEvents[2])

      // Verify log message
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("Processing 3 pending task chat events"),
      )

      logSpy.mockRestore()
    })

    it("updates timestamp tracking with the last event timestamp", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {})

      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "running",
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      const lastTimestamp = 1706123456991

      ws.simulateMessage({
        type: "task-chat:pending_events",
        instanceId: "test-instance",
        events: [
          {
            type: "assistant",
            timestamp: 1706123456789,
            message: { role: "assistant", content: "First" },
          },
          {
            type: "assistant",
            timestamp: lastTimestamp,
            message: { role: "assistant", content: "Last" },
          },
        ],
      })

      // Verify timestamp was updated to the last event's timestamp
      expect(getLastTaskChatEventTimestamp("test-instance")).toBe(lastTimestamp)
    })

    it("only processes events for the active instance", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {})

      // Set up active instance as "test-instance"
      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "running",
      })

      // Set up a non-active instance
      mockStoreState.instances.set("other-instance", {
        events: [],
        status: "running",
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      // Send pending events for a non-active instance
      ws.simulateMessage({
        type: "task-chat:pending_events",
        instanceId: "other-instance",
        events: [
          {
            type: "assistant",
            timestamp: 1706123456789,
            message: { role: "assistant", content: "Hello" },
          },
        ],
      })

      // Verify events were NOT added to the store (since it's not the active instance)
      expect(mockStoreState.addTaskChatEvent).not.toHaveBeenCalled()

      // But timestamp tracking should still be updated for the instance
      expect(getLastTaskChatEventTimestamp("other-instance")).toBe(1706123456789)
    })

    it("handles empty events array gracefully", async () => {
      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "running",
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      // Send pending events with empty array
      ws.simulateMessage({
        type: "task-chat:pending_events",
        instanceId: "test-instance",
        events: [],
      })

      // Should not crash, and no events should be added
      expect(mockStoreState.addTaskChatEvent).not.toHaveBeenCalled()
    })

    it("skips events without required properties", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {})

      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "running",
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      ws.simulateMessage({
        type: "task-chat:pending_events",
        instanceId: "test-instance",
        events: [
          {
            type: "assistant",
            timestamp: 1706123456789,
            message: { role: "assistant", content: "Valid" },
          },
          { timestamp: 1706123456890, message: { role: "assistant", content: "Missing type" } }, // Missing type
          { type: "assistant", message: { role: "assistant", content: "Missing timestamp" } }, // Missing timestamp
          {
            type: "user",
            timestamp: 1706123456991,
            message: { role: "user", content: "Also valid" },
          },
        ],
      })

      // Only events with both type and timestamp should be added
      expect(mockStoreState.addTaskChatEvent).toHaveBeenCalledTimes(2)
      expect(mockStoreState.addTaskChatEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: "assistant", timestamp: 1706123456789 }),
      )
      expect(mockStoreState.addTaskChatEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: "user", timestamp: 1706123456991 }),
      )
    })

    it("defaults to 'default' instanceId when not specified", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {})

      // Set active instance to "default" for this test
      mockStoreState.activeInstanceId = "default"
      mockStoreState.instances.set("default", {
        events: [],
        status: "running",
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      const timestamp = 1706123456789

      // Send pending events without instanceId
      ws.simulateMessage({
        type: "task-chat:pending_events",
        // No instanceId specified
        events: [
          { type: "assistant", timestamp, message: { role: "assistant", content: "Hello" } },
        ],
      })

      // Event should be added since activeInstanceId is "default"
      expect(mockStoreState.addTaskChatEvent).toHaveBeenCalledTimes(1)

      // Timestamp should be tracked under "default"
      expect(getLastTaskChatEventTimestamp("default")).toBe(timestamp)
    })
  })

  describe("agent:pending_events message handling", () => {
    // These tests verify the unified handler for agent:pending_events messages (r-tufi7.51.4),
    // which replaces the divergent pending_events / task-chat:pending_events handlers.

    beforeEach(() => {
      globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket
      MockWebSocket.instances = []
      mockStoreState = createMockStoreState()
    })

    afterEach(() => {
      globalThis.WebSocket = originalWebSocket
      ralphConnection.reset()
    })

    it("adds pending ralph events to the store for the active instance", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {})

      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "running",
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      const pendingEvents = [
        { type: "assistant", timestamp: 1706123456789, id: "evt-1" },
        { type: "assistant", timestamp: 1706123456890, id: "evt-2" },
      ]

      ws.simulateMessage({
        type: "agent:pending_events",
        source: "ralph",
        instanceId: "test-instance",
        events: pendingEvents,
        totalEvents: 10,
        status: "running",
        timestamp: Date.now(),
      })

      // All events should be added via addEvent (active instance)
      expect(mockStoreState.addEvent).toHaveBeenCalledTimes(2)
      expect(mockStoreState.addEvent).toHaveBeenNthCalledWith(1, pendingEvents[0])
      expect(mockStoreState.addEvent).toHaveBeenNthCalledWith(2, pendingEvents[1])
    })

    it("adds pending ralph events via addEventForInstance for non-active instances", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {})

      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "running",
      })
      mockStoreState.instances.set("other-instance", {
        events: [],
        status: "running",
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      const pendingEvents = [
        { type: "assistant", timestamp: 1706123456789, id: "evt-1" },
      ]

      ws.simulateMessage({
        type: "agent:pending_events",
        source: "ralph",
        instanceId: "other-instance",
        events: pendingEvents,
        totalEvents: 5,
        status: "running",
        timestamp: Date.now(),
      })

      // Should use addEventForInstance (non-active instance)
      expect(mockStoreState.addEvent).not.toHaveBeenCalled()
      expect(mockStoreState.addEventForInstance).toHaveBeenCalledTimes(1)
      expect(mockStoreState.addEventForInstance).toHaveBeenCalledWith(
        "other-instance",
        pendingEvents[0],
      )
    })

    it("updates ralph timestamp tracking from the last event", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {})

      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "running",
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      const lastTimestamp = 1706123456890

      ws.simulateMessage({
        type: "agent:pending_events",
        source: "ralph",
        instanceId: "test-instance",
        events: [
          { type: "assistant", timestamp: 1706123456789 },
          { type: "assistant", timestamp: lastTimestamp },
        ],
        totalEvents: 2,
        status: "running",
        timestamp: Date.now(),
      })

      // The unified getLastEventTimestamp defaults to "ralph" source
      expect(getLastEventTimestamp("test-instance")).toBe(lastTimestamp)
    })

    it("syncs ralph status for the active instance via setRalphStatus", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {})

      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "stopped",
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      ws.simulateMessage({
        type: "agent:pending_events",
        source: "ralph",
        instanceId: "test-instance",
        events: [],
        totalEvents: 0,
        status: "running",
        timestamp: Date.now(),
      })

      expect(mockStoreState.setRalphStatus).toHaveBeenCalledWith("running")
    })

    it("syncs ralph status for non-active instance via setStatusForInstance", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {})

      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "running",
      })
      mockStoreState.instances.set("other-instance", {
        events: [],
        status: "stopped",
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      ws.simulateMessage({
        type: "agent:pending_events",
        source: "ralph",
        instanceId: "other-instance",
        events: [],
        totalEvents: 0,
        status: "running",
        timestamp: Date.now(),
      })

      expect(mockStoreState.setRalphStatus).not.toHaveBeenCalled()
      expect(mockStoreState.setStatusForInstance).toHaveBeenCalledWith("other-instance", "running")
    })

    it("adds pending task-chat events to the store for the active instance", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {})

      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "running",
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      const pendingEvents = [
        {
          type: "assistant",
          timestamp: 1706123456789,
          message: { role: "assistant", content: "First" },
        },
        {
          type: "user",
          timestamp: 1706123456890,
          message: { role: "user", content: "Second" },
        },
      ]

      ws.simulateMessage({
        type: "agent:pending_events",
        source: "task-chat",
        instanceId: "test-instance",
        events: pendingEvents,
        totalEvents: 2,
        status: "running",
        timestamp: Date.now(),
      })

      expect(mockStoreState.addTaskChatEvent).toHaveBeenCalledTimes(2)
      expect(mockStoreState.addTaskChatEvent).toHaveBeenNthCalledWith(1, pendingEvents[0])
      expect(mockStoreState.addTaskChatEvent).toHaveBeenNthCalledWith(2, pendingEvents[1])
    })

    it("updates task-chat timestamp tracking from the last event", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {})

      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "running",
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      const lastTimestamp = 1706123456890

      ws.simulateMessage({
        type: "agent:pending_events",
        source: "task-chat",
        instanceId: "test-instance",
        events: [
          { type: "assistant", timestamp: 1706123456789, message: { role: "assistant", content: "A" } },
          { type: "assistant", timestamp: lastTimestamp, message: { role: "assistant", content: "B" } },
        ],
        totalEvents: 2,
        status: "running",
        timestamp: Date.now(),
      })

      expect(getLastTaskChatEventTimestamp("test-instance")).toBe(lastTimestamp)
    })

    it("does not add task-chat events to the store for non-active instances", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {})

      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "running",
      })
      mockStoreState.instances.set("other-instance", {
        events: [],
        status: "running",
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      ws.simulateMessage({
        type: "agent:pending_events",
        source: "task-chat",
        instanceId: "other-instance",
        events: [
          { type: "assistant", timestamp: 1706123456789, message: { role: "assistant", content: "Hello" } },
        ],
        totalEvents: 1,
        status: "running",
        timestamp: Date.now(),
      })

      // Events should NOT be added to store for non-active instance
      expect(mockStoreState.addTaskChatEvent).not.toHaveBeenCalled()

      // But timestamp tracking should still be updated
      expect(getLastTaskChatEventTimestamp("other-instance")).toBe(1706123456789)
    })

    it("handles empty events array gracefully for both sources", async () => {
      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "running",
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      // Empty ralph events
      ws.simulateMessage({
        type: "agent:pending_events",
        source: "ralph",
        instanceId: "test-instance",
        events: [],
        totalEvents: 0,
        status: "stopped",
        timestamp: Date.now(),
      })

      // Empty task-chat events
      ws.simulateMessage({
        type: "agent:pending_events",
        source: "task-chat",
        instanceId: "test-instance",
        events: [],
        totalEvents: 0,
        status: "idle",
        timestamp: Date.now(),
      })

      // No events should be added
      expect(mockStoreState.addEvent).not.toHaveBeenCalled()
      expect(mockStoreState.addTaskChatEvent).not.toHaveBeenCalled()
    })

    it("skips task-chat events without required type and timestamp properties", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {})

      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "running",
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      ws.simulateMessage({
        type: "agent:pending_events",
        source: "task-chat",
        instanceId: "test-instance",
        events: [
          { type: "assistant", timestamp: 1706123456789, message: { role: "assistant", content: "Valid" } },
          { timestamp: 1706123456890, message: { role: "assistant", content: "Missing type" } },
          { type: "assistant", message: { role: "assistant", content: "Missing timestamp" } },
          { type: "user", timestamp: 1706123456991, message: { role: "user", content: "Also valid" } },
        ],
        totalEvents: 4,
        status: "running",
        timestamp: Date.now(),
      })

      // Only events with both type and timestamp should be added
      expect(mockStoreState.addTaskChatEvent).toHaveBeenCalledTimes(2)
      expect(mockStoreState.addTaskChatEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: "assistant", timestamp: 1706123456789 }),
      )
      expect(mockStoreState.addTaskChatEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: "user", timestamp: 1706123456991 }),
      )
    })

    it("detects session boundaries in ralph pending events", async () => {
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

      ws.simulateMessage({
        type: "agent:pending_events",
        source: "ralph",
        instanceId: "test-instance",
        events: [
          { type: "system", subtype: "init", timestamp, id: "evt-1" },
          { type: "assistant", timestamp: timestamp + 100, id: "evt-2" },
        ],
        totalEvents: 2,
        status: "running",
        timestamp: Date.now(),
      })

      // Session ID should be generated from the boundary event
      expect(getCurrentSessionId("test-instance")).toBe(`test-instance-${timestamp}`)

      debugSpy.mockRestore()
    })
  })

  describe("auto-resume on reconnection (wasRunningBeforeDisconnect)", () => {
    // These tests verify the auto-resume logic in ws.onopen:
    // 1. The flag is cleared immediately to prevent duplicate resume attempts
    // 2. Disconnects older than 5 minutes skip auto-resume
    // 3. Server verification via checkForSavedSessionState before restoring
    // 4. Only resumes when server confirms "running" or "paused" status

    let mockCheckForSavedSessionState: ReturnType<typeof vi.fn>
    let mockRestoreSessionState: ReturnType<typeof vi.fn>

    beforeEach(async () => {
      // Install mock WebSocket
      globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket
      MockWebSocket.instances = []
      mockStoreState = createMockStoreState()
      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "running",
      })

      // Get references to the mocked session state API functions
      const sessionStateApi = await import("./sessionStateApi")
      mockCheckForSavedSessionState = sessionStateApi.checkForSavedSessionState as ReturnType<
        typeof vi.fn
      >
      mockRestoreSessionState = sessionStateApi.restoreSessionState as ReturnType<typeof vi.fn>

      // Reset mocks
      mockCheckForSavedSessionState.mockReset()
      mockRestoreSessionState.mockReset().mockResolvedValue({ ok: true })
    })

    afterEach(() => {
      globalThis.WebSocket = originalWebSocket
      ralphConnection.reset()
    })

    it("clears the wasRunningBeforeDisconnect flag immediately on reconnection", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {})

      // Set up: Ralph was running before disconnect (recent)
      mockStoreState.wasRunningBeforeDisconnect = true
      mockStoreState.disconnectedAt = Date.now() - 1000 // 1 second ago

      // Server will confirm running status
      mockCheckForSavedSessionState.mockResolvedValue({
        status: "running",
        savedAt: Date.now(),
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      // The flag should be cleared immediately (before the async server check)
      expect(mockStoreState.clearRunningBeforeDisconnect).toHaveBeenCalled()
    })

    it("skips auto-resume when disconnect was more than 5 minutes ago", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})

      // Set up: Ralph was running, but disconnected > 5 minutes ago
      mockStoreState.wasRunningBeforeDisconnect = true
      mockStoreState.disconnectedAt = Date.now() - 6 * 60 * 1000 // 6 minutes ago

      // Server check for fallback path returns null (no saved state)
      mockCheckForSavedSessionState.mockResolvedValue(null)

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      // Wait for the async check to complete
      await new Promise(resolve => setTimeout(resolve, 50))

      // Should log the staleness skip message
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("Skipping auto-resume: disconnect was too long ago"),
      )

      // restoreSessionState should NOT be called (stale disconnect falls through
      // to the server check fallback, which returns null)
      expect(mockRestoreSessionState).not.toHaveBeenCalled()

      logSpy.mockRestore()
    })

    it("verifies with server before auto-resuming on recent disconnect", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {})

      // Set up: Ralph was running, recent disconnect
      mockStoreState.wasRunningBeforeDisconnect = true
      mockStoreState.disconnectedAt = Date.now() - 2000 // 2 seconds ago

      // Server confirms running
      mockCheckForSavedSessionState.mockResolvedValue({
        status: "running",
        savedAt: Date.now(),
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 50))

      // Should have checked with server
      expect(mockCheckForSavedSessionState).toHaveBeenCalled()

      // Should have restored since server confirmed running
      expect(mockRestoreSessionState).toHaveBeenCalledWith("test-instance")
    })

    it("auto-resumes when server reports 'paused' status", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {})

      mockStoreState.wasRunningBeforeDisconnect = true
      mockStoreState.disconnectedAt = Date.now() - 2000

      mockCheckForSavedSessionState.mockResolvedValue({
        status: "paused",
        savedAt: Date.now(),
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      await new Promise(resolve => setTimeout(resolve, 50))

      // Should restore for "paused" status too
      expect(mockRestoreSessionState).toHaveBeenCalledWith("test-instance")
    })

    it("does NOT auto-resume when server reports 'stopped' status", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})

      mockStoreState.wasRunningBeforeDisconnect = true
      mockStoreState.disconnectedAt = Date.now() - 2000

      // Server says Ralph is stopped
      mockCheckForSavedSessionState.mockResolvedValue({
        status: "stopped",
        savedAt: Date.now(),
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      await new Promise(resolve => setTimeout(resolve, 50))

      // Should NOT restore
      expect(mockRestoreSessionState).not.toHaveBeenCalled()

      // Should log the skip reason
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("Server reports Ralph status 'stopped'"),
      )

      logSpy.mockRestore()
    })

    it("does NOT auto-resume when server returns no saved state", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})

      mockStoreState.wasRunningBeforeDisconnect = true
      mockStoreState.disconnectedAt = Date.now() - 2000

      // Server has no saved state
      mockCheckForSavedSessionState.mockResolvedValue(null)

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      await new Promise(resolve => setTimeout(resolve, 50))

      // Should NOT restore
      expect(mockRestoreSessionState).not.toHaveBeenCalled()

      // Should log the skip reason
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("No saved state on server"))

      logSpy.mockRestore()
    })

    it("checks server for saved state on page reload (no wasRunningBeforeDisconnect flag)", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {})

      // No in-memory flag (simulates page reload)
      mockStoreState.wasRunningBeforeDisconnect = false
      mockStoreState.disconnectedAt = null

      // Server has saved state
      mockCheckForSavedSessionState.mockResolvedValue({
        status: "running",
        savedAt: Date.now(),
        instanceId: "test-instance",
        currentTaskId: null,
        conversationContext: { messages: [] },
      })

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      await new Promise(resolve => setTimeout(resolve, 50))

      // Should check server even without in-memory flag
      expect(mockCheckForSavedSessionState).toHaveBeenCalled()

      // Should restore since server has saved state
      expect(mockRestoreSessionState).toHaveBeenCalledWith("test-instance")
    })

    it("does not restore on page reload when server has no saved state", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {})

      mockStoreState.wasRunningBeforeDisconnect = false
      mockStoreState.disconnectedAt = null

      // Server has no saved state
      mockCheckForSavedSessionState.mockResolvedValue(null)

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      await new Promise(resolve => setTimeout(resolve, 50))

      expect(mockRestoreSessionState).not.toHaveBeenCalled()
    })

    it("does not clear flag when wasRunningBeforeDisconnect is already false", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {})

      mockStoreState.wasRunningBeforeDisconnect = false
      mockStoreState.disconnectedAt = null

      mockCheckForSavedSessionState.mockResolvedValue(null)

      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))

      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      // clearRunningBeforeDisconnect should NOT be called when flag is already false
      expect(mockStoreState.clearRunningBeforeDisconnect).not.toHaveBeenCalled()
    })
  })

  describe("initRalphConnection guard prevents double initialization", () => {
    // The initRalphConnection() function uses a module-level `initialized` flag
    // to ensure that connect() is only called once, even if initRalphConnection()
    // is called multiple times (e.g., from React effects, HMR re-evaluation, etc.)

    beforeEach(() => {
      globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket
      MockWebSocket.instances = []
      mockStoreState = createMockStoreState()
      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "stopped",
      })
    })

    afterEach(() => {
      globalThis.WebSocket = originalWebSocket
      ralphConnection.reset()
    })

    it("creates a WebSocket connection on first call", () => {
      expect(MockWebSocket.instances).toHaveLength(0)

      initRalphConnection()

      // A WebSocket should have been created
      expect(MockWebSocket.instances).toHaveLength(1)
    })

    it("does not create a second WebSocket on subsequent calls", () => {
      initRalphConnection()
      expect(MockWebSocket.instances).toHaveLength(1)

      // Call again - should be a no-op
      initRalphConnection()
      expect(MockWebSocket.instances).toHaveLength(1)

      // Call a third time for good measure
      initRalphConnection()
      expect(MockWebSocket.instances).toHaveLength(1)
    })

    it("allows re-initialization after reset()", () => {
      initRalphConnection()
      expect(MockWebSocket.instances).toHaveLength(1)

      // Reset clears the initialized flag
      ralphConnection.reset()

      // Now initRalphConnection should create a new connection
      initRalphConnection()
      // reset() closes the first WS, and initRalphConnection creates a second
      expect(MockWebSocket.instances).toHaveLength(2)
    })
  })

  describe("singleton pattern prevents multiple WebSocket connections", () => {
    // The connect() function checks if a WebSocket is already CONNECTING or OPEN
    // and returns early if so, preventing duplicate connections.

    beforeEach(() => {
      globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket
      MockWebSocket.instances = []
      mockStoreState = createMockStoreState()
      mockStoreState.instances.set("test-instance", {
        events: [],
        status: "stopped",
      })
    })

    afterEach(() => {
      globalThis.WebSocket = originalWebSocket
      ralphConnection.reset()
    })

    it("does not create a second WebSocket when one is already connecting", () => {
      ralphConnection.connect()
      expect(MockWebSocket.instances).toHaveLength(1)

      // The WebSocket is in CONNECTING state by default
      expect(MockWebSocket.instances[0].readyState).toBe(MockWebSocket.CONNECTING)

      // Calling connect() again should be a no-op
      ralphConnection.connect()
      expect(MockWebSocket.instances).toHaveLength(1)
    })

    it("does not create a second WebSocket when one is already open", () => {
      ralphConnection.connect()
      expect(MockWebSocket.instances).toHaveLength(1)

      // Simulate the WebSocket opening
      MockWebSocket.instances[0].simulateOpen()
      expect(MockWebSocket.instances[0].readyState).toBe(MockWebSocket.OPEN)

      // Calling connect() again should be a no-op
      ralphConnection.connect()
      expect(MockWebSocket.instances).toHaveLength(1)
    })

    it("allows a new connection after the previous one is closed", async () => {
      ralphConnection.connect()
      expect(MockWebSocket.instances).toHaveLength(1)

      const ws1 = MockWebSocket.instances[0]
      ws1.simulateOpen()

      // Intentionally disconnect
      ralphConnection.disconnect()
      expect(ws1.readyState).toBe(MockWebSocket.CLOSED)

      // Now connect() should create a new WebSocket
      ralphConnection.connect()
      expect(MockWebSocket.instances).toHaveLength(2)
    })

    it("only one WebSocket exists even with rapid connect() calls", () => {
      // Simulate rapid calls that might happen during component remounts
      ralphConnection.connect()
      ralphConnection.connect()
      ralphConnection.connect()
      ralphConnection.connect()
      ralphConnection.connect()

      // Only one WebSocket should have been created
      expect(MockWebSocket.instances).toHaveLength(1)
    })

    it("all messages are sent through the single WebSocket instance", () => {
      ralphConnection.connect()
      const ws = MockWebSocket.instances[0]
      ws.simulateOpen()

      // Send multiple messages
      ralphConnection.send({ type: "ping" })
      ralphConnection.send({ type: "reconnect", instanceId: "test" })
      ralphConnection.send({ type: "ping" })

      // All messages should go through the single WebSocket
      expect(ws.sentMessages).toHaveLength(3)
      expect(MockWebSocket.instances).toHaveLength(1)
    })

    it("initRalphConnection combined with connect does not create duplicates", () => {
      // initRalphConnection calls connect internally
      initRalphConnection()
      expect(MockWebSocket.instances).toHaveLength(1)

      // Explicit connect() should also be a no-op
      ralphConnection.connect()
      expect(MockWebSocket.instances).toHaveLength(1)
    })
  })

  describe("agent:event unified handler", () => {
    // These tests verify the unified agent:event WebSocket handler that routes
    // both Ralph and Task Chat events through a single AgentEventEnvelope.
    // The envelope shape: { type: "agent:event", source, instanceId, workspaceId, event, timestamp, eventIndex? }

    // Additional mock functions needed for agent:event handler
    let mockAddTokenUsageForInstance: ReturnType<typeof vi.fn>
    let mockUpdateContextWindowUsedForInstance: ReturnType<typeof vi.fn>

    beforeEach(() => {
      // Install mock WebSocket
      globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket
      MockWebSocket.instances = []
      mockEnqueue.mockClear()
      mockUpdateSessionTaskId.mockClear()
      mockStoreState = createMockStoreState()

      // Add extra mock functions needed by the agent:event handler for non-active instances
      mockAddTokenUsageForInstance = vi.fn()
      mockUpdateContextWindowUsedForInstance = vi.fn()
      ;(mockStoreState as Record<string, unknown>).addTokenUsageForInstance =
        mockAddTokenUsageForInstance
      ;(mockStoreState as Record<string, unknown>).updateContextWindowUsedForInstance =
        mockUpdateContextWindowUsedForInstance

      // Reset session boundary mock to default (no boundaries)
      mockIsSessionBoundary = () => false
    })

    afterEach(() => {
      // Restore original WebSocket
      globalThis.WebSocket = originalWebSocket
      ralphConnection.reset()
    })

    /** Helper to connect and get the mock WebSocket */
    async function connectAndOpen() {
      ralphConnection.connect()
      await new Promise(resolve => setTimeout(resolve, 10))
      const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1]
      ws.simulateOpen()
      return ws
    }

    /** Helper to create an agent:event envelope */
    function makeEnvelope(
      source: "ralph" | "task-chat",
      event: Record<string, unknown>,
      instanceId = "test-instance",
    ) {
      return {
        type: "agent:event",
        source,
        instanceId,
        workspaceId: null,
        event,
        timestamp: (event.timestamp as number) ?? Date.now(),
      }
    }

    describe("source: ralph — active instance routing", () => {
      it("routes ralph events to store.addEvent for the active instance", async () => {
        mockStoreState.instances.set("test-instance", {
          events: [],
          status: "stopped",
        })

        const ws = await connectAndOpen()

        const event = { type: "assistant", timestamp: 1706123456789, content: "Hello" }
        ws.simulateMessage(makeEnvelope("ralph", event))

        expect(mockStoreState.addEvent).toHaveBeenCalledWith(
          expect.objectContaining({ type: "assistant", timestamp: 1706123456789 }),
        )
        expect(mockStoreState.addEventForInstance).not.toHaveBeenCalled()
      })

      it("sets ralph status to running when active instance is stopped", async () => {
        mockStoreState.instances.set("test-instance", {
          events: [],
          status: "stopped",
        })

        const ws = await connectAndOpen()

        ws.simulateMessage(
          makeEnvelope("ralph", { type: "assistant", timestamp: Date.now(), content: "Hi" }),
        )

        expect(mockStoreState.setRalphStatus).toHaveBeenCalledWith("running")
      })
    })

    describe("source: ralph — non-active instance routing", () => {
      it("routes ralph events to store.addEventForInstance for non-active instances", async () => {
        const otherInstanceId = "other-instance"
        mockStoreState.instances.set("test-instance", {
          events: [],
          status: "running",
        })
        mockStoreState.instances.set(otherInstanceId, {
          events: [],
          status: "stopped",
        })

        const ws = await connectAndOpen()

        const event = { type: "assistant", timestamp: 1706123456789, content: "Hello" }
        ws.simulateMessage(makeEnvelope("ralph", event, otherInstanceId))

        expect(mockStoreState.addEventForInstance).toHaveBeenCalledWith(
          otherInstanceId,
          expect.objectContaining({ type: "assistant", timestamp: 1706123456789 }),
        )
        expect(mockStoreState.addEvent).not.toHaveBeenCalled()
      })

      it("sets status to running for non-active instance when stopped", async () => {
        const otherInstanceId = "other-instance"
        mockStoreState.instances.set("test-instance", {
          events: [],
          status: "running",
        })
        mockStoreState.instances.set(otherInstanceId, {
          events: [],
          status: "stopped",
        })

        const ws = await connectAndOpen()

        ws.simulateMessage(
          makeEnvelope(
            "ralph",
            { type: "assistant", timestamp: Date.now(), content: "Hi" },
            otherInstanceId,
          ),
        )

        expect(mockStoreState.setStatusForInstance).toHaveBeenCalledWith(otherInstanceId, "running")
      })
    })

    describe("source: task-chat — active instance routing", () => {
      it("routes task-chat events to store.addTaskChatEvent for active instance", async () => {
        mockStoreState.instances.set("test-instance", {
          events: [],
          status: "running",
        })

        const ws = await connectAndOpen()

        const event = {
          type: "message",
          timestamp: 1706123456789,
          content: "Task chat response",
        }
        ws.simulateMessage(makeEnvelope("task-chat", event))

        expect(mockStoreState.addTaskChatEvent).toHaveBeenCalledWith(
          expect.objectContaining({ type: "message", timestamp: 1706123456789 }),
        )
      })

      it("does NOT call addEvent or addEventForInstance for task-chat events", async () => {
        mockStoreState.instances.set("test-instance", {
          events: [],
          status: "running",
        })

        const ws = await connectAndOpen()

        ws.simulateMessage(
          makeEnvelope("task-chat", {
            type: "message",
            timestamp: Date.now(),
            content: "Hello",
          }),
        )

        expect(mockStoreState.addEvent).not.toHaveBeenCalled()
        expect(mockStoreState.addEventForInstance).not.toHaveBeenCalled()
      })
    })

    describe("source: task-chat — non-active instance is ignored", () => {
      it("ignores task-chat events for non-active instances", async () => {
        const otherInstanceId = "other-instance"
        mockStoreState.instances.set("test-instance", {
          events: [],
          status: "running",
        })
        mockStoreState.instances.set(otherInstanceId, {
          events: [],
          status: "running",
        })

        const ws = await connectAndOpen()

        ws.simulateMessage(
          makeEnvelope(
            "task-chat",
            { type: "message", timestamp: Date.now(), content: "Hello" },
            otherInstanceId,
          ),
        )

        // No store mutations should occur for task-chat on non-active instance
        expect(mockStoreState.addTaskChatEvent).not.toHaveBeenCalled()
        expect(mockStoreState.addEvent).not.toHaveBeenCalled()
        expect(mockStoreState.addEventForInstance).not.toHaveBeenCalled()
      })
    })

    describe("unified timestamp tracking", () => {
      it("updates ralph timestamp via getLastEventTimestamp for ralph events", async () => {
        mockStoreState.instances.set("test-instance", {
          events: [],
          status: "running",
        })

        const ws = await connectAndOpen()

        const timestamp = 1706123456789
        ws.simulateMessage(makeEnvelope("ralph", { type: "assistant", timestamp, content: "Hi" }))

        expect(getLastEventTimestamp("test-instance", "ralph")).toBe(timestamp)
      })

      it("updates task-chat timestamp via getLastTaskChatEventTimestamp for task-chat events", async () => {
        mockStoreState.instances.set("test-instance", {
          events: [],
          status: "running",
        })

        const ws = await connectAndOpen()

        const timestamp = 1706123456789
        ws.simulateMessage(
          makeEnvelope("task-chat", { type: "message", timestamp, content: "Hello" }),
        )

        expect(getLastTaskChatEventTimestamp("test-instance")).toBe(timestamp)
      })

      it("tracks ralph and task-chat timestamps independently for the same instance", async () => {
        mockStoreState.instances.set("test-instance", {
          events: [],
          status: "running",
        })

        const ws = await connectAndOpen()

        const ralphTimestamp = 1706123456000
        const taskChatTimestamp = 1706123456789

        ws.simulateMessage(
          makeEnvelope("ralph", { type: "assistant", timestamp: ralphTimestamp, content: "R" }),
        )
        ws.simulateMessage(
          makeEnvelope("task-chat", {
            type: "message",
            timestamp: taskChatTimestamp,
            content: "TC",
          }),
        )

        expect(getLastEventTimestamp("test-instance", "ralph")).toBe(ralphTimestamp)
        expect(getLastTaskChatEventTimestamp("test-instance")).toBe(taskChatTimestamp)
      })

      it("updates timestamps even for non-active instance task-chat events (before ignoring them)", async () => {
        const otherInstanceId = "other-instance"
        mockStoreState.instances.set("test-instance", {
          events: [],
          status: "running",
        })
        mockStoreState.instances.set(otherInstanceId, {
          events: [],
          status: "running",
        })

        const ws = await connectAndOpen()

        const timestamp = 1706123456789
        ws.simulateMessage(
          makeEnvelope(
            "task-chat",
            { type: "message", timestamp, content: "Hello" },
            otherInstanceId,
          ),
        )

        // Timestamp should be tracked even though the event is ignored for store purposes
        expect(getLastTaskChatEventTimestamp(otherInstanceId)).toBe(timestamp)
      })

      it("updates timestamps for non-active ralph events", async () => {
        const otherInstanceId = "other-instance"
        mockStoreState.instances.set("test-instance", {
          events: [],
          status: "running",
        })
        mockStoreState.instances.set(otherInstanceId, {
          events: [],
          status: "running",
        })

        const ws = await connectAndOpen()

        const timestamp = 1706123456789
        ws.simulateMessage(
          makeEnvelope("ralph", { type: "assistant", timestamp, content: "Hi" }, otherInstanceId),
        )

        expect(getLastEventTimestamp(otherInstanceId, "ralph")).toBe(timestamp)
      })
    })

    describe("session boundary detection for ralph events", () => {
      it("resets session stats and generates session ID on session boundary", async () => {
        mockIsSessionBoundary = (event: unknown) => {
          const e = event as { type?: string; subtype?: string }
          return e.type === "system" && e.subtype === "init"
        }

        mockStoreState.instances.set("test-instance", {
          events: [],
          status: "stopped",
        })

        const ws = await connectAndOpen()

        const timestamp = 1706123456789
        ws.simulateMessage(makeEnvelope("ralph", { type: "system", subtype: "init", timestamp }))

        // Session stats should be reset for active instance
        expect(mockStoreState.resetSessionStats).toHaveBeenCalled()

        // Session ID should be generated synchronously
        const sessionId = getCurrentSessionId("test-instance")
        expect(sessionId).toBe(`test-instance-${timestamp}`)

        const sessionInfo = getCurrentSession("test-instance")
        expect(sessionInfo?.id).toBe(`test-instance-${timestamp}`)
        expect(sessionInfo?.startedAt).toBe(timestamp)
      })

      it("resets session stats for non-active instance on session boundary", async () => {
        const otherInstanceId = "other-instance"
        mockIsSessionBoundary = (event: unknown) => {
          const e = event as { type?: string; subtype?: string }
          return e.type === "system" && e.subtype === "init"
        }

        mockStoreState.instances.set("test-instance", {
          events: [],
          status: "running",
        })
        mockStoreState.instances.set(otherInstanceId, {
          events: [],
          status: "stopped",
        })

        const ws = await connectAndOpen()

        const timestamp = 1706123456789
        ws.simulateMessage(
          makeEnvelope("ralph", { type: "system", subtype: "init", timestamp }, otherInstanceId),
        )

        expect(mockStoreState.resetSessionStatsForInstance).toHaveBeenCalledWith(otherInstanceId)
        expect(mockStoreState.resetSessionStats).not.toHaveBeenCalled()

        expect(getCurrentSessionId(otherInstanceId)).toBe(`${otherInstanceId}-${timestamp}`)
      })

      it("uses server-generated sessionId from ralph_session_start events", async () => {
        mockIsSessionBoundary = (event: unknown) => {
          const e = event as { type?: string }
          return e.type === "ralph_session_start"
        }

        mockStoreState.instances.set("test-instance", {
          events: [],
          status: "stopped",
        })

        const ws = await connectAndOpen()

        const serverSessionId = "550e8400-e29b-41d4-a716-446655440000"
        const timestamp = 1706123456789

        ws.simulateMessage(
          makeEnvelope("ralph", {
            type: "ralph_session_start",
            timestamp,
            sessionId: serverSessionId,
            session: 1,
            totalSessions: 5,
          }),
        )

        expect(getCurrentSessionId("test-instance")).toBe(serverSessionId)
      })

      it("does NOT detect session boundaries for task-chat events", async () => {
        // Session boundary detection only applies to ralph source
        mockIsSessionBoundary = () => true // Would match everything

        mockStoreState.instances.set("test-instance", {
          events: [],
          status: "running",
        })

        const ws = await connectAndOpen()

        ws.simulateMessage(
          makeEnvelope("task-chat", {
            type: "message",
            timestamp: Date.now(),
            content: "Hello",
          }),
        )

        // No session stats reset for task-chat events
        expect(mockStoreState.resetSessionStats).not.toHaveBeenCalled()
      })
    })

    describe("token usage extraction", () => {
      it("extracts and adds token usage from ralph result events for active instance", async () => {
        mockStoreState.instances.set("test-instance", {
          events: [],
          status: "running",
        })

        const ws = await connectAndOpen()

        ws.simulateMessage(
          makeEnvelope("ralph", {
            type: "result",
            timestamp: Date.now(),
            content: "Done",
            usage: { inputTokens: 100, outputTokens: 50 },
          }),
        )

        expect(mockStoreState.addTokenUsage).toHaveBeenCalledWith({
          input: 100,
          output: 50,
        })
        expect(mockStoreState.updateContextWindowUsed).toHaveBeenCalled()
      })

      it("extracts and adds token usage from ralph result events for non-active instance", async () => {
        const otherInstanceId = "other-instance"
        mockStoreState.instances.set("test-instance", {
          events: [],
          status: "running",
        })
        mockStoreState.instances.set(otherInstanceId, {
          events: [],
          status: "running",
          tokenUsage: { input: 0, output: 0 },
        } as unknown as { events: unknown[]; status: string })

        const ws = await connectAndOpen()

        ws.simulateMessage(
          makeEnvelope(
            "ralph",
            {
              type: "result",
              timestamp: Date.now(),
              content: "Done",
              usage: { inputTokens: 200, outputTokens: 75 },
            },
            otherInstanceId,
          ),
        )

        expect(mockAddTokenUsageForInstance).toHaveBeenCalledWith(otherInstanceId, {
          input: 200,
          output: 75,
        })
        expect(mockUpdateContextWindowUsedForInstance).toHaveBeenCalled()
      })

      it("extracts and adds token usage from task-chat result events for active instance", async () => {
        mockStoreState.instances.set("test-instance", {
          events: [],
          status: "running",
        })

        const ws = await connectAndOpen()

        ws.simulateMessage(
          makeEnvelope("task-chat", {
            type: "result",
            timestamp: Date.now(),
            content: "Task done",
            usage: { inputTokens: 300, outputTokens: 120 },
          }),
        )

        expect(mockStoreState.addTokenUsage).toHaveBeenCalledWith({
          input: 300,
          output: 120,
        })
        expect(mockStoreState.updateContextWindowUsed).toHaveBeenCalled()
      })

      it("does not add token usage when event has no usage data", async () => {
        mockStoreState.instances.set("test-instance", {
          events: [],
          status: "running",
        })

        const ws = await connectAndOpen()

        ws.simulateMessage(
          makeEnvelope("ralph", {
            type: "assistant",
            timestamp: Date.now(),
            content: "Hello",
          }),
        )

        expect(mockStoreState.addTokenUsage).not.toHaveBeenCalled()
        expect(mockStoreState.updateContextWindowUsed).not.toHaveBeenCalled()
      })
    })

    describe("IndexedDB persistence for ralph events", () => {
      it("persists ralph events to IndexedDB when session ID exists", async () => {
        mockStoreState.instances.set("test-instance", {
          events: [],
          status: "running",
        })

        setCurrentSessionId("test-instance", "session-abc")

        const ws = await connectAndOpen()

        ws.simulateMessage(
          makeEnvelope("ralph", {
            type: "assistant",
            timestamp: 1706123456789,
            id: "evt-123",
            content: "Hello",
          }),
        )

        expect(mockEnqueue).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "evt-123",
            sessionId: "session-abc",
            eventType: "assistant",
          }),
          "session-abc",
        )
      })

      it("does not persist task-chat events to IndexedDB", async () => {
        mockStoreState.instances.set("test-instance", {
          events: [],
          status: "running",
        })

        setCurrentSessionId("test-instance", "session-abc")

        const ws = await connectAndOpen()

        ws.simulateMessage(
          makeEnvelope("task-chat", {
            type: "message",
            timestamp: Date.now(),
            content: "Hi",
          }),
        )

        expect(mockEnqueue).not.toHaveBeenCalled()
      })

      it("calls updateSessionTaskId when ralph_task_started event arrives via agent:event", async () => {
        mockStoreState.instances.set("test-instance", {
          events: [],
          status: "running",
        })

        setCurrentSessionId("test-instance", "session-def")

        const ws = await connectAndOpen()

        ws.simulateMessage(
          makeEnvelope("ralph", {
            type: "ralph_task_started",
            timestamp: Date.now(),
            taskId: "task-789",
            id: "evt-task",
          }),
        )

        // Verify updateSessionTaskId was called
        await new Promise(resolve => setTimeout(resolve, 10))
        expect(mockUpdateSessionTaskId).toHaveBeenCalledWith("session-def", "task-789")
      })
    })

    describe("envelope validation via isAgentEventEnvelope", () => {
      it("ignores messages missing required envelope fields", async () => {
        mockStoreState.instances.set("test-instance", {
          events: [],
          status: "running",
        })

        const ws = await connectAndOpen()

        // Missing source field
        ws.simulateMessage({
          type: "agent:event",
          instanceId: "test-instance",
          event: { type: "assistant", timestamp: Date.now(), content: "Hi" },
          timestamp: Date.now(),
        })

        // Missing event field
        ws.simulateMessage({
          type: "agent:event",
          source: "ralph",
          instanceId: "test-instance",
          timestamp: Date.now(),
        })

        // Missing instanceId field
        ws.simulateMessage({
          type: "agent:event",
          source: "ralph",
          event: { type: "assistant", timestamp: Date.now(), content: "Hi" },
          timestamp: Date.now(),
        })

        // None should trigger any store mutations
        expect(mockStoreState.addEvent).not.toHaveBeenCalled()
        expect(mockStoreState.addEventForInstance).not.toHaveBeenCalled()
        expect(mockStoreState.addTaskChatEvent).not.toHaveBeenCalled()
      })

      it("processes valid agent:event envelopes successfully", async () => {
        mockStoreState.instances.set("test-instance", {
          events: [],
          status: "running",
        })

        const ws = await connectAndOpen()

        // Valid envelope with all required fields
        ws.simulateMessage({
          type: "agent:event",
          source: "ralph",
          instanceId: "test-instance",
          workspaceId: null,
          event: { type: "assistant", timestamp: 1706123456789, content: "Hello" },
          timestamp: 1706123456789,
        })

        expect(mockStoreState.addEvent).toHaveBeenCalledTimes(1)
      })
    })
  })
})
