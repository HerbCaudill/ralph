import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useWorkspace } from ".././useWorkspace"

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe("useWorkspace", () => {
  const mockWorkspace = {
    path: "/home/user/project",
    name: "project",
    issueCount: 5,
    daemonConnected: true,
    daemonStatus: "running",
    accentColor: "#ff0000",
    branch: "main",
    issuePrefix: "PROJ",
  }

  const mockWorkspaces = [
    { path: "/home/user/project", name: "project", issueCount: 5, accentColor: "#ff0000" },
    { path: "/home/user/other", name: "other", issueCount: 3, accentColor: "#00ff00" },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("initialization", () => {
    it("fetches workspace and workspaces on mount", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, workspace: mockWorkspace }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, workspaces: mockWorkspaces }),
        })

      const { result } = renderHook(() => useWorkspace())

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false)
      })

      expect(mockFetch).toHaveBeenCalledWith("/api/workspace")
      expect(mockFetch).toHaveBeenCalledWith("/api/workspaces")
    })

    it("sets isLoading while fetching", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, workspace: mockWorkspace }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, workspaces: mockWorkspaces }),
        })

      const { result } = renderHook(() => useWorkspace())

      expect(result.current.state.isLoading).toBe(true)

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false)
      })
    })

    it("parses the workspace from the response correctly", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, workspace: mockWorkspace }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, workspaces: mockWorkspaces }),
        })

      const { result } = renderHook(() => useWorkspace())

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false)
      })

      // The current workspace should have all the correct properties from the nested workspace object
      expect(result.current.state.current).toMatchObject({
        path: "/home/user/project",
        name: "project",
        issueCount: 5,
        accentColor: "#ff0000",
        branch: "main",
        issuePrefix: "PROJ",
      })
    })

    it("parses workspaces list from the response correctly", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, workspace: mockWorkspace }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, workspaces: mockWorkspaces }),
        })

      const { result } = renderHook(() => useWorkspace())

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false)
      })

      expect(result.current.state.workspaces).toEqual(mockWorkspaces)
    })
  })

  describe("error handling", () => {
    it("sets error when workspace fetch fails", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ ok: false, error: "Not found" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, workspaces: mockWorkspaces }),
        })

      const { result } = renderHook(() => useWorkspace())

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false)
      })

      expect(result.current.state.error).toBe("Failed to fetch workspace")
    })

    it("sets current to null when response returns ok: false", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: false, error: "No workspace" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, workspaces: mockWorkspaces }),
        })

      const { result } = renderHook(() => useWorkspace())

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false)
      })

      expect(result.current.state.current).toBe(null)
    })
  })

  describe("switchWorkspace", () => {
    it("calls the switch endpoint and refreshes", async () => {
      mockFetch
        // Initial fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, workspace: mockWorkspace }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, workspaces: mockWorkspaces }),
        })
        // Switch call
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true }),
        })
        // Refresh after switch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              workspace: { ...mockWorkspace, path: "/home/user/other", name: "other" },
            }),
        })

      const { result } = renderHook(() => useWorkspace())

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.actions.switchWorkspace("/home/user/other")
      })

      expect(mockFetch).toHaveBeenCalledWith("/api/workspace/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "/home/user/other" }),
      })
    })

    it("calls onSwitchStart callback immediately when switching workspaces", async () => {
      const onSwitchStart = vi.fn()

      mockFetch
        // Initial fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, workspace: mockWorkspace }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, workspaces: mockWorkspaces }),
        })
        // Switch call - use a delayed promise to verify onSwitchStart is called before fetch completes
        .mockImplementationOnce(
          () =>
            new Promise(resolve => {
              // Verify callback was already called before fetch completes
              expect(onSwitchStart).toHaveBeenCalledTimes(1)
              resolve({
                ok: true,
                json: () => Promise.resolve({ ok: true }),
              })
            }),
        )
        // Refresh after switch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              workspace: { ...mockWorkspace, path: "/home/user/other", name: "other" },
            }),
        })

      const { result } = renderHook(() => useWorkspace({ onSwitchStart }))

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.actions.switchWorkspace("/home/user/other")
      })

      // Callback should have been called exactly once
      expect(onSwitchStart).toHaveBeenCalledTimes(1)
    })
  })
})
