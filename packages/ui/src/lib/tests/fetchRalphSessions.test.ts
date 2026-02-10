import { describe, expect, it, vi, beforeEach } from "vitest"
import { fetchRalphSessions, clearTaskTitleCache } from "../fetchRalphSessions"

describe("fetchRalphSessions", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // Clear the cache between tests to ensure test isolation
    clearTaskTitleCache()
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
        isActive: false,
      },
      {
        sessionId: "session-1",
        adapter: "claude",
        firstMessageAt: 1000,
        lastMessageAt: 2000,
        firstUserMessage: "r-abc123",
        taskId: "r-abc123",
        taskTitle: "Fix the button",
        isActive: false,
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
        isActive: false,
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

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:4244/api/sessions?app=ralph&include=summary",
    )
  })

  it("uses baseUrl for task title resolution", async () => {
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

    // Task fetch response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        issue: { id: "r-abc123", title: "Fix the button" },
      }),
    })

    await fetchRalphSessions({
      fetchFn: mockFetch,
      baseUrl: "http://localhost:4244",
    })

    // Both API calls should use the baseUrl
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:4244/api/sessions?app=ralph&include=summary",
    )
    expect(mockFetch).toHaveBeenCalledWith("http://localhost:4244/api/tasks/r-abc123")
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

  it("sets isActive to true when session status is 'processing'", async () => {
    const mockFetch = vi.fn()
    // Session list response with status field
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

    const result = await fetchRalphSessions({ fetchFn: mockFetch })

    // Active session should have isActive: true
    expect(result.find(s => s.sessionId === "active-session")?.isActive).toBe(true)
    // Idle session should have isActive: false
    expect(result.find(s => s.sessionId === "idle-session")?.isActive).toBe(false)
  })

  it("includes workspace query parameter when resolving task titles", async () => {
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

    // Task fetch response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        issue: { id: "r-abc123", title: "Fix the button" },
      }),
    })

    await fetchRalphSessions({
      fetchFn: mockFetch,
      workspaceId: "HerbCaudill/ralph",
    })

    // The task API call should include the workspace query parameter
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/tasks/r-abc123?workspace=HerbCaudill%2Fralph",
    )
  })

  it("caches task titles to avoid repeated API calls", async () => {
    const mockFetch = vi.fn()

    // First call: session list response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sessions: [
          {
            sessionId: "session-1",
            adapter: "claude",
            createdAt: 1000,
            lastMessageAt: 2000,
            taskId: "r-cached",
          },
        ],
      }),
    })

    // First call: task fetch response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        issue: { id: "r-cached", title: "Cached Task" },
      }),
    })

    // First fetch - should call the task API
    const result1 = await fetchRalphSessions({ fetchFn: mockFetch })
    expect(result1[0].taskTitle).toBe("Cached Task")
    expect(mockFetch).toHaveBeenCalledTimes(2)

    // Second call: session list response (same task ID)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sessions: [
          {
            sessionId: "session-2",
            adapter: "claude",
            createdAt: 3000,
            lastMessageAt: 4000,
            taskId: "r-cached", // Same task ID
          },
        ],
      }),
    })

    // Second fetch - should NOT call the task API again (cached)
    const result2 = await fetchRalphSessions({ fetchFn: mockFetch })
    expect(result2[0].taskTitle).toBe("Cached Task")
    // Only 3 calls total: 2 from first fetch + 1 session list from second fetch
    // The task API should not be called again because the title is cached
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })
})
