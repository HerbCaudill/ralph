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

    it("should populate sessions when currentSessionId is null (Ralph is idle)", async () => {
      const { result } = renderHook(() => useRalphSessions(null))

      await waitFor(() => {
        expect(result.current.sessions).toEqual(mockSessions)
      })
    })
  })

  describe("selectSession", () => {
    it("should allow selecting a historical session when Ralph is idle (currentSessionId is null)", async () => {
      // This is the key scenario: user lands on the page with Ralph not running,
      // but should still be able to browse and view historical sessions
      const { result } = renderHook(() => useRalphSessions(null))

      // Sessions should be fetched and populated
      await waitFor(() => {
        expect(result.current.sessions).toEqual(mockSessions)
      })

      // User selects a historical session
      await act(async () => {
        await result.current.selectSession("session-1")
      })

      // Events should be loaded and displayed
      await waitFor(() => {
        expect(result.current.historicalEvents).toEqual(mockEvents)
        expect(result.current.isViewingHistorical).toBe(true)
      })
    })

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

  describe("workspaceId parameter", () => {
    it("should pass workspaceId and tasks to fetchRalphSessions", async () => {
      const tasks = [{ id: "task-1", title: "My task" }]
      renderHook(() => useRalphSessions("session-current", "HerbCaudill/ralph", tasks))

      await waitFor(() => {
        expect(mockFetchRalphSessions).toHaveBeenCalledWith({
          workspaceId: "HerbCaudill/ralph",
          tasks,
        })
      })
    })

    it("should refetch when workspaceId changes", async () => {
      const { rerender } = renderHook(
        ({ sessionId, workspaceId }) => useRalphSessions(sessionId, workspaceId),
        {
          initialProps: { sessionId: "session-1" as string | null, workspaceId: "owner/repo1" },
        },
      )

      await waitFor(() => {
        expect(mockFetchRalphSessions).toHaveBeenCalledTimes(1)
      })

      // Change the workspaceId
      rerender({ sessionId: "session-1", workspaceId: "owner/repo2" })

      await waitFor(() => {
        expect(mockFetchRalphSessions).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe("tasks parameter", () => {
    it("should re-resolve titles when tasks change without refetching sessions", async () => {
      const initialTasks = [{ id: "task-123", title: "Old title" }]
      const { result, rerender } = renderHook(
        ({ sessionId, workspaceId, tasks }) => useRalphSessions(sessionId, workspaceId, tasks),
        {
          initialProps: {
            sessionId: "session-1" as string | null,
            workspaceId: "owner/repo1",
            tasks: initialTasks,
          },
        },
      )

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.sessions).toEqual(mockSessions)
      })

      // Change tasks without changing sessionId or workspaceId
      const updatedTasks = [
        { id: "task-123", title: "Updated title" },
        { id: "task-456", title: "New feature title" },
      ]
      rerender({ sessionId: "session-1", workspaceId: "owner/repo1", tasks: updatedTasks })

      // Should NOT refetch sessions from the server (still only 1 call)
      expect(mockFetchRalphSessions).toHaveBeenCalledTimes(1)

      // Titles should be re-resolved from the updated tasks
      await waitFor(() => {
        const session456 = result.current.sessions.find(s => s.taskId === "task-456")
        expect(session456?.taskTitle).toBe("New feature title")
      })
    })
  })

  describe("refetchSessions", () => {
    it("should refetch sessions when called", async () => {
      const { result } = renderHook(
        ({ sessionId, workspaceId }) => useRalphSessions(sessionId, workspaceId),
        {
          initialProps: { sessionId: "session-1" as string | null, workspaceId: "owner/repo1" },
        },
      )

      // Wait for initial fetch
      await waitFor(() => {
        expect(mockFetchRalphSessions).toHaveBeenCalledTimes(1)
        expect(result.current.sessions).toEqual(mockSessions)
      })

      // Update the mock to return new sessions
      const newSessions: RalphSessionIndexEntry[] = [
        ...mockSessions,
        {
          sessionId: "session-3",
          adapter: "claude",
          firstMessageAt: 4000,
          lastMessageAt: 4500,
          firstUserMessage: "task-789",
          taskId: "task-789",
          taskTitle: "New task",
        },
      ]
      mockFetchRalphSessions.mockResolvedValue(newSessions)

      // Call refetchSessions
      await act(async () => {
        await result.current.refetchSessions()
      })

      // Should have fetched again
      expect(mockFetchRalphSessions).toHaveBeenCalledTimes(2)

      // Sessions should be updated
      await waitFor(() => {
        expect(result.current.sessions).toHaveLength(3)
        expect(result.current.sessions.find(s => s.sessionId === "session-3")).toBeDefined()
      })
    })

    it("should handle refetchSessions errors gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      const { result } = renderHook(() => useRalphSessions("session-1", "owner/repo1"))

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.sessions).toEqual(mockSessions)
      })

      // Make the next fetch fail
      mockFetchRalphSessions.mockRejectedValue(new Error("Network error"))

      // Call refetchSessions
      await act(async () => {
        await result.current.refetchSessions()
      })

      // Should log error
      expect(consoleSpy).toHaveBeenCalled()

      // Sessions should remain unchanged
      expect(result.current.sessions).toEqual(mockSessions)

      consoleSpy.mockRestore()
    })
  })
})
