import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import {
  useEventLogRouter,
  parseSessionIdFromUrl,
  buildSessionPath,
  parseEventLogHash,
  buildEventLogHash,
} from "./useEventLogRouter"
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

describe("parseSessionIdFromUrl", () => {
  it("returns null for root path without session", () => {
    expect(parseSessionIdFromUrl({ pathname: "/", hash: "" })).toBeNull()
  })

  it("returns null for unrelated paths", () => {
    expect(parseSessionIdFromUrl({ pathname: "/issue/r-abc123", hash: "" })).toBeNull()
    expect(parseSessionIdFromUrl({ pathname: "/something", hash: "" })).toBeNull()
  })

  it("returns ID for valid /session/{id} path format", () => {
    expect(parseSessionIdFromUrl({ pathname: "/session/default-1706123456789", hash: "" })).toBe(
      "default-1706123456789",
    )
    expect(parseSessionIdFromUrl({ pathname: "/session/abc123", hash: "" })).toBe("abc123")
    expect(parseSessionIdFromUrl({ pathname: "/session/session-42", hash: "" })).toBe("session-42")
    expect(parseSessionIdFromUrl({ pathname: "/session/MySession2025", hash: "" })).toBe(
      "MySession2025",
    )
  })

  it("returns ID for legacy #session= hash format (backward compatibility)", () => {
    expect(parseSessionIdFromUrl({ pathname: "/", hash: "#session=default-123" })).toBe(
      "default-123",
    )
    expect(parseSessionIdFromUrl({ pathname: "/", hash: "#session=abc123" })).toBe("abc123")
  })

  it("returns ID for legacy #eventlog= hash format (backward compatibility)", () => {
    expect(parseSessionIdFromUrl({ pathname: "/", hash: "#eventlog=abcdef12" })).toBe("abcdef12")
    expect(parseSessionIdFromUrl({ pathname: "/", hash: "#eventlog=12345678" })).toBe("12345678")
    expect(parseSessionIdFromUrl({ pathname: "/", hash: "#eventlog=ABCDEF00" })).toBe("ABCDEF00")
  })

  it("returns null for invalid legacy eventlog ID format", () => {
    // Too short
    expect(parseSessionIdFromUrl({ pathname: "/", hash: "#eventlog=abc" })).toBeNull()
    // Too long
    expect(parseSessionIdFromUrl({ pathname: "/", hash: "#eventlog=abcdef123" })).toBeNull()
    // Invalid characters
    expect(parseSessionIdFromUrl({ pathname: "/", hash: "#eventlog=ghijklmn" })).toBeNull()
  })

  it("prefers path over hash if both present", () => {
    expect(
      parseSessionIdFromUrl({ pathname: "/session/from-path", hash: "#session=from-hash" }),
    ).toBe("from-path")
  })
})

describe("buildSessionPath", () => {
  it("builds a valid path with /session/{id} format", () => {
    expect(buildSessionPath("default-1706123456789")).toBe("/session/default-1706123456789")
    expect(buildSessionPath("abcdef12")).toBe("/session/abcdef12")
  })
})

// Legacy exports for backward compatibility
describe("parseEventLogHash (legacy)", () => {
  it("returns null for empty hash", () => {
    expect(parseEventLogHash("")).toBeNull()
    expect(parseEventLogHash("#")).toBeNull()
  })

  it("returns ID for valid session hash", () => {
    expect(parseEventLogHash("#session=default-123")).toBe("default-123")
  })

  it("returns ID for valid legacy eventlog hash", () => {
    expect(parseEventLogHash("#eventlog=abcdef12")).toBe("abcdef12")
  })
})

describe("buildEventLogHash (legacy)", () => {
  it("builds a valid hash string with session= format", () => {
    expect(buildEventLogHash("default-1706123456789")).toBe("#session=default-1706123456789")
    expect(buildEventLogHash("abcdef12")).toBe("#session=abcdef12")
  })
})

describe("useEventLogRouter", () => {
  // Store the original pushState for direct URL manipulation in tests
  const originalPushState = window.history.pushState.bind(window.history)
  let pushStateSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    pushStateSpy = vi.spyOn(window.history, "pushState")

    // Navigate to root first
    originalPushState(null, "", "/")

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
    vi.restoreAllMocks()
    // Navigate back to root
    originalPushState(null, "", "/")
  })

  it("returns navigateToEventLog and closeEventLogViewer functions", () => {
    const { result } = renderHook(() => useEventLogRouter())

    expect(result.current.navigateToEventLog).toBeInstanceOf(Function)
    expect(result.current.closeEventLogViewer).toBeInstanceOf(Function)
    expect(result.current.eventLogId).toBeNull()
  })

  it("navigateToEventLog updates the URL to /session/{id} path format", async () => {
    mockEventDatabase.getSession.mockResolvedValue({
      id: "default-1706123456789",
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

    const { result } = renderHook(() => useEventLogRouter())

    act(() => {
      result.current.navigateToEventLog("default-1706123456789")
    })

    expect(pushStateSpy).toHaveBeenCalledWith(
      { sessionId: "default-1706123456789" },
      "",
      "/session/default-1706123456789",
    )
  })

  it("closeEventLogViewer clears the URL and navigates to root", () => {
    // Navigate to a session URL first
    originalPushState(null, "", "/session/default-123")
    pushStateSpy.mockClear()

    const { result } = renderHook(() => useEventLogRouter())

    act(() => {
      result.current.closeEventLogViewer()
    })

    expect(pushStateSpy).toHaveBeenCalledWith(null, "", "/")
    expect(useAppStore.getState().viewingEventLogId).toBeNull()
  })

  it("parses session ID from /session/{id} path on mount and fetches data from IndexedDB", async () => {
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

    // Navigate to /session/{id} URL
    originalPushState(null, "", "/session/default-123")

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

  it("parses legacy #session= hash for backward compatibility", async () => {
    const mockSession: PersistedSession = {
      id: "default-456",
      instanceId: "test-instance",
      workspaceId: null,
      startedAt: 1704067200000,
      completedAt: null,
      taskId: "task-456",
      taskTitle: null,
      tokenUsage: { input: 0, output: 0 },
      contextWindow: { used: 0, max: 100000 },
      session: { current: 0, total: 1 },
      eventCount: 0,
      lastEventSequence: 0,
    }

    mockEventDatabase.getSession.mockResolvedValue(mockSession)
    mockEventDatabase.getEventsForSession.mockResolvedValue([])

    // Use legacy hash format
    originalPushState(null, "", "/#session=default-456")

    renderHook(() => useEventLogRouter())

    await waitFor(() => {
      expect(mockEventDatabase.getSession).toHaveBeenCalledWith("default-456")
    })

    await waitFor(() => {
      expect(useAppStore.getState().viewingEventLogId).toBe("default-456")
    })
  })

  it("parses legacy #eventlog= hash for backward compatibility", async () => {
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

    // Use legacy eventlog hash format
    originalPushState(null, "", "/#eventlog=abcdef12")

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

    originalPushState(null, "", "/session/nonexistent-123")

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

    originalPushState(null, "", "/session/default-123")

    renderHook(() => useEventLogRouter())

    await waitFor(() => {
      expect(useAppStore.getState().eventLogError).toBe("Database error")
    })
  })

  it("clears event log when URL path is cleared", async () => {
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

    originalPushState(null, "", "/session/default-123")

    renderHook(() => useEventLogRouter())

    // Wait for initial load from IndexedDB
    await waitFor(() => {
      expect(useAppStore.getState().viewingEventLogId).toBe("default-123")
    })

    // Navigate back to root
    act(() => {
      originalPushState(null, "", "/")
      window.dispatchEvent(new PopStateEvent("popstate"))
    })

    await waitFor(() => {
      expect(useAppStore.getState().viewingEventLogId).toBeNull()
      expect(useAppStore.getState().viewingEventLog).toBeNull()
    })
  })

  it("responds to popstate events for browser navigation", async () => {
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

    originalPushState(null, "", "/session/session-1")

    renderHook(() => useEventLogRouter())

    await waitFor(() => {
      expect(useAppStore.getState().viewingEventLogId).toBe("session-1")
    })

    // Simulate browser navigation to a different session
    act(() => {
      originalPushState(null, "", "/session/session-2")
      window.dispatchEvent(new PopStateEvent("popstate"))
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

    originalPushState(null, "", "/session/default-123")

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

    originalPushState(null, "", "/session/default-123")

    const { result } = renderHook(() => useEventLogRouter())

    await waitFor(() => {
      expect(result.current.eventLogId).toBe("default-123")
    })
  })
})
