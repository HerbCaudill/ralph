import { renderHook, waitFor, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { useRalphSessions } from "../useRalphSessions"
import type { RalphSessionIndexEntry } from "../../lib/fetchRalphSessions"
import type { ChatEvent } from "@herbcaudill/agent-view"

// Mock the fetch helpers
vi.mock("../../lib/fetchRalphSessions", () => ({
  fetchRalphSessions: vi.fn(),
}))

vi.mock("../../lib/fetchSessionEvents", () => ({
  fetchSessionEvents: vi.fn(),
}))

import { fetchRalphSessions } from "../../lib/fetchRalphSessions"
import { fetchSessionEvents } from "../../lib/fetchSessionEvents"

const mockFetchRalphSessions = fetchRalphSessions as ReturnType<typeof vi.fn>
const mockFetchSessionEvents = fetchSessionEvents as ReturnType<typeof vi.fn>

describe("useRalphSessions", () => {
  const mockSessions: RalphSessionIndexEntry[] = [
    {
      sessionId: "session-1",
      adapter: "claude",
      firstMessageAt: 1000,
      lastMessageAt: 3000,
      firstUserMessage: "task-123",
      taskId: "task-123",
      taskTitle: "Fix the bug",
    },
    {
      sessionId: "session-2",
      adapter: "claude",
      firstMessageAt: 2000,
      lastMessageAt: 2500,
      firstUserMessage: "task-456",
      taskId: "task-456",
      taskTitle: "Add feature",
    },
  ]

  const mockEvents: ChatEvent[] = [
    { type: "user_message", message: "Hello", timestamp: 1000 },
    { type: "assistant", timestamp: 1100 },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchRalphSessions.mockResolvedValue(mockSessions)
    mockFetchSessionEvents.mockResolvedValue(mockEvents)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe("initial state", () => {
    it("should return empty sessions array initially", () => {
      const { result } = renderHook(() => useRalphSessions(null))
      expect(result.current.sessions).toEqual([])
    })

    it("should return null for historicalEvents initially", () => {
      const { result } = renderHook(() => useRalphSessions(null))
      expect(result.current.historicalEvents).toBeNull()
    })

    it("should return isViewingHistorical as false initially", () => {
      const { result } = renderHook(() => useRalphSessions(null))
      expect(result.current.isViewingHistorical).toBe(false)
    })
  })

  describe("fetching sessions", () => {
    it("should fetch sessions on mount", async () => {
      const { result } = renderHook(() => useRalphSessions("session-current"))

      await waitFor(() => {
        expect(mockFetchRalphSessions).toHaveBeenCalled()
      })

      await waitFor(() => {
        expect(result.current.sessions).toEqual(mockSessions)
      })
    })

    it("should refetch sessions when currentSessionId changes", async () => {
      const { rerender } = renderHook(({ sessionId }) => useRalphSessions(sessionId), {
        initialProps: { sessionId: "session-1" as string | null },
      })

      await waitFor(() => {
        expect(mockFetchRalphSessions).toHaveBeenCalledTimes(1)
      })

      // Change the session ID
      rerender({ sessionId: "session-2" })

      await waitFor(() => {
        expect(mockFetchRalphSessions).toHaveBeenCalledTimes(2)
      })
    })

    it("should not refetch when currentSessionId is the same", async () => {
      const { rerender } = renderHook(({ sessionId }) => useRalphSessions(sessionId), {
        initialProps: { sessionId: "session-1" as string | null },
      })

      await waitFor(() => {
        expect(mockFetchRalphSessions).toHaveBeenCalledTimes(1)
      })

      // Rerender with same session ID
      rerender({ sessionId: "session-1" })

      // Should still only have been called once
      expect(mockFetchRalphSessions).toHaveBeenCalledTimes(1)
    })

    it("should fetch sessions even when currentSessionId is null", async () => {
      renderHook(() => useRalphSessions(null))

      await waitFor(() => {
        expect(mockFetchRalphSessions).toHaveBeenCalled()
      })
    })
  })

  describe("selectSession", () => {
    it("should fetch events for the selected session", async () => {
      const { result } = renderHook(() => useRalphSessions("session-current"))

      await waitFor(() => {
        expect(result.current.sessions).toHaveLength(2)
      })

      await act(async () => {
        await result.current.selectSession("session-1")
      })

      expect(mockFetchSessionEvents).toHaveBeenCalledWith("session-1", expect.any(Object))
    })

    it("should set historicalEvents after selecting a session", async () => {
      const { result } = renderHook(() => useRalphSessions("session-current"))

      await waitFor(() => {
        expect(result.current.sessions).toHaveLength(2)
      })

      await act(async () => {
        await result.current.selectSession("session-1")
      })

      await waitFor(() => {
        expect(result.current.historicalEvents).toEqual(mockEvents)
      })
    })

    it("should set isViewingHistorical to true after selecting a session", async () => {
      const { result } = renderHook(() => useRalphSessions("session-current"))

      await waitFor(() => {
        expect(result.current.sessions).toHaveLength(2)
      })

      await act(async () => {
        await result.current.selectSession("session-1")
      })

      await waitFor(() => {
        expect(result.current.isViewingHistorical).toBe(true)
      })
    })

    it("should not change state if fetchSessionEvents fails", async () => {
      mockFetchSessionEvents.mockRejectedValue(new Error("Network error"))
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      const { result } = renderHook(() => useRalphSessions("session-current"))

      await waitFor(() => {
        expect(result.current.sessions).toHaveLength(2)
      })

      await act(async () => {
        await result.current.selectSession("session-1")
      })

      // Should remain in initial state
      expect(result.current.historicalEvents).toBeNull()
      expect(result.current.isViewingHistorical).toBe(false)
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe("clearHistorical", () => {
    it("should reset historicalEvents to null", async () => {
      const { result } = renderHook(() => useRalphSessions("session-current"))

      await waitFor(() => {
        expect(result.current.sessions).toHaveLength(2)
      })

      // First select a session
      await act(async () => {
        await result.current.selectSession("session-1")
      })

      await waitFor(() => {
        expect(result.current.historicalEvents).toEqual(mockEvents)
      })

      // Then clear
      act(() => {
        result.current.clearHistorical()
      })

      expect(result.current.historicalEvents).toBeNull()
    })

    it("should set isViewingHistorical to false", async () => {
      const { result } = renderHook(() => useRalphSessions("session-current"))

      await waitFor(() => {
        expect(result.current.sessions).toHaveLength(2)
      })

      // First select a session
      await act(async () => {
        await result.current.selectSession("session-1")
      })

      await waitFor(() => {
        expect(result.current.isViewingHistorical).toBe(true)
      })

      // Then clear
      act(() => {
        result.current.clearHistorical()
      })

      expect(result.current.isViewingHistorical).toBe(false)
    })
  })

  describe("error handling", () => {
    it("should handle fetchRalphSessions failure gracefully", async () => {
      mockFetchRalphSessions.mockRejectedValue(new Error("Network error"))
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      const { result } = renderHook(() => useRalphSessions("session-current"))

      await waitFor(() => {
        expect(mockFetchRalphSessions).toHaveBeenCalled()
      })

      // Sessions should remain empty
      expect(result.current.sessions).toEqual([])
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })
})
