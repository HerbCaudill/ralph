import { renderHook, waitFor, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { useTaskChatSessions } from "../useTaskChatSessions"
import type { SessionIndexEntry } from "@herbcaudill/agent-view"

// Mock the fetch helper
vi.mock("../../lib/fetchTaskChatSessions", () => ({
  fetchTaskChatSessions: vi.fn(),
}))

import { fetchTaskChatSessions } from "../../lib/fetchTaskChatSessions"

const mockFetchTaskChatSessions = fetchTaskChatSessions as ReturnType<typeof vi.fn>

describe("useTaskChatSessions", () => {
  const mockSessions: SessionIndexEntry[] = [
    {
      sessionId: "session-1",
      adapter: "claude",
      firstMessageAt: 1000,
      lastMessageAt: 3000,
      firstUserMessage: "Hello",
      isActive: false,
    },
    {
      sessionId: "session-2",
      adapter: "claude",
      firstMessageAt: 2000,
      lastMessageAt: 2500,
      firstUserMessage: "Hi there",
      isActive: true,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchTaskChatSessions.mockResolvedValue(mockSessions)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe("initial state", () => {
    it("should return empty sessions array initially", () => {
      const { result } = renderHook(() => useTaskChatSessions(null))
      expect(result.current.sessions).toEqual([])
    })
  })

  describe("fetching sessions", () => {
    it("should fetch sessions on mount", async () => {
      const { result } = renderHook(() => useTaskChatSessions("session-1"))

      await waitFor(() => {
        expect(mockFetchTaskChatSessions).toHaveBeenCalled()
      })

      await waitFor(() => {
        expect(result.current.sessions).toEqual(mockSessions)
      })
    })

    it("should refetch sessions when currentSessionId changes", async () => {
      const { rerender } = renderHook(({ sessionId }) => useTaskChatSessions(sessionId), {
        initialProps: { sessionId: "session-1" as string | null },
      })

      await waitFor(() => {
        expect(mockFetchTaskChatSessions).toHaveBeenCalledTimes(1)
      })

      rerender({ sessionId: "session-2" })

      await waitFor(() => {
        expect(mockFetchTaskChatSessions).toHaveBeenCalledTimes(2)
      })
    })

    it("should not refetch when currentSessionId is the same", async () => {
      const { rerender } = renderHook(({ sessionId }) => useTaskChatSessions(sessionId), {
        initialProps: { sessionId: "session-1" as string | null },
      })

      await waitFor(() => {
        expect(mockFetchTaskChatSessions).toHaveBeenCalledTimes(1)
      })

      rerender({ sessionId: "session-1" })

      expect(mockFetchTaskChatSessions).toHaveBeenCalledTimes(1)
    })
  })

  describe("refetchSessions", () => {
    it("should refetch sessions when called", async () => {
      const { result } = renderHook(() => useTaskChatSessions("session-1", "owner/repo"))

      await waitFor(() => {
        expect(mockFetchTaskChatSessions).toHaveBeenCalledTimes(1)
        expect(result.current.sessions).toEqual(mockSessions)
      })

      // Update mock to return updated sessions (session-2 no longer active)
      const updatedSessions: SessionIndexEntry[] = mockSessions.map(s => ({
        ...s,
        isActive: false,
      }))
      mockFetchTaskChatSessions.mockResolvedValue(updatedSessions)

      await act(async () => {
        await result.current.refetchSessions()
      })

      expect(mockFetchTaskChatSessions).toHaveBeenCalledTimes(2)

      await waitFor(() => {
        expect(result.current.sessions.every(s => !s.isActive)).toBe(true)
      })
    })

    it("should handle refetchSessions errors gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      const { result } = renderHook(() => useTaskChatSessions("session-1", "owner/repo"))

      await waitFor(() => {
        expect(result.current.sessions).toEqual(mockSessions)
      })

      mockFetchTaskChatSessions.mockRejectedValue(new Error("Network error"))

      await act(async () => {
        await result.current.refetchSessions()
      })

      expect(consoleSpy).toHaveBeenCalled()
      // Sessions should remain unchanged
      expect(result.current.sessions).toEqual(mockSessions)

      consoleSpy.mockRestore()
    })
  })
})
