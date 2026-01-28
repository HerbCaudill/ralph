import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"
import { useTaskChatSessions } from "./useTaskChatSessions"
import type { TaskChatSessionMetadata } from "@/lib/persistence"

// Mock the eventDatabase
vi.mock("@/lib/persistence", () => ({
  eventDatabase: {
    init: vi.fn(),
    listTaskChatSessions: vi.fn(),
    listTaskChatSessionsByWorkspace: vi.fn(),
  },
}))

import { eventDatabase } from "@/lib/persistence"
const mockEventDatabase = vi.mocked(eventDatabase)

const mockSessions: TaskChatSessionMetadata[] = [
  {
    id: "session-1",
    taskId: "task-1",
    taskTitle: "Test Task 1",
    instanceId: "default",
    workspaceId: null,
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 1800000,
    messageCount: 5,
    eventCount: 12,
    lastEventSequence: 11,
  },
  {
    id: "session-2",
    taskId: "task-2",
    taskTitle: "Test Task 2",
    instanceId: "default",
    workspaceId: null,
    createdAt: Date.now() - 7200000,
    updatedAt: Date.now() - 3600000,
    messageCount: 8,
    eventCount: 20,
    lastEventSequence: 19,
  },
]

const mockWorkspaceSessions: TaskChatSessionMetadata[] = [
  {
    id: "session-ws-1",
    taskId: "task-ws-1",
    taskTitle: "Workspace Task 1",
    instanceId: "default",
    workspaceId: "workspace-1",
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 1800000,
    messageCount: 3,
    eventCount: 8,
    lastEventSequence: 7,
  },
]

describe("useTaskChatSessions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEventDatabase.init.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns loading state initially", async () => {
    mockEventDatabase.listTaskChatSessions.mockResolvedValue([])

    const { result } = renderHook(() => useTaskChatSessions({ instanceId: "default" }))

    expect(result.current.isLoading).toBe(true)
    expect(result.current.sessions).toEqual([])
    expect(result.current.error).toBeNull()

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
  })

  it("fetches sessions on mount", async () => {
    mockEventDatabase.listTaskChatSessions.mockResolvedValue(mockSessions)

    const { result } = renderHook(() => useTaskChatSessions({ instanceId: "default" }))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockEventDatabase.init).toHaveBeenCalled()
    expect(mockEventDatabase.listTaskChatSessions).toHaveBeenCalledWith("default")
    expect(result.current.sessions).toEqual(mockSessions)
    expect(result.current.error).toBeNull()
  })

  it("handles errors gracefully", async () => {
    mockEventDatabase.listTaskChatSessions.mockRejectedValue(new Error("Database error"))

    const { result } = renderHook(() => useTaskChatSessions({ instanceId: "default" }))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.sessions).toEqual([])
    expect(result.current.error).toBe("Database error")
  })

  it("handles non-Error exceptions", async () => {
    mockEventDatabase.listTaskChatSessions.mockRejectedValue("String error")

    const { result } = renderHook(() => useTaskChatSessions({ instanceId: "default" }))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBe("Failed to fetch task chat sessions")
  })

  it("refresh function re-fetches sessions", async () => {
    mockEventDatabase.listTaskChatSessions.mockResolvedValue(mockSessions)

    const { result } = renderHook(() => useTaskChatSessions({ instanceId: "default" }))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockEventDatabase.listTaskChatSessions).toHaveBeenCalledTimes(1)

    // Update mock to return different data
    const newSessions = [
      ...mockSessions,
      {
        id: "session-3",
        taskId: "task-3",
        taskTitle: "Test Task 3",
        instanceId: "default",
        workspaceId: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messageCount: 1,
        eventCount: 2,
        lastEventSequence: 1,
      },
    ]
    mockEventDatabase.listTaskChatSessions.mockResolvedValue(newSessions)

    await act(async () => {
      await result.current.refresh()
    })

    expect(mockEventDatabase.listTaskChatSessions).toHaveBeenCalledTimes(2)
    expect(result.current.sessions).toEqual(newSessions)
  })

  it("does not fetch when disabled", async () => {
    mockEventDatabase.listTaskChatSessions.mockResolvedValue(mockSessions)

    const { result } = renderHook(() =>
      useTaskChatSessions({ instanceId: "default", enabled: false }),
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockEventDatabase.listTaskChatSessions).not.toHaveBeenCalled()
    expect(result.current.sessions).toEqual([])
  })

  it("re-fetches when instanceId changes", async () => {
    mockEventDatabase.listTaskChatSessions.mockResolvedValue(mockSessions)

    const { result, rerender } = renderHook(
      ({ instanceId }) => useTaskChatSessions({ instanceId }),
      { initialProps: { instanceId: "instance-1" } },
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockEventDatabase.listTaskChatSessions).toHaveBeenCalledWith("instance-1")

    rerender({ instanceId: "instance-2" })

    await waitFor(() => {
      expect(mockEventDatabase.listTaskChatSessions).toHaveBeenCalledWith("instance-2")
    })
  })

  it("clears error on successful refresh", async () => {
    // First, cause an error
    mockEventDatabase.listTaskChatSessions.mockRejectedValue(new Error("Initial error"))

    const { result } = renderHook(() => useTaskChatSessions({ instanceId: "default" }))

    await waitFor(() => {
      expect(result.current.error).toBe("Initial error")
    })

    // Then fix the error
    mockEventDatabase.listTaskChatSessions.mockResolvedValue(mockSessions)

    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.error).toBeNull()
    expect(result.current.sessions).toEqual(mockSessions)
  })

  it("uses listTaskChatSessionsByWorkspace when workspaceId is provided", async () => {
    mockEventDatabase.listTaskChatSessionsByWorkspace.mockResolvedValue(mockWorkspaceSessions)

    const { result } = renderHook(() =>
      useTaskChatSessions({ instanceId: "default", workspaceId: "workspace-1" }),
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockEventDatabase.listTaskChatSessionsByWorkspace).toHaveBeenCalledWith("workspace-1")
    expect(mockEventDatabase.listTaskChatSessions).not.toHaveBeenCalled()
    expect(result.current.sessions).toEqual(mockWorkspaceSessions)
    expect(result.current.error).toBeNull()
  })

  it("uses listTaskChatSessions when workspaceId is not provided", async () => {
    mockEventDatabase.listTaskChatSessions.mockResolvedValue(mockSessions)

    const { result } = renderHook(() => useTaskChatSessions({ instanceId: "default" }))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockEventDatabase.listTaskChatSessions).toHaveBeenCalledWith("default")
    expect(mockEventDatabase.listTaskChatSessionsByWorkspace).not.toHaveBeenCalled()
    expect(result.current.sessions).toEqual(mockSessions)
  })

  it("re-fetches when workspaceId changes", async () => {
    mockEventDatabase.listTaskChatSessionsByWorkspace.mockResolvedValue(mockWorkspaceSessions)

    const { result, rerender } = renderHook(
      ({ instanceId, workspaceId }) => useTaskChatSessions({ instanceId, workspaceId }),
      { initialProps: { instanceId: "default", workspaceId: "workspace-1" } },
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockEventDatabase.listTaskChatSessionsByWorkspace).toHaveBeenCalledWith("workspace-1")

    mockEventDatabase.listTaskChatSessionsByWorkspace.mockClear()

    rerender({ instanceId: "default", workspaceId: "workspace-2" })

    await waitFor(() => {
      expect(mockEventDatabase.listTaskChatSessionsByWorkspace).toHaveBeenCalledWith("workspace-2")
    })
  })

  it("switches from workspace-scoped to instance-scoped when workspaceId is removed", async () => {
    mockEventDatabase.listTaskChatSessionsByWorkspace.mockResolvedValue(mockWorkspaceSessions)
    mockEventDatabase.listTaskChatSessions.mockResolvedValue(mockSessions)

    const { result, rerender } = renderHook(
      ({ instanceId, workspaceId }: { instanceId: string; workspaceId?: string }) =>
        useTaskChatSessions({ instanceId, workspaceId }),
      { initialProps: { instanceId: "default", workspaceId: "workspace-1" } },
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockEventDatabase.listTaskChatSessionsByWorkspace).toHaveBeenCalledWith("workspace-1")
    expect(result.current.sessions).toEqual(mockWorkspaceSessions)

    // Remove workspaceId - should fall back to instance-scoped query
    rerender({ instanceId: "default", workspaceId: undefined })

    await waitFor(() => {
      expect(mockEventDatabase.listTaskChatSessions).toHaveBeenCalledWith("default")
    })

    expect(result.current.sessions).toEqual(mockSessions)
  })
})
