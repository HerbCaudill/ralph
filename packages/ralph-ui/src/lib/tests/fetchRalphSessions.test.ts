import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { fetchRalphSessions } from "../fetchRalphSessions"
import type { AssistantChatEvent } from "@herbcaudill/agent-view"
import { STORAGE_KEY } from "../sessionTaskIdCache"

// Mock fetchSessionEvents
vi.mock("../fetchSessionEvents", () => ({
  fetchSessionEvents: vi.fn().mockResolvedValue([]),
}))

import { fetchSessionEvents } from "../fetchSessionEvents"

const mockFetchSessionEvents = fetchSessionEvents as ReturnType<typeof vi.fn>

describe("fetchRalphSessions", () => {
  let storage: Record<string, string>

  beforeEach(() => {
    mockFetchSessionEvents.mockReset()
    mockFetchSessionEvents.mockResolvedValue([])

    // Mock localStorage
    storage = {}
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => storage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        delete storage[key]
      }),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("fetches all sessions without include=summary", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sessions: [] }),
    })

    await fetchRalphSessions({ fetchFn: mockFetch })

    expect(mockFetch).toHaveBeenCalledWith("/api/sessions")
  })

  it("uses cached taskId from localStorage without fetching events", async () => {
    // Pre-populate the cache
    storage[STORAGE_KEY] = JSON.stringify({ "session-1": "r-abc123" })

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sessions: [
          {
            sessionId: "session-1",
            adapter: "claude",
            createdAt: 1000,
            lastMessageAt: 2000,
          },
        ],
      }),
    })

    const tasks = [{ id: "r-abc123", title: "Fix the button" }]
    const result = await fetchRalphSessions({ fetchFn: mockFetch, tasks })

    // Should NOT fetch events for cached session
    expect(mockFetchSessionEvents).not.toHaveBeenCalled()

    // Should resolve taskId and title from cache
    expect(result).toEqual([
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
  })

  it("fetches events for uncached sessions and caches taskId", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sessions: [
          {
            sessionId: "session-1",
            adapter: "claude",
            createdAt: 1000,
            lastMessageAt: 2000,
          },
        ],
      }),
    })

    // Mock events with a start_task marker
    mockFetchSessionEvents.mockResolvedValueOnce([
      {
        type: "assistant",
        timestamp: 1100,
        message: {
          content: [{ type: "text", text: "<start_task>r-abc123</start_task>" }],
        },
      } as AssistantChatEvent,
    ])

    const tasks = [{ id: "r-abc123", title: "Fix the button" }]
    const result = await fetchRalphSessions({ fetchFn: mockFetch, tasks })

    // Should have fetched events for the uncached session
    expect(mockFetchSessionEvents).toHaveBeenCalledWith("session-1", {
      baseUrl: "",
      fetchFn: mockFetch,
    })

    // Should have cached the taskId
    const cached = JSON.parse(storage[STORAGE_KEY])
    expect(cached["session-1"]).toBe("r-abc123")

    // Should resolve the task
    expect(result[0].taskId).toBe("r-abc123")
    expect(result[0].taskTitle).toBe("Fix the button")
  })

  it("handles sessions with no task markers gracefully", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sessions: [
          {
            sessionId: "session-1",
            adapter: "claude",
            createdAt: 1000,
            lastMessageAt: 2000,
          },
        ],
      }),
    })

    // Mock events without task markers
    mockFetchSessionEvents.mockResolvedValueOnce([
      { type: "user_message", message: "Hello", timestamp: 1000 },
    ])

    const result = await fetchRalphSessions({ fetchFn: mockFetch })

    expect(result[0].taskId).toBeUndefined()
    expect(result[0].firstUserMessage).toBe("")
  })

  it("fetches events in parallel for multiple uncached sessions", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sessions: [
          { sessionId: "session-1", adapter: "claude", createdAt: 1000, lastMessageAt: 2000 },
          { sessionId: "session-2", adapter: "claude", createdAt: 3000, lastMessageAt: 4000 },
        ],
      }),
    })

    mockFetchSessionEvents
      .mockResolvedValueOnce([
        {
          type: "assistant",
          timestamp: 1100,
          message: { content: [{ type: "text", text: "<start_task>r-abc</start_task>" }] },
        } as AssistantChatEvent,
      ])
      .mockResolvedValueOnce([
        {
          type: "assistant",
          timestamp: 3100,
          message: { content: [{ type: "text", text: "<start_task>r-def</start_task>" }] },
        } as AssistantChatEvent,
      ])

    const tasks = [
      { id: "r-abc", title: "Task A" },
      { id: "r-def", title: "Task B" },
    ]

    const result = await fetchRalphSessions({ fetchFn: mockFetch, tasks })

    // Should have fetched events for both uncached sessions
    expect(mockFetchSessionEvents).toHaveBeenCalledTimes(2)

    // Results should be sorted by lastMessageAt descending
    expect(result[0].taskId).toBe("r-def") // session-2 (most recent)
    expect(result[0].taskTitle).toBe("Task B")
    expect(result[1].taskId).toBe("r-abc") // session-1
    expect(result[1].taskTitle).toBe("Task A")
  })

  it("skips event fetch for cached sessions but fetches uncached ones", async () => {
    // Pre-populate cache for session-1
    storage[STORAGE_KEY] = JSON.stringify({ "session-1": "r-abc" })

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sessions: [
          { sessionId: "session-1", adapter: "claude", createdAt: 1000, lastMessageAt: 2000 },
          { sessionId: "session-2", adapter: "codex", createdAt: 3000, lastMessageAt: 4000 },
        ],
      }),
    })

    // Only session-2 should be fetched
    mockFetchSessionEvents.mockResolvedValueOnce([
      {
        type: "assistant",
        timestamp: 3100,
        message: { content: [{ type: "text", text: "<start_task>r-def</start_task>" }] },
      } as AssistantChatEvent,
    ])

    const result = await fetchRalphSessions({ fetchFn: mockFetch })

    // Should only fetch events for session-2 (uncached)
    expect(mockFetchSessionEvents).toHaveBeenCalledTimes(1)
    expect(mockFetchSessionEvents).toHaveBeenCalledWith("session-2", expect.any(Object))

    // Both sessions should have task IDs resolved
    expect(result.find(s => s.sessionId === "session-1")?.taskId).toBe("r-abc")
    expect(result.find(s => s.sessionId === "session-2")?.taskId).toBe("r-def")
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

    expect(mockFetch).toHaveBeenCalledWith("http://localhost:4244/api/sessions")
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

    expect(result.find(s => s.sessionId === "active-session")?.isActive).toBe(true)
    expect(result.find(s => s.sessionId === "idle-session")?.isActive).toBe(false)
  })

  it("passes baseUrl and fetchFn to fetchSessionEvents", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sessions: [
          { sessionId: "session-1", adapter: "claude", createdAt: 1000, lastMessageAt: 2000 },
        ],
      }),
    })

    mockFetchSessionEvents.mockResolvedValueOnce([])

    await fetchRalphSessions({
      fetchFn: mockFetch,
      baseUrl: "http://localhost:4244",
    })

    expect(mockFetchSessionEvents).toHaveBeenCalledWith("session-1", {
      baseUrl: "http://localhost:4244",
      fetchFn: mockFetch,
    })
  })

  it("fetches missing task titles from the task API when not present in the local tasks list", async () => {
    storage[STORAGE_KEY] = JSON.stringify({ "session-1": "r-abc123" })

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessions: [
            {
              sessionId: "session-1",
              adapter: "claude",
              createdAt: 1000,
              lastMessageAt: 2000,
              cwd: "/Users/herbcaudill/Code/HerbCaudill/ralph",
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          issue: { id: "r-abc123", title: "Recovered task title", status: "closed" },
        }),
      })

    const result = await fetchRalphSessions({
      fetchFn: mockFetch,
      workspaceId: "herbcaudill/ralph",
      tasks: [],
    })

    expect(mockFetch).toHaveBeenNthCalledWith(1, "/api/sessions")
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "/api/tasks/r-abc123?workspace=herbcaudill%2Fralph",
    )
    expect(result[0].taskTitle).toBe("Recovered task title")
  })

  it("does not fetch a task title when it is already present in the local tasks list", async () => {
    storage[STORAGE_KEY] = JSON.stringify({ "session-1": "r-abc123" })

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sessions: [
          {
            sessionId: "session-1",
            adapter: "claude",
            createdAt: 1000,
            lastMessageAt: 2000,
            cwd: "/Users/herbcaudill/Code/HerbCaudill/ralph",
          },
        ],
      }),
    })

    const result = await fetchRalphSessions({
      fetchFn: mockFetch,
      workspaceId: "herbcaudill/ralph",
      tasks: [{ id: "r-abc123", title: "Cached title" }],
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(result[0].taskTitle).toBe("Cached title")
  })

  it("includes worker sessions for the current workspace and excludes task chat sessions", async () => {
    storage[STORAGE_KEY] = JSON.stringify({
      "worker-session": "r-worker",
      "task-chat-session": "r-chat",
    })

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sessions: [
          {
            sessionId: "worker-session",
            adapter: "claude",
            app: "homer",
            createdAt: 3000,
            lastMessageAt: 4000,
            cwd: "/Users/herbcaudill/Code/HerbCaudill/.ralph-worktrees/homer/bd-123",
          },
          {
            sessionId: "task-chat-session",
            adapter: "claude",
            app: "task-chat",
            createdAt: 2000,
            lastMessageAt: 2500,
            cwd: "/Users/herbcaudill/Code/HerbCaudill/ralph",
          },
        ],
      }),
    })

    const result = await fetchRalphSessions({
      fetchFn: mockFetch,
      workspaceId: "herbcaudill/ralph",
      tasks: [{ id: "r-worker", title: "Worker task" }],
    })

    expect(result).toEqual([
      {
        sessionId: "worker-session",
        adapter: "claude",
        firstMessageAt: 3000,
        lastMessageAt: 4000,
        firstUserMessage: "r-worker",
        taskId: "r-worker",
        taskTitle: "Worker task",
        isActive: false,
      },
    ])
  })

  it("matches worker worktree sessions even when the local parent directory differs from the repo owner", async () => {
    storage[STORAGE_KEY] = JSON.stringify({ "worker-session": "r-worker" })

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sessions: [
          {
            sessionId: "worker-session",
            adapter: "claude",
            app: "homer",
            createdAt: 3000,
            lastMessageAt: 4000,
            cwd: "/Users/herbcaudill/Code/client-work/.widgets-worktrees/homer/bd-123",
          },
        ],
      }),
    })

    const result = await fetchRalphSessions({
      fetchFn: mockFetch,
      workspaceId: "acme/widgets",
      tasks: [{ id: "r-worker", title: "Worker task" }],
    })

    expect(result).toEqual([
      {
        sessionId: "worker-session",
        adapter: "claude",
        firstMessageAt: 3000,
        lastMessageAt: 4000,
        firstUserMessage: "r-worker",
        taskId: "r-worker",
        taskTitle: "Worker task",
        isActive: false,
      },
    ])
  })
})
