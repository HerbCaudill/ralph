import { describe, expect, it, vi, beforeEach } from "vitest"
import { fetchRalphSessions } from "../fetchRalphSessions"

describe("fetchRalphSessions", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("transforms SessionInfo[] to RalphSessionIndexEntry[]", async () => {
    const mockFetch = vi.fn()
    // Session list response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sessions: [
          {
            sessionId: "session-1",
            adapter: "claude",
            createdAt: 1000,
            lastMessageAt: 2000,
            taskId: "r-abc123",
          },
          {
            sessionId: "session-2",
            adapter: "codex",
            createdAt: 3000,
            lastMessageAt: 4000,
            // No taskId
          },
        ],
      }),
    })

    // Task fetch response for session-1
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        issue: { id: "r-abc123", title: "Fix the button" },
      }),
    })

    const result = await fetchRalphSessions({ fetchFn: mockFetch })

    // Results are sorted by lastMessageAt descending
    expect(result).toEqual([
      {
        sessionId: "session-2",
        adapter: "codex",
        firstMessageAt: 3000,
        lastMessageAt: 4000,
        firstUserMessage: "",
        taskId: undefined,
      },
      {
        sessionId: "session-1",
        adapter: "claude",
        firstMessageAt: 1000,
        lastMessageAt: 2000,
        firstUserMessage: "r-abc123",
        taskId: "r-abc123",
        taskTitle: "Fix the button",
      },
    ])

    expect(mockFetch).toHaveBeenCalledWith("/api/sessions?app=ralph&include=summary")
    expect(mockFetch).toHaveBeenCalledWith("/api/tasks/r-abc123")
  })

  it("handles task fetch errors gracefully", async () => {
    const mockFetch = vi.fn()
    // Session list response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sessions: [
          {
            sessionId: "session-1",
            adapter: "claude",
            createdAt: 1000,
            lastMessageAt: 2000,
            taskId: "r-abc123",
          },
        ],
      }),
    })

    // Task fetch fails
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: false,
        error: "Task not found",
      }),
    })

    const result = await fetchRalphSessions({ fetchFn: mockFetch })

    // Should still return the session, just without the title
    expect(result).toEqual([
      {
        sessionId: "session-1",
        adapter: "claude",
        firstMessageAt: 1000,
        lastMessageAt: 2000,
        firstUserMessage: "r-abc123",
        taskId: "r-abc123",
        taskTitle: undefined,
      },
    ])
  })

  it("returns empty array when session fetch fails", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
    })

    const result = await fetchRalphSessions({ fetchFn: mockFetch })

    expect(result).toEqual([])
  })

  it("uses custom baseUrl when provided", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sessions: [] }),
    })

    await fetchRalphSessions({
      fetchFn: mockFetch,
      baseUrl: "http://localhost:4244",
    })

    expect(mockFetch).toHaveBeenCalledWith("http://localhost:4244/api/sessions?app=ralph&include=summary")
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

    const result = await fetchRalphSessions({ fetchFn: mockFetch })

    expect(result.map(s => s.sessionId)).toEqual(["newest", "middle", "old"])
  })
})
