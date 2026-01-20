import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useEventLogRouter, parseEventLogHash, buildEventLogHash } from "./useEventLogRouter"
import { useAppStore } from "../store"

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe("parseEventLogHash", () => {
  it("returns null for empty hash", () => {
    expect(parseEventLogHash("")).toBeNull()
    expect(parseEventLogHash("#")).toBeNull()
  })

  it("returns null for hash without eventlog prefix", () => {
    expect(parseEventLogHash("#something")).toBeNull()
    expect(parseEventLogHash("#task=123")).toBeNull()
  })

  it("returns null for invalid eventlog ID format", () => {
    // Too short
    expect(parseEventLogHash("#eventlog=abc")).toBeNull()
    // Too long
    expect(parseEventLogHash("#eventlog=abcdef123")).toBeNull()
    // Invalid characters
    expect(parseEventLogHash("#eventlog=ghijklmn")).toBeNull()
    // Empty ID
    expect(parseEventLogHash("#eventlog=")).toBeNull()
  })

  it("returns ID for valid eventlog hash", () => {
    expect(parseEventLogHash("#eventlog=abcdef12")).toBe("abcdef12")
    expect(parseEventLogHash("#eventlog=12345678")).toBe("12345678")
    expect(parseEventLogHash("#eventlog=ABCDEF00")).toBe("ABCDEF00")
  })

  it("handles hash with leading # already removed", () => {
    expect(parseEventLogHash("eventlog=abcdef12")).toBe("abcdef12")
  })
})

describe("buildEventLogHash", () => {
  it("builds a valid hash string", () => {
    expect(buildEventLogHash("abcdef12")).toBe("#eventlog=abcdef12")
    expect(buildEventLogHash("12345678")).toBe("#eventlog=12345678")
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

    // Reset fetch mock
    mockFetch.mockReset()
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

  it("navigateToEventLog updates the URL hash", () => {
    const { result } = renderHook(() => useEventLogRouter())

    act(() => {
      result.current.navigateToEventLog("abcdef12")
    })

    expect(window.location.hash).toBe("#eventlog=abcdef12")
  })

  it("closeEventLogViewer clears the URL hash", () => {
    window.location.hash = "#eventlog=abcdef12"
    window.history.pushState = vi.fn()

    const { result } = renderHook(() => useEventLogRouter())

    act(() => {
      result.current.closeEventLogViewer()
    })

    expect(window.history.pushState).toHaveBeenCalled()
    expect(useAppStore.getState().viewingEventLogId).toBeNull()
  })

  it("parses eventlog ID from URL on mount and fetches data", async () => {
    const mockEventLog = {
      id: "abcdef12",
      createdAt: "2025-01-01T00:00:00Z",
      events: [{ type: "test", timestamp: 1234567890 }],
      metadata: { taskId: "task-123" },
    }

    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ ok: true, eventlog: mockEventLog }),
    })

    window.location.hash = "#eventlog=abcdef12"

    renderHook(() => useEventLogRouter())

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/eventlogs/abcdef12")
    })

    await waitFor(() => {
      expect(useAppStore.getState().viewingEventLogId).toBe("abcdef12")
    })

    await waitFor(() => {
      expect(useAppStore.getState().viewingEventLog).toEqual(mockEventLog)
    })
  })

  it("sets error state when fetch fails", async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ ok: false, error: "Not found" }),
    })

    // Use a valid 8-character hex ID that doesn't exist on server
    window.location.hash = "#eventlog=deadbeef"

    renderHook(() => useEventLogRouter())

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/eventlogs/deadbeef")
    })

    await waitFor(() => {
      expect(useAppStore.getState().eventLogError).toBe("Not found")
    })

    expect(useAppStore.getState().viewingEventLog).toBeNull()
  })

  it("sets error state when fetch throws", async () => {
    mockFetch.mockImplementation(() => {
      throw new Error("Network error")
    })

    window.location.hash = "#eventlog=abcdef12"

    renderHook(() => useEventLogRouter())

    await waitFor(() => {
      expect(useAppStore.getState().eventLogError).toBe("Network error")
    })
  })

  it("clears event log when hash is removed", async () => {
    const mockEventLog = {
      id: "abcdef12",
      createdAt: "2025-01-01T00:00:00Z",
      events: [],
    }

    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ ok: true, eventlog: mockEventLog }),
    })

    window.location.hash = "#eventlog=abcdef12"

    renderHook(() => useEventLogRouter())

    // Wait for initial fetch
    await waitFor(() => {
      expect(useAppStore.getState().viewingEventLogId).toBe("abcdef12")
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
    const mockEventLog1 = {
      id: "11111111",
      createdAt: "2025-01-01T00:00:00Z",
      events: [],
    }
    const mockEventLog2 = {
      id: "22222222",
      createdAt: "2025-01-02T00:00:00Z",
      events: [],
    }

    mockFetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, eventlog: mockEventLog1 }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, eventlog: mockEventLog2 }),
      })

    window.location.hash = "#eventlog=11111111"

    renderHook(() => useEventLogRouter())

    await waitFor(() => {
      expect(useAppStore.getState().viewingEventLogId).toBe("11111111")
    })

    // Change hash
    act(() => {
      window.location.hash = "#eventlog=22222222"
      window.dispatchEvent(new HashChangeEvent("hashchange"))
    })

    await waitFor(() => {
      expect(useAppStore.getState().viewingEventLogId).toBe("22222222")
    })
  })

  it("sets loading state during fetch", async () => {
    // Create a promise we can control
    let resolvePromise: (value: unknown) => void
    const fetchPromise = new Promise(resolve => {
      resolvePromise = resolve
    })

    mockFetch.mockReturnValue({
      json: () => fetchPromise,
    })

    window.location.hash = "#eventlog=abcdef12"

    renderHook(() => useEventLogRouter())

    // Should be loading
    await waitFor(() => {
      expect(useAppStore.getState().eventLogLoading).toBe(true)
    })

    // Resolve the fetch
    await act(async () => {
      resolvePromise!({ ok: true, eventlog: { id: "abcdef12", events: [] } })
    })

    // Should no longer be loading
    await waitFor(() => {
      expect(useAppStore.getState().eventLogLoading).toBe(false)
    })
  })

  it("returns current eventLogId from store", async () => {
    const mockEventLog = {
      id: "abcdef12",
      createdAt: "2025-01-01T00:00:00Z",
      events: [],
    }

    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ ok: true, eventlog: mockEventLog }),
    })

    window.location.hash = "#eventlog=abcdef12"

    const { result } = renderHook(() => useEventLogRouter())

    await waitFor(() => {
      expect(result.current.eventLogId).toBe("abcdef12")
    })
  })
})
