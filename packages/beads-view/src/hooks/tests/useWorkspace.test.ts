import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useWorkspace } from "../useWorkspace"
import { configureApiClient, getApiClientConfig } from "../../lib/apiClient"
import { beadsViewStore } from "../../store/beadsViewStore"

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
    beadsViewStore.setState({ tasks: [], taskCacheByWorkspace: {} })
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

      // With deferred loading, the saved workspace is fetched first via /api/workspace
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/api/workspace?") || url.includes("/api/workspace%3F")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ok: true, workspace: otherWorkspace }),
          })
        }
        if (url.includes("/api/workspaces")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ok: true, workspaces: mockWorkspaces }),
          })
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`))
      })

      const { result } = renderHook(() => useWorkspace())

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false)
      })

      expect(result.current.state.current?.path).toBe("/home/user/other")
    })

    it("falls back to first workspace if saved path is not in the list", async () => {
      localStorage.setItem("ralph-workspace-path", "/home/user/deleted")

      // With deferred loading, the saved workspace fetch fails (404), then we fall back to list
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/api/workspace?") || url.includes("/api/workspace%3F")) {
          // First call for saved workspace returns 404 (workspace doesn't exist)
          return Promise.resolve({
            ok: false,
            status: 404,
            json: () => Promise.resolve({ ok: false, error: "workspace not found" }),
          })
        }
        if (url.includes("/api/workspaces")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ok: true, workspaces: mockWorkspaces }),
          })
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`))
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

    it("uses saved workspace path from localStorage during initialization", () => {
      localStorage.setItem("ralph-workspace-path", "/home/user/other")
      // Even if a different config is set initially...
      configureApiClient({ workspacePath: "/home/user/project" })

      // The hook should use the saved localStorage path for its initialization
      mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

      renderHook(() => useWorkspace())

      // The hook updates the config to match the saved localStorage path
      expect(getApiClientConfig().workspacePath).toBe("/home/user/other")
    })

    it("overrides existing stale apiClient config with localStorage value synchronously", () => {
      // This test verifies the fix for issue r-0cqve:
      // When apiClient was pre-configured with a stale workspace path,
      // the eager config should override it SYNCHRONOUSLY during render,
      // not in an effect. This matters because other components may make
      // API calls before effects run.

      localStorage.setItem("ralph-workspace-path", "/home/user/correct-workspace")
      configureApiClient({ workspacePath: "/home/user/stale-workspace" })

      // Capture config state at various points during render
      let configDuringRender: string | undefined
      let configAfterRender: string | undefined

      // Use a wrapper to capture the config during the hook's render
      const { result } = renderHook(() => {
        const hookResult = useWorkspace()
        // This runs during render, BEFORE effects
        configDuringRender = getApiClientConfig().workspacePath
        return hookResult
      })

      // This runs after the hook has completed its first render pass
      configAfterRender = getApiClientConfig().workspacePath

      // The eager config should have updated the workspace path DURING render
      // (not waiting for effects), so that other components rendered in the
      // same pass can use the correct workspace
      expect(configDuringRender).toBe("/home/user/correct-workspace")
      expect(configAfterRender).toBe("/home/user/correct-workspace")
    })
  })

  describe("deferred workspace list loading", () => {
    it("fetches saved workspace immediately, then loads workspace list in background", async () => {
      localStorage.setItem("ralph-workspace-path", "/home/user/project")

      const fetchOrder: string[] = []

      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/api/workspace?") || url.includes("/api/workspace%3F")) {
          fetchOrder.push("workspace")
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ok: true, workspace: mockWorkspace }),
          })
        }
        if (url.includes("/api/workspaces")) {
          fetchOrder.push("workspaces")
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ok: true, workspaces: mockWorkspaces }),
          })
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`))
      })

      const { result } = renderHook(() => useWorkspace())

      // Wait for initial workspace to load
      await waitFor(() => {
        expect(result.current.state.current).not.toBeNull()
      })

      // Verify workspace was fetched BEFORE workspaces list
      expect(fetchOrder[0]).toBe("workspace")

      // Current workspace should be set immediately
      expect(result.current.state.current?.path).toBe("/home/user/project")

      // Wait for workspaces list to load in background
      await waitFor(() => {
        expect(result.current.state.workspaces.length).toBeGreaterThan(0)
      })

      // Workspaces list should now be loaded
      expect(fetchOrder).toContain("workspaces")
      expect(result.current.state.workspaces).toHaveLength(2)
    })

    it("shows loading=false as soon as saved workspace is loaded (before workspace list)", async () => {
      localStorage.setItem("ralph-workspace-path", "/home/user/project")

      let resolveWorkspacesList: ((value: unknown) => void) | null = null
      const workspacesListPromise = new Promise(resolve => {
        resolveWorkspacesList = resolve
      })

      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/api/workspace?") || url.includes("/api/workspace%3F")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ok: true, workspace: mockWorkspace }),
          })
        }
        if (url.includes("/api/workspaces")) {
          // Delay the workspaces list response
          return workspacesListPromise.then(() => ({
            ok: true,
            json: () => Promise.resolve({ ok: true, workspaces: mockWorkspaces }),
          }))
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`))
      })

      const { result } = renderHook(() => useWorkspace())

      // Wait for workspace to load
      await waitFor(() => {
        expect(result.current.state.current).not.toBeNull()
      })

      // isLoading should be false even though workspaces list hasn't loaded yet
      expect(result.current.state.isLoading).toBe(false)
      expect(result.current.state.current?.path).toBe("/home/user/project")

      // Workspaces list should still be empty
      expect(result.current.state.workspaces).toHaveLength(0)

      // Now resolve the workspaces list
      resolveWorkspacesList!({ ok: true })

      // Wait for workspaces list to load
      await waitFor(() => {
        expect(result.current.state.workspaces.length).toBeGreaterThan(0)
      })
    })

    it("falls back to fetching workspace list first when no saved workspace exists", async () => {
      // No localStorage set

      const fetchOrder: string[] = []

      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/api/workspace?") || url.includes("/api/workspace%3F")) {
          fetchOrder.push("workspace")
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ok: true, workspace: mockWorkspace }),
          })
        }
        if (url.includes("/api/workspaces")) {
          fetchOrder.push("workspaces")
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ok: true, workspaces: mockWorkspaces }),
          })
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`))
      })

      const { result } = renderHook(() => useWorkspace())

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false)
      })

      // Should have fetched workspaces list FIRST when no saved workspace
      expect(fetchOrder[0]).toBe("workspaces")
      // Then workspace info for the first one
      expect(fetchOrder).toContain("workspace")
    })

    it("falls back to first workspace from list if saved workspace fails to load", async () => {
      localStorage.setItem("ralph-workspace-path", "/home/user/deleted")

      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/api/workspace?") || url.includes("/api/workspace%3F")) {
          // Simulate 404 for the deleted workspace
          return Promise.resolve({
            ok: false,
            status: 404,
            json: () => Promise.resolve({ ok: false, error: "workspace not found" }),
          })
        }
        if (url.includes("/api/workspaces")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ok: true, workspaces: mockWorkspaces }),
          })
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`))
      })

      const { result } = renderHook(() => useWorkspace())

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false)
      })

      // Should have fallen back to first workspace from the list
      expect(result.current.state.current?.path).toBe("/home/user/project")
      expect(result.current.state.workspaces).toHaveLength(2)
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
    it("hydrates tasks immediately from the selected workspace cache on switch", async () => {
      const otherWorkspace = {
        path: "/home/user/other",
        name: "other",
        issueCount: 3,
        branch: "develop",
      }

      beadsViewStore.setState({
        tasks: [{ id: "r-aaa", title: "Task A", status: "open" }],
        taskCacheByWorkspace: {
          "/home/user/project": [{ id: "r-aaa", title: "Task A", status: "open" }],
          "/home/user/other": [{ id: "r-bbb", title: "Task B", status: "open" }],
        },
      })

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
              setTimeout(() => {
                resolve({
                  ok: true,
                  json: () => Promise.resolve({ ok: true, workspace: otherWorkspace }),
                })
              }, 0)
            }),
        )

      const { result } = renderHook(() => useWorkspace())

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false)
      })

      await act(async () => {
        void result.current.actions.switchWorkspace("/home/user/other")
      })

      expect(beadsViewStore.getState().tasks).toEqual([
        { id: "r-bbb", title: "Task B", status: "open" },
      ])
    })

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
