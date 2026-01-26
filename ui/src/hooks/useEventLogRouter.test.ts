import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useEventLogRouter, parseEventLogHash, buildEventLogHash } from "./useEventLogRouter"
import { useAppStore } from "../store"
import { eventDatabase, type PersistedSession, type PersistedEvent } from "@/lib/persistence"

// Mock eventDatabase
vi.mock("@/lib/persistence", async () => {
  const actual = await vi.importActual("@/lib/persistence")
  return {
    ...actual,
    eventDatabase: {
      init: vi.fn().mockResolvedValue(undefined),
      getSession: vi.fn(),
      getEventsForSession: vi.fn(),
    },
  }
})

const mockEventDatabase = eventDatabase as unknown as {
  init: ReturnType<typeof vi.fn>
  getSession: ReturnType<typeof vi.fn>
  getEventsForSession: ReturnType<typeof vi.fn>
}

describe("parseEventLogHash", () => {
  it("returns null for empty hash", () => {
    expect(parseEventLogHash("")).toBeNull()
    expect(parseEventLogHash("#")).toBeNull()
  })

  it("returns null for hash without session or eventlog prefix", () => {
    expect(parseEventLogHash("#something")).toBeNull()
    expect(parseEventLogHash("#task=123")).toBeNull()
  })

  it("returns null for invalid session ID format", () => {
    // Empty ID
    expect(parseEventLogHash("#session=")).toBeNull()
    // Invalid characters (spaces, special chars)
    expect(parseEventLogHash("#session=abc def")).toBeNull()
    expect(parseEventLogHash("#session=abc@def")).toBeNull()
  })

  it("returns ID for valid session hash (new format)", () => {
    expect(parseEventLogHash("#session=default-1706123456789")).toBe("default-1706123456789")
    expect(parseEventLogHash("#session=abc123")).toBe("abc123")
    expect(parseEventLogHash("#session=session-42")).toBe("session-42")
    expect(parseEventLogHash("#session=MySession2025")).toBe("MySession2025")
  })

  it("returns ID for valid legacy eventlog hash (backward compatibility)", () => {
    expect(parseEventLogHash("#eventlog=abcdef12")).toBe("abcdef12")
    expect(parseEventLogHash("#eventlog=12345678")).toBe("12345678")
    expect(parseEventLogHash("#eventlog=ABCDEF00")).toBe("ABCDEF00")
  })

  it("returns null for invalid legacy eventlog ID format", () => {
    // Too short
    expect(parseEventLogHash("#eventlog=abc")).toBeNull()
    // Too long
    expect(parseEventLogHash("#eventlog=abcdef123")).toBeNull()
    // Invalid characters
    expect(parseEventLogHash("#eventlog=ghijklmn")).toBeNull()
    // Empty ID
    expect(parseEventLogHash("#eventlog=")).toBeNull()
  })

  it("handles hash with leading # already removed", () => {
    expect(parseEventLogHash("session=default-123")).toBe("default-123")
    expect(parseEventLogHash("eventlog=abcdef12")).toBe("abcdef12")
  })
})

describe("buildEventLogHash", () => {
  it("builds a valid hash string with new session= format", () => {
    expect(buildEventLogHash("default-1706123456789")).toBe("#session=default-1706123456789")
    expect(buildEventLogHash("abcdef12")).toBe("#session=abcdef12")
  })
})

describe("useEventLogRouter", () => {
  // Store the original window.location.hash
  let originalHash: string
  let originalPushState: typeof window.history.pushState

  beforeEach(() => {
    originalHash = window.location.hash
    originalPushState = window.history.pushState

    // Clear the hash first
    window.history.pushState(null, "", window.location.pathname + window.location.search)

    // Reset the store before each test
    useAppStore.getState().clearEventLogViewer()

    // Reset eventDatabase mocks
    mockEventDatabase.init.mockReset()
    mockEventDatabase.getSession.mockReset()
    mockEventDatabase.getEventsForSession.mockReset()
    mockEventDatabase.init.mockResolvedValue(undefined)
    mockEventDatabase.getEventsForSession.mockResolvedValue([])
  })

  afterEach(() => {
    // Restore window.location.hash
    window.history.pushState(
      null,
      "",
      window.location.pathname + window.location.search + originalHash,
    )
    window.history.pushState = originalPushState
  })

  it("returns navigateToEventLog and closeEventLogViewer functions", () => {
    const { result } = renderHook(() => useEventLogRouter())

    expect(result.current.navigateToEventLog).toBeInstanceOf(Function)
    expect(result.current.closeEventLogViewer).toBeInstanceOf(Function)
    expect(result.current.eventLogId).toBeNull()
  })

  it("navigateToEventLog updates the URL hash with new session= format", () => {
    const { result } = renderHook(() => useEventLogRouter())

    act(() => {
      result.current.navigateToEventLog("default-1706123456789")
    })

    expect(window.location.hash).toBe("#session=default-1706123456789")
  })

  it("closeEventLogViewer clears the URL hash", () => {
    window.location.hash = "#session=default-123"
    window.history.pushState = vi.fn()

    const { result } = renderHook(() => useEventLogRouter())

    act(() => {
      result.current.closeEventLogViewer()
    })

    expect(window.history.pushState).toHaveBeenCalled()
    expect(useAppStore.getState().viewingEventLogId).toBeNull()
  })

  it("parses session ID from URL on mount and fetches data from IndexedDB", async () => {
    const mockSession: PersistedSession = {
      id: "default-123",
      instanceId: "test-instance",
      workspaceId: null,
      startedAt: 1704067200000, // 2025-01-01T00:00:00Z
      completedAt: null,
      taskId: "task-123",
      taskTitle: null,
      tokenUsage: { input: 0, output: 0 },
      contextWindow: { used: 0, max: 100000 },
      session: { current: 0, total: 1 },
      eventCount: 1,
      lastEventSequence: 1,
    }

    const mockEvents: PersistedEvent[] = [
      {
        id: "default-123-event-0",
        sessionId: "default-123",
        timestamp: 1234567890,
        eventType: "test",
        event: { type: "test", timestamp: 1234567890 } as PersistedEvent["event"],
      },
    ]

    mockEventDatabase.getSession.mockResolvedValue(mockSession)
    mockEventDatabase.getEventsForSession.mockResolvedValue(mockEvents)

    window.location.hash = "#session=default-123"

    renderHook(() => useEventLogRouter())

    await waitFor(() => {
      expect(mockEventDatabase.getSession).toHaveBeenCalledWith("default-123")
    })

    await waitFor(() => {
      expect(mockEventDatabase.getEventsForSession).toHaveBeenCalledWith("default-123")
    })

    await waitFor(() => {
      expect(useAppStore.getState().viewingEventLogId).toBe("default-123")
    })

    await waitFor(() => {
      const eventLog = useAppStore.getState().viewingEventLog
      expect(eventLog).toBeTruthy()
      expect(eventLog!.id).toBe("default-123")
      expect(eventLog!.metadata?.taskId).toBe("task-123")
    })
  })

  it("parses legacy eventlog ID from URL for backward compatibility", async () => {
    const mockSession: PersistedSession = {
      id: "abcdef12",
      instanceId: "test-instance",
      workspaceId: null,
      startedAt: 1704067200000,
      completedAt: null,
      taskId: "task-123",
      taskTitle: null,
      tokenUsage: { input: 0, output: 0 },
      contextWindow: { used: 0, max: 100000 },
      session: { current: 0, total: 1 },
      eventCount: 0,
      lastEventSequence: 0,
    }

    mockEventDatabase.getSession.mockResolvedValue(mockSession)
    mockEventDatabase.getEventsForSession.mockResolvedValue([])

    window.location.hash = "#eventlog=abcdef12"

    renderHook(() => useEventLogRouter())

    await waitFor(() => {
      expect(mockEventDatabase.getSession).toHaveBeenCalledWith("abcdef12")
    })

    await waitFor(() => {
      expect(useAppStore.getState().viewingEventLogId).toBe("abcdef12")
    })
  })

  it("sets error state when session not found in IndexedDB", async () => {
    mockEventDatabase.getSession.mockResolvedValue(undefined)

    window.location.hash = "#session=nonexistent-123"

    renderHook(() => useEventLogRouter())

    await waitFor(() => {
      expect(mockEventDatabase.getSession).toHaveBeenCalledWith("nonexistent-123")
    })

    await waitFor(() => {
      expect(useAppStore.getState().eventLogError).toBe("Session not found")
    })

    expect(useAppStore.getState().viewingEventLog).toBeNull()
  })

  it("sets error state when IndexedDB operation throws", async () => {
    mockEventDatabase.getSession.mockRejectedValue(new Error("Database error"))

    window.location.hash = "#session=default-123"

    renderHook(() => useEventLogRouter())

    await waitFor(() => {
      expect(useAppStore.getState().eventLogError).toBe("Database error")
    })
  })

  it("clears event log when hash is removed", async () => {
    const mockSession: PersistedSession = {
      id: "default-123",
      instanceId: "test-instance",
      workspaceId: null,
      startedAt: 1704067200000,
      completedAt: null,
      taskId: null,
      taskTitle: null,
      tokenUsage: { input: 0, output: 0 },
      contextWindow: { used: 0, max: 100000 },
      session: { current: 0, total: 1 },
      eventCount: 0,
      lastEventSequence: 0,
    }

    mockEventDatabase.getSession.mockResolvedValue(mockSession)
    mockEventDatabase.getEventsForSession.mockResolvedValue([])

    window.location.hash = "#session=default-123"

    renderHook(() => useEventLogRouter())

    // Wait for initial load from IndexedDB
    await waitFor(() => {
      expect(useAppStore.getState().viewingEventLogId).toBe("default-123")
    })

    // Clear the hash
    act(() => {
      window.history.pushState(null, "", window.location.pathname + window.location.search)
      window.dispatchEvent(new HashChangeEvent("hashchange"))
    })

    await waitFor(() => {
      expect(useAppStore.getState().viewingEventLogId).toBeNull()
      expect(useAppStore.getState().viewingEventLog).toBeNull()
    })
  })

  it("responds to hashchange events", async () => {
    const mockSession1: PersistedSession = {
      id: "session-1",
      instanceId: "test-instance",
      workspaceId: null,
      startedAt: 1704067200000,
      completedAt: null,
      taskId: null,
      taskTitle: null,
      tokenUsage: { input: 0, output: 0 },
      contextWindow: { used: 0, max: 100000 },
      session: { current: 0, total: 1 },
      eventCount: 0,
      lastEventSequence: 0,
    }
    const mockSession2: PersistedSession = {
      id: "session-2",
      instanceId: "test-instance",
      workspaceId: null,
      startedAt: 1704153600000,
      completedAt: null,
      taskId: null,
      taskTitle: null,
      tokenUsage: { input: 0, output: 0 },
      contextWindow: { used: 0, max: 100000 },
      session: { current: 0, total: 1 },
      eventCount: 0,
      lastEventSequence: 0,
    }

    mockEventDatabase.getSession
      .mockResolvedValueOnce(mockSession1)
      .mockResolvedValueOnce(mockSession2)
    mockEventDatabase.getEventsForSession.mockResolvedValue([])

    window.location.hash = "#session=session-1"

    renderHook(() => useEventLogRouter())

    await waitFor(() => {
      expect(useAppStore.getState().viewingEventLogId).toBe("session-1")
    })

    // Change hash
    act(() => {
      window.location.hash = "#session=session-2"
      window.dispatchEvent(new HashChangeEvent("hashchange"))
    })

    await waitFor(() => {
      expect(useAppStore.getState().viewingEventLogId).toBe("session-2")
    })
  })

  it("sets loading state during IndexedDB lookup", async () => {
    // Create a promise we can control
    let resolvePromise: (value: PersistedSession) => void
    const dbPromise = new Promise<PersistedSession>(resolve => {
      resolvePromise = resolve
    })

    mockEventDatabase.getSession.mockReturnValue(dbPromise)
    mockEventDatabase.getEventsForSession.mockResolvedValue([])

    window.location.hash = "#session=default-123"

    renderHook(() => useEventLogRouter())

    // Should be loading
    await waitFor(() => {
      expect(useAppStore.getState().eventLogLoading).toBe(true)
    })

    // Resolve the database lookup
    await act(async () => {
      resolvePromise!({
        id: "default-123",
        instanceId: "test-instance",
        workspaceId: null,
        startedAt: 1704067200000,
        completedAt: null,
        taskId: null,
        taskTitle: null,
        tokenUsage: { input: 0, output: 0 },
        contextWindow: { used: 0, max: 100000 },
        session: { current: 0, total: 1 },
        eventCount: 0,
        lastEventSequence: 0,
      })
    })

    // Should no longer be loading
    await waitFor(() => {
      expect(useAppStore.getState().eventLogLoading).toBe(false)
    })
  })

  it("returns current eventLogId from store", async () => {
    const mockSession: PersistedSession = {
      id: "default-123",
      instanceId: "test-instance",
      workspaceId: null,
      startedAt: 1704067200000,
      completedAt: null,
      taskId: null,
      taskTitle: null,
      tokenUsage: { input: 0, output: 0 },
      contextWindow: { used: 0, max: 100000 },
      session: { current: 0, total: 1 },
      eventCount: 0,
      lastEventSequence: 0,
    }

    mockEventDatabase.getSession.mockResolvedValue(mockSession)
    mockEventDatabase.getEventsForSession.mockResolvedValue([])

    window.location.hash = "#session=default-123"

    const { result } = renderHook(() => useEventLogRouter())

    await waitFor(() => {
      expect(result.current.eventLogId).toBe("default-123")
    })
  })
})
