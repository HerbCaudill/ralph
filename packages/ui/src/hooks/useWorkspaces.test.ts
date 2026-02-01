import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useWorkspaces } from "./useWorkspaces"
import { useAppStore } from "@/store"

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe("useWorkspaces", () => {
  const mockWorkspaces = [
    {
      path: "/workspace/a",
      name: "Workspace A",
      isActive: true,
      database: "",
      pid: 1,
      version: "1",
      startedAt: "",
    },
    {
      path: "/workspace/b",
      name: "Workspace B",
      isActive: false,
      database: "",
      pid: 2,
      version: "1",
      startedAt: "",
    },
    {
      path: "/workspace/c",
      name: "Workspace C",
      isActive: false,
      database: "",
      pid: 3,
      version: "1",
      startedAt: "",
    },
  ]

  beforeEach(() => {
    // resetAllMocks clears both call history AND implementation queue (unlike clearAllMocks)
    vi.resetAllMocks()
    // Use fake timers to control debouncing behavior
    // shouldAdvanceTime allows promises/microtasks to resolve (needed for waitFor)
    vi.useFakeTimers({ shouldAdvanceTime: true })
    // Reset store
    useAppStore.setState({
      workspace: "/workspace/a",
      accentColor: null,
      branch: null,
      issuePrefix: null,
    })
    // Default mock for workspaces list
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, workspaces: mockWorkspaces }),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe("initialization", () => {
    it("fetches workspaces on mount", async () => {
      const { result } = renderHook(() => useWorkspaces())

      await waitFor(() => {
        expect(result.current.workspaces).toHaveLength(3)
      })

      expect(mockFetch).toHaveBeenCalledWith("/api/workspaces")
    })

    it("sets isLoading while fetching", async () => {
      // Create a promise we can control
      let resolvePromise: (value: unknown) => void
      const controlledPromise = new Promise(resolve => {
        resolvePromise = resolve
      })

      mockFetch.mockReturnValue({
        ok: true,
        json: () => controlledPromise,
      })

      const { result } = renderHook(() => useWorkspaces())

      // Should be loading initially
      expect(result.current.isLoading).toBe(true)

      // Resolve the promise
      await act(async () => {
        resolvePromise!({ ok: true, workspaces: mockWorkspaces })
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })
  })

  describe("goToNextWorkspace", () => {
    it("switches to the next workspace in the list", async () => {
      // Mock both workspaces list fetch and switch fetch
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, workspaces: mockWorkspaces }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              workspace: {
                path: "/workspace/b",
                accentColor: null,
                branch: null,
                issuePrefix: null,
              },
            }),
        })

      const { result } = renderHook(() => useWorkspaces())

      await waitFor(() => {
        expect(result.current.workspaces).toHaveLength(3)
      })

      await act(async () => {
        await result.current.goToNextWorkspace()
      })

      // Should have called the switch API
      expect(mockFetch).toHaveBeenCalledWith("/api/workspace/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "/workspace/b" }),
      })
    })

    it("wraps around to the first workspace when at the end", async () => {
      const workspacesAtEnd = [
        {
          path: "/workspace/a",
          name: "Workspace A",
          isActive: false,
          database: "",
          pid: 1,
          version: "1",
          startedAt: "",
        },
        {
          path: "/workspace/b",
          name: "Workspace B",
          isActive: false,
          database: "",
          pid: 2,
          version: "1",
          startedAt: "",
        },
        {
          path: "/workspace/c",
          name: "Workspace C",
          isActive: true,
          database: "",
          pid: 3,
          version: "1",
          startedAt: "",
        },
      ]

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, workspaces: workspacesAtEnd }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              workspace: {
                path: "/workspace/a",
                accentColor: null,
                branch: null,
                issuePrefix: null,
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, issues: [] }),
        })

      useAppStore.setState({ workspace: "/workspace/c" })

      const { result } = renderHook(() => useWorkspaces())

      await waitFor(() => {
        expect(result.current.workspaces).toHaveLength(3)
      })

      await act(async () => {
        await result.current.goToNextWorkspace()
      })

      // Should wrap around to workspace A
      expect(mockFetch).toHaveBeenCalledWith("/api/workspace/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "/workspace/a" }),
      })
    })
  })

  describe("goToPreviousWorkspace", () => {
    it("switches to the previous workspace in the list", async () => {
      const workspacesAtB = [
        {
          path: "/workspace/a",
          name: "Workspace A",
          isActive: false,
          database: "",
          pid: 1,
          version: "1",
          startedAt: "",
        },
        {
          path: "/workspace/b",
          name: "Workspace B",
          isActive: true,
          database: "",
          pid: 2,
          version: "1",
          startedAt: "",
        },
        {
          path: "/workspace/c",
          name: "Workspace C",
          isActive: false,
          database: "",
          pid: 3,
          version: "1",
          startedAt: "",
        },
      ]

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, workspaces: workspacesAtB }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              workspace: {
                path: "/workspace/a",
                accentColor: null,
                branch: null,
                issuePrefix: null,
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, issues: [] }),
        })

      useAppStore.setState({ workspace: "/workspace/b" })

      const { result } = renderHook(() => useWorkspaces())

      await waitFor(() => {
        expect(result.current.workspaces).toHaveLength(3)
      })

      await act(async () => {
        await result.current.goToPreviousWorkspace()
      })

      // Should switch to workspace A
      expect(mockFetch).toHaveBeenCalledWith("/api/workspace/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "/workspace/a" }),
      })
    })

    it("wraps around to the last workspace when at the beginning", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, workspaces: mockWorkspaces }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              workspace: {
                path: "/workspace/c",
                accentColor: null,
                branch: null,
                issuePrefix: null,
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, issues: [] }),
        })

      const { result } = renderHook(() => useWorkspaces())

      await waitFor(() => {
        expect(result.current.workspaces).toHaveLength(3)
      })

      await act(async () => {
        await result.current.goToPreviousWorkspace()
      })

      // Should wrap around to workspace C
      expect(mockFetch).toHaveBeenCalledWith("/api/workspace/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "/workspace/c" }),
      })
    })
  })

  describe("edge cases", () => {
    it("does nothing when there is only one workspace", async () => {
      const singleWorkspace = [
        {
          path: "/workspace/a",
          name: "Workspace A",
          isActive: true,
          database: "",
          pid: 1,
          version: "1",
          startedAt: "",
        },
      ]

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true, workspaces: singleWorkspace }),
      })

      const { result } = renderHook(() => useWorkspaces())

      await waitFor(() => {
        expect(result.current.workspaces).toHaveLength(1)
      })

      await act(async () => {
        await result.current.goToNextWorkspace()
      })

      // Should not have called switch
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).not.toHaveBeenCalledWith("/api/workspace/switch", expect.anything())
    })

    it("does nothing when there are no workspaces", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true, workspaces: [] }),
      })

      const { result } = renderHook(() => useWorkspaces())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.goToNextWorkspace()
      })

      // Should have fetched again (since workspaces.length was 0) but no switch
      expect(mockFetch).not.toHaveBeenCalledWith("/api/workspace/switch", expect.anything())
    })
  })

  describe("refresh", () => {
    it("refetches the workspaces list", async () => {
      const { result } = renderHook(() => useWorkspaces())

      await waitFor(() => {
        expect(result.current.workspaces).toHaveLength(3)
      })

      // Clear and setup new mock response
      mockFetch.mockClear()
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            workspaces: [
              ...mockWorkspaces,
              {
                path: "/workspace/d",
                name: "Workspace D",
                isActive: false,
                database: "",
                pid: 4,
                version: "1",
                startedAt: "",
              },
            ],
          }),
      })

      await act(async () => {
        await result.current.refresh()
      })

      expect(result.current.workspaces).toHaveLength(4)
    })
  })
})
