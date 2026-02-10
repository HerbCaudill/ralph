import { describe, expect, it, vi, beforeEach } from "vitest"
import { fetchTaskChatSessions } from "../fetchTaskChatSessions"

describe("fetchTaskChatSessions", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("transforms SessionInfo[] to SessionIndexEntry[]", async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sessions: [
          {
            sessionId: "session-1",
            adapter: "claude",
            createdAt: 1000,
            lastMessageAt: 2000,
          },
          {
            sessionId: "session-2",
            adapter: "codex",
            createdAt: 3000,
            lastMessageAt: 4000,
          },
        ],
      }),
    })

    const result = await fetchTaskChatSessions({ fetchFn: mockFetch })

    // Results are sorted by lastMessageAt descending
    expect(result).toEqual([
      {
        sessionId: "session-2",
        adapter: "codex",
        firstMessageAt: 3000,
        lastMessageAt: 4000,
        firstUserMessage: "",
        isActive: false,
      },
      {
        sessionId: "session-1",
        adapter: "claude",
        firstMessageAt: 1000,
        lastMessageAt: 2000,
        firstUserMessage: "",
        isActive: false,
      },
    ])

    expect(mockFetch).toHaveBeenCalledWith("/api/sessions?app=task-chat")
  })

  it("returns empty array when session fetch fails", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
    })

    const result = await fetchTaskChatSessions({ fetchFn: mockFetch })

    expect(result).toEqual([])
  })

  it("uses custom baseUrl when provided", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sessions: [] }),
    })

    await fetchTaskChatSessions({
      fetchFn: mockFetch,
      baseUrl: "http://localhost:4244",
    })

    expect(mockFetch).toHaveBeenCalledWith("http://localhost:4244/api/sessions?app=task-chat")
  })

  it("sorts sessions by lastMessageAt descending", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sessions: [
          { sessionId: "old", adapter: "claude", createdAt: 1000, lastMessageAt: 1000 },
          { sessionId: "newest", adapter: "claude", createdAt: 3000, lastMessageAt: 5000 },
          { sessionId: "middle", adapter: "claude", createdAt: 2000, lastMessageAt: 3000 },
        ],
      }),
    })

    const result = await fetchTaskChatSessions({ fetchFn: mockFetch })

    expect(result.map(s => s.sessionId)).toEqual(["newest", "middle", "old"])
  })

  it("sets isActive to true when session status is 'processing'", async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sessions: [
          {
            sessionId: "active-session",
            adapter: "claude",
            createdAt: 1000,
            lastMessageAt: 2000,
            status: "processing",
          },
          {
            sessionId: "idle-session",
            adapter: "claude",
            createdAt: 3000,
            lastMessageAt: 4000,
            status: "idle",
          },
        ],
      }),
    })

    const result = await fetchTaskChatSessions({ fetchFn: mockFetch })

    // Active session should have isActive: true
    expect(result.find(s => s.sessionId === "active-session")?.isActive).toBe(true)
    // Idle session should have isActive: false
    expect(result.find(s => s.sessionId === "idle-session")?.isActive).toBe(false)
  })

  it("uses createdAt as fallback when lastMessageAt is missing", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sessions: [
          {
            sessionId: "no-messages",
            adapter: "claude",
            createdAt: 5000,
            // No lastMessageAt
          },
        ],
      }),
    })

    const result = await fetchTaskChatSessions({ fetchFn: mockFetch })

    expect(result[0].lastMessageAt).toBe(5000)
  })

  it("handles network errors gracefully", async () => {
    const mockFetch = vi.fn().mockRejectedValueOnce(new Error("Network error"))

    const result = await fetchTaskChatSessions({ fetchFn: mockFetch })

    expect(result).toEqual([])
  })
})
