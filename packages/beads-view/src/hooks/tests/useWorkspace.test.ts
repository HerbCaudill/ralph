import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useWorkspace } from "../useWorkspace"
import { configureApiClient, getApiClientConfig } from "../../lib/apiClient"

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
    {
      path: "/home/user/project",
      name: "project",
      accentColor: "#ff0000",
      activeIssueCount: 5,
    },
    {
      path: "/home/user/other",
      name: "other",
      accentColor: "#00ff00",
      activeIssueCount: 3,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    // Reset the API client config
    configureApiClient({})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("initialization", () => {
    it("fetches workspaces and workspace info on mount", async () => {
      mockFetch
        // /api/workspaces
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, workspaces: mockWorkspaces }),
        })
        // /api/workspace (for first workspace info)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, workspace: mockWorkspace }),
        })

      const { result } = renderHook(() => useWorkspace())

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false)
      })

      // Should have fetched workspaces list
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/api/workspaces"), undefined)
    })

    it("sets isLoading while fetching", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, workspaces: mockWorkspaces }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, workspace: mockWorkspace }),
        })

      const { result } = renderHook(() => useWorkspace())

      expect(result.current.state.isLoading).toBe(true)

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false)
      })
    })

    it("auto-selects the first workspace when no localStorage value exists", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, workspaces: mockWorkspaces }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, workspace: mockWorkspace }),
        })

      const { result } = renderHook(() => useWorkspace())

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false)
      })

      expect(result.current.state.current).toMatchObject({
        path: "/home/user/project",
        name: "project",
      })
    })

    it("uses saved localStorage workspace if it exists in the list", async () => {
      localStorage.setItem("ralph-workspace-path", "/home/user/other")

      const otherWorkspace = {
        path: "/home/user/other",
        name: "other",
        issueCount: 3,
        branch: "develop",
        accentColor: "#00ff00",
        issuePrefix: "OTH",
      }

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, workspaces: mockWorkspaces }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, workspace: otherWorkspace }),
        })

      const { result } = renderHook(() => useWorkspace())

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false)
      })

      expect(result.current.state.current?.path).toBe("/home/user/other")
    })

    it("falls back to first workspace if saved path is not in the list", async () => {
      localStorage.setItem("ralph-workspace-path", "/home/user/deleted")

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, workspaces: mockWorkspaces }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, workspace: mockWorkspace }),
        })

      const { result } = renderHook(() => useWorkspace())

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false)
      })

      expect(result.current.state.current?.path).toBe("/home/user/project")
    })

    it("configures apiClient with workspace path", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, workspaces: mockWorkspaces }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, workspace: mockWorkspace }),
        })

      renderHook(() => useWorkspace())

      await waitFor(() => {
        const config = getApiClientConfig()
        expect(config.workspacePath).toBe("/home/user/project")
      })
    })
  })

  describe("eager workspace config", () => {
    it("configures apiClient with saved workspace path synchronously during first render", async () => {
      localStorage.setItem("ralph-workspace-path", "/home/user/project")

      // No mock fetch responses needed -- we just check the synchronous config
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, workspaces: mockWorkspaces }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, workspace: mockWorkspace }),
        })

      renderHook(() => useWorkspace())

      // Config should be set immediately (no waiting for effects)
      expect(getApiClientConfig().workspacePath).toBe("/home/user/project")
    })

    it("does not overwrite existing workspace config", async () => {
      localStorage.setItem("ralph-workspace-path", "/home/user/other")
      configureApiClient({ workspacePath: "/home/user/project" })

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, workspaces: mockWorkspaces }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, workspace: mockWorkspace }),
        })

      renderHook(() => useWorkspace())

      // Should NOT have overwritten the existing config
      expect(getApiClientConfig().workspacePath).toBe("/home/user/project")
    })
  })

  describe("error handling", () => {
    it("sets error when no workspaces are found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true, workspaces: [] }),
      })

      const { result } = renderHook(() => useWorkspace())

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false)
      })

      expect(result.current.state.error).toBe("No workspaces found")
    })
  })

  describe("switchWorkspace", () => {
    it("switches workspace client-side and updates apiClient config", async () => {
      const otherWorkspace = {
        path: "/home/user/other",
        name: "other",
        issueCount: 3,
        branch: "develop",
      }

      mockFetch
        // Initial: workspaces list
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, workspaces: mockWorkspaces }),
        })
        // Initial: workspace info
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, workspace: mockWorkspace }),
        })
        // Switch: workspace info for new workspace
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, workspace: otherWorkspace }),
        })

      const { result } = renderHook(() => useWorkspace())

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.actions.switchWorkspace("/home/user/other")
      })

      // Should NOT have called /api/workspace/switch
      expect(mockFetch).not.toHaveBeenCalledWith(
        expect.stringContaining("/api/workspace/switch"),
        expect.anything(),
      )

      // Should have updated current workspace
      expect(result.current.state.current?.path).toBe("/home/user/other")

      // Should have updated apiClient config
      expect(getApiClientConfig().workspacePath).toBe("/home/user/other")

      // Should have saved to localStorage
      expect(localStorage.getItem("ralph-workspace-path")).toBe("/home/user/other")
    })

    it("calls onSwitchStart callback immediately when switching workspaces", async () => {
      const onSwitchStart = vi.fn()

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, workspaces: mockWorkspaces }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, workspace: mockWorkspace }),
        })
        .mockImplementationOnce(
          () =>
            new Promise(resolve => {
              // Verify callback was already called before fetch completes
              expect(onSwitchStart).toHaveBeenCalledTimes(1)
              resolve({
                ok: true,
                json: () =>
                  Promise.resolve({
                    ok: true,
                    workspace: { ...mockWorkspace, path: "/home/user/other", name: "other" },
                  }),
              })
            }),
        )

      const { result } = renderHook(() => useWorkspace({ onSwitchStart }))

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.actions.switchWorkspace("/home/user/other")
      })

      expect(onSwitchStart).toHaveBeenCalledTimes(1)
    })
  })
})
