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

    const tasks = [{ id: "r-abc123", title: "Fix the button" }]

    const result = await fetchRalphSessions({ fetchFn: mockFetch, tasks })

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

    // Should only call the sessions API, not the tasks API
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith("/api/sessions?app=ralph&include=summary")
  })

  it("returns session without title when task is not in the local cache", async () => {
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

    // Empty tasks array — task not found locally
    const result = await fetchRalphSessions({ fetchFn: mockFetch, tasks: [] })

    // Should still return the session, just without the title
    expect(result).toEqual([
      {
        sessionId: "session-1",
        adapter: "claude",
        firstMessageAt: 1000,
        lastMessageAt: 2000,
        firstUserMessage: "r-abc123",
        taskId: "r-abc123",
        isActive: false,
      },
    ])

    // Should NOT make any task API calls
    expect(mockFetch).toHaveBeenCalledTimes(1)
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

  it("does not make task API calls — uses local tasks array only", async () => {
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
            cwd: "/Users/herbcaudill/Code/HerbCaudill/ralph",
          },
        ],
      }),
    })

    const tasks = [{ id: "r-abc123", title: "Fix the button" }]

    const result = await fetchRalphSessions({
      fetchFn: mockFetch,
      workspaceId: "herbcaudill/ralph",
      tasks,
    })

    expect(result[0].taskTitle).toBe("Fix the button")
    // Only one API call — the session list; no task API calls
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("resolves titles for multiple sessions from local tasks", async () => {
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
            taskId: "r-abc",
          },
          {
            sessionId: "session-2",
            adapter: "claude",
            createdAt: 3000,
            lastMessageAt: 4000,
            taskId: "r-def",
          },
          {
            sessionId: "session-3",
            adapter: "claude",
            createdAt: 5000,
            lastMessageAt: 6000,
            taskId: "r-abc", // Same task as session-1
          },
        ],
      }),
    })

    const tasks = [
      { id: "r-abc", title: "Task A" },
      { id: "r-def", title: "Task B" },
    ]

    const result = await fetchRalphSessions({ fetchFn: mockFetch, tasks })

    expect(result[0].taskTitle).toBe("Task A") // session-3 (most recent)
    expect(result[1].taskTitle).toBe("Task B") // session-2
    expect(result[2].taskTitle).toBe("Task A") // session-1
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
