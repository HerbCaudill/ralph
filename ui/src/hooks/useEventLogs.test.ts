import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useEventLogs, type EventLogSummary } from "./useEventLogs"

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe("useEventLogs", () => {
  const mockEventLogs: EventLogSummary[] = [
    {
      id: "abc12345",
      createdAt: "2026-01-23T10:00:00.000Z",
      eventCount: 42,
      metadata: {
        taskId: "r-test.1",
        title: "Test task 1",
      },
    },
    {
      id: "def67890",
      createdAt: "2026-01-22T15:30:00.000Z",
      eventCount: 128,
      metadata: {
        taskId: "r-test.2",
        title: "Test task 2",
      },
    },
    {
      id: "ghi11111",
      createdAt: "2026-01-21T09:00:00.000Z",
      eventCount: 15,
      // No metadata
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    // Default mock response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, eventlogs: mockEventLogs }),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe("initialization", () => {
    it("fetches event logs on mount", async () => {
      vi.useRealTimers()
      const { result } = renderHook(() => useEventLogs({ pollInterval: 0 }))

      await waitFor(() => {
        expect(result.current.eventLogs).toHaveLength(3)
      })

      expect(mockFetch).toHaveBeenCalledWith("/api/eventlogs")
    })

    it("sets isLoading while fetching", async () => {
      vi.useRealTimers()
      // Create a promise we can control
      let resolvePromise: (value: unknown) => void
      const controlledPromise = new Promise(resolve => {
        resolvePromise = resolve
      })

      mockFetch.mockReturnValue({
        ok: true,
        json: () => controlledPromise,
      })

      const { result } = renderHook(() => useEventLogs({ pollInterval: 0 }))

      // Should be loading initially
      expect(result.current.isLoading).toBe(true)

      // Resolve the promise
      await act(async () => {
        resolvePromise!({ ok: true, eventlogs: mockEventLogs })
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    it("returns event log summaries with metadata", async () => {
      vi.useRealTimers()
      const { result } = renderHook(() => useEventLogs({ pollInterval: 0 }))

      await waitFor(() => {
        expect(result.current.eventLogs).toHaveLength(3)
      })

      const log = result.current.eventLogs[0]
      expect(log.id).toBe("abc12345")
      expect(log.eventCount).toBe(42)
      expect(log.metadata?.taskId).toBe("r-test.1")
      expect(log.metadata?.title).toBe("Test task 1")
    })

    it("handles event logs without metadata", async () => {
      vi.useRealTimers()
      const { result } = renderHook(() => useEventLogs({ pollInterval: 0 }))

      await waitFor(() => {
        expect(result.current.eventLogs).toHaveLength(3)
      })

      const log = result.current.eventLogs[2]
      expect(log.id).toBe("ghi11111")
      expect(log.metadata).toBeUndefined()
    })
  })

  describe("error handling", () => {
    it("sets error when fetch fails", async () => {
      vi.useRealTimers()
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: false, error: "Database error" }),
      })

      const { result } = renderHook(() => useEventLogs({ pollInterval: 0 }))

      await waitFor(() => {
        expect(result.current.error).toBe("Database error")
      })

      expect(result.current.eventLogs).toHaveLength(0)
    })

    it("sets error on network failure", async () => {
      vi.useRealTimers()
      mockFetch.mockRejectedValue(new Error("Network error"))

      const { result } = renderHook(() => useEventLogs({ pollInterval: 0 }))

      await waitFor(() => {
        expect(result.current.error).toBe("Network error")
      })
    })
  })

  describe("polling", () => {
    it("polls at the specified interval", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true, eventlogs: mockEventLogs }),
      })

      renderHook(() => useEventLogs({ pollInterval: 1000 }))

      // Initial fetch
      await vi.advanceTimersByTimeAsync(0)
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // After 1 second
      await vi.advanceTimersByTimeAsync(1000)
      expect(mockFetch).toHaveBeenCalledTimes(2)

      // After another second
      await vi.advanceTimersByTimeAsync(1000)
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it("does not poll when pollInterval is 0", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true, eventlogs: mockEventLogs }),
      })

      renderHook(() => useEventLogs({ pollInterval: 0 }))

      // Initial fetch
      await vi.advanceTimersByTimeAsync(0)
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // After many seconds
      await vi.advanceTimersByTimeAsync(60000)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it("uses default 30s poll interval", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true, eventlogs: mockEventLogs }),
      })

      renderHook(() => useEventLogs())

      // Initial fetch
      await vi.advanceTimersByTimeAsync(0)
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // After 29 seconds - no new poll yet
      await vi.advanceTimersByTimeAsync(29000)
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // After 30 seconds total - should have polled
      await vi.advanceTimersByTimeAsync(1000)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe("refresh", () => {
    it("manually refetches event logs", async () => {
      vi.useRealTimers()
      const { result } = renderHook(() => useEventLogs({ pollInterval: 0 }))

      await waitFor(() => {
        expect(result.current.eventLogs).toHaveLength(3)
      })

      // Clear and setup new mock response with more logs
      mockFetch.mockClear()
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            eventlogs: [
              ...mockEventLogs,
              {
                id: "jkl22222",
                createdAt: "2026-01-24T12:00:00.000Z",
                eventCount: 99,
              },
            ],
          }),
      })

      await act(async () => {
        await result.current.refresh()
      })

      expect(result.current.eventLogs).toHaveLength(4)
    })

    it("clears error on successful refresh", async () => {
      vi.useRealTimers()
      // First request fails
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: false, error: "Initial error" }),
      })

      const { result } = renderHook(() => useEventLogs({ pollInterval: 0 }))

      await waitFor(() => {
        expect(result.current.error).toBe("Initial error")
      })

      // Second request succeeds
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true, eventlogs: mockEventLogs }),
      })

      await act(async () => {
        await result.current.refresh()
      })

      expect(result.current.error).toBeNull()
      expect(result.current.eventLogs).toHaveLength(3)
    })
  })

  describe("empty state", () => {
    it("handles empty event logs list", async () => {
      vi.useRealTimers()
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true, eventlogs: [] }),
      })

      const { result } = renderHook(() => useEventLogs({ pollInterval: 0 }))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.eventLogs).toHaveLength(0)
      expect(result.current.error).toBeNull()
    })
  })
})
