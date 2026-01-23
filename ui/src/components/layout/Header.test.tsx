import { render, screen, fireEvent, waitFor, act } from "@/test-utils"
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { Header } from "./Header"
import { useAppStore, createRalphInstance } from "@/store"

// Mock the hooks used by theme components (ThemePicker, SettingsDropdown)
// Import is needed inside the factory function to access useAppStore
vi.mock("@/hooks", async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>
  // Dynamically import store to access it from the mock
  const { useAppStore, selectTheme } = await import("@/store")
  return {
    ...actual,
    useVSCodeTheme: () => ({
      themes: [],
      activeTheme: null,
      activeThemeId: null,
      currentVSCodeTheme: null,
      variant: null,
      isLoadingList: false,
      isLoadingTheme: false,
      error: null,
      fetchThemes: vi.fn(),
      applyTheme: vi.fn(),
      previewTheme: vi.fn(),
      clearPreview: vi.fn(),
      resetToDefault: vi.fn(),
    }),
    useThemeCoordinator: () => {
      // Get current theme from store so it reflects updates
      const theme = useAppStore(selectTheme)
      const resolvedTheme = theme === "system" ? "dark" : theme
      return {
        // VS Code theme values
        themes: [],
        activeTheme: null,
        activeThemeId: null,
        currentVSCodeTheme: null,
        variant: null,
        isLoadingList: false,
        isLoadingTheme: false,
        error: null,
        fetchThemes: vi.fn(),
        applyTheme: vi.fn(),
        previewTheme: vi.fn(),
        clearPreview: vi.fn(),
        resetToDefault: vi.fn(),
        // Light/dark theme values - use real store integration
        theme,
        resolvedTheme,
        setTheme: (newTheme: "system" | "light" | "dark") =>
          useAppStore.getState().setTheme(newTheme),
        setMode: (mode: "light" | "dark") => useAppStore.getState().setTheme(mode),
        cycleTheme: vi.fn(),
      }
    },
  }
})

// Mock fetch
const mockFetch = vi.fn()
;(globalThis as { fetch: typeof fetch }).fetch = mockFetch

// Mock matchMedia
const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}))

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
    get length() {
      return Object.keys(store).length
    },
    _setStore: (newStore: Record<string, string>) => {
      store = newStore
    },
  }
})()

describe("Header", () => {
  const mockWorkspaceResponse = {
    ok: true,
    workspace: {
      path: "/path/to/my-project",
      name: "my-project",
      issueCount: 42,
      daemonConnected: true,
      daemonStatus: "healthy",
    },
  }

  beforeEach(() => {
    // Reset store state before each test
    useAppStore.getState().reset()
    vi.clearAllMocks()
    // Default mock for fetch
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockWorkspaceResponse),
    })
    // Mock matchMedia for theme detection
    window.matchMedia = mockMatchMedia
    // Mock localStorage for theme persistence
    mockLocalStorage.clear()
    Object.defineProperty(window, "localStorage", {
      value: mockLocalStorage,
      writable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders the logo", async () => {
    render(<Header />)
    expect(screen.getByText("Ralph")).toBeInTheDocument()

    // Wait for workspace fetch to complete to avoid act() warning
    await waitFor(() => {
      expect(screen.getByText("my-project")).toBeInTheDocument()
    })
  })

  it("shows 'No workspace' when workspace is null and fetch fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true, workspace: null }),
    })
    render(<Header />)

    // Wait for fetch to complete
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/workspace")
    })

    // Should still show "No workspace" after fetch completes with null workspace
    expect(screen.getByText("No workspace")).toBeInTheDocument()
  })

  it("shows workspace name when workspace is fetched", async () => {
    render(<Header />)

    await waitFor(() => {
      expect(screen.getByText("my-project")).toBeInTheDocument()
    })
  })

  it("toggles workspace dropdown when clicked", async () => {
    render(<Header />)

    await waitFor(() => {
      expect(screen.getByText("my-project")).toBeInTheDocument()
    })

    // Dropdown should be closed initially
    expect(screen.queryByText("Workspaces")).not.toBeInTheDocument()

    // Click the workspace picker button (find by text "my-project")
    const workspaceButton = screen.getByText("my-project").closest("button")
    fireEvent.click(workspaceButton!)

    // Dropdown should be open
    await waitFor(() => {
      expect(screen.getByText("Workspaces")).toBeInTheDocument()
    })
  })

  it("closes dropdown when clicking outside", async () => {
    render(<Header />)

    await waitFor(() => {
      expect(screen.getByText("my-project")).toBeInTheDocument()
    })

    // Open the dropdown (find by text "my-project")
    const workspaceButton = screen.getByText("my-project").closest("button")
    fireEvent.click(workspaceButton!)

    // Dropdown should be open
    await waitFor(() => {
      expect(screen.getByText("Workspaces")).toBeInTheDocument()
    })

    // Click outside (on the document)
    fireEvent.mouseDown(document.body)

    // Dropdown should be closed
    expect(screen.queryByText("Workspaces")).not.toBeInTheDocument()
  })

  it("applies custom className", async () => {
    const { container } = render(<Header className="custom-class" />)
    expect(container.firstChild).toHaveClass("custom-class")

    // Wait for workspace fetch to complete to avoid act() warning
    await waitFor(() => {
      expect(screen.getByText("my-project")).toBeInTheDocument()
    })
  })

  describe("settings dropdown", () => {
    it("renders settings dropdown button", async () => {
      render(<Header />)
      expect(screen.getByTestId("settings-dropdown-trigger")).toBeInTheDocument()

      // Wait for workspace fetch to complete to avoid act() warning
      await waitFor(() => {
        expect(screen.getByText("my-project")).toBeInTheDocument()
      })
    })

    it("shows settings button with correct aria-label", async () => {
      render(<Header />)

      const button = screen.getByTestId("settings-dropdown-trigger")
      expect(button).toHaveAttribute("aria-label", "Settings")

      // Wait for workspace fetch to complete to avoid act() warning
      await waitFor(() => {
        expect(screen.getByText("my-project")).toBeInTheDocument()
      })
    })

    it("opens settings dropdown when clicked", async () => {
      render(<Header />)

      // Wait for workspace fetch to complete to avoid act() warning
      await waitFor(() => {
        expect(screen.getByText("my-project")).toBeInTheDocument()
      })

      // Dropdown should be closed initially
      expect(screen.queryByTestId("settings-dropdown")).not.toBeInTheDocument()

      // Click the settings button
      fireEvent.click(screen.getByTestId("settings-dropdown-trigger"))

      // Dropdown should be open
      expect(screen.getByTestId("settings-dropdown")).toBeInTheDocument()
    })

    it("shows appearance mode options in settings dropdown", async () => {
      render(<Header />)

      // Wait for workspace fetch to complete
      await waitFor(() => {
        expect(screen.getByText("my-project")).toBeInTheDocument()
      })

      // Open the settings dropdown
      fireEvent.click(screen.getByTestId("settings-dropdown-trigger"))

      // Should show appearance mode buttons
      expect(screen.getByTestId("settings-appearance-system")).toBeInTheDocument()
      expect(screen.getByTestId("settings-appearance-light")).toBeInTheDocument()
      expect(screen.getByTestId("settings-appearance-dark")).toBeInTheDocument()
    })

    it("changes theme when clicking appearance mode", async () => {
      useAppStore.getState().setTheme("system")
      render(<Header />)

      // Wait for workspace fetch to complete to avoid act() warning
      await waitFor(() => {
        expect(screen.getByText("my-project")).toBeInTheDocument()
      })

      // Open the settings dropdown
      fireEvent.click(screen.getByTestId("settings-dropdown-trigger"))

      // Click light theme
      fireEvent.click(screen.getByTestId("settings-appearance-light"))
      expect(useAppStore.getState().theme).toBe("light")

      // Click dark theme
      fireEvent.click(screen.getByTestId("settings-appearance-dark"))
      expect(useAppStore.getState().theme).toBe("dark")

      // Click system theme
      fireEvent.click(screen.getByTestId("settings-appearance-system"))
      expect(useAppStore.getState().theme).toBe("system")
    })
  })

  describe("accent color background", () => {
    it("renders header with default neutral color when no accent color set", async () => {
      render(<Header />)

      const header = screen.getByTestId("header")
      expect(header).toBeInTheDocument()
      expect(header).toHaveStyle({ backgroundColor: "#374151" })

      // Wait for workspace fetch to complete to avoid act() warning
      await waitFor(() => {
        expect(screen.getByText("my-project")).toBeInTheDocument()
      })
    })

    it("renders header with peacock color from store", async () => {
      useAppStore.getState().setAccentColor("#4d9697")
      render(<Header />)

      const header = screen.getByTestId("header")
      expect(header).toBeInTheDocument()
      expect(header).toHaveStyle({ backgroundColor: "#4d9697" })

      // Wait for workspace fetch to complete to avoid act() warning
      await waitFor(() => {
        expect(screen.getByText("my-project")).toBeInTheDocument()
      })
    })

    it("updates header background when accent color changes in store", async () => {
      // Mock workspace response with initial accent color
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            workspace: {
              ...mockWorkspaceResponse.workspace,
              accentColor: "#4d9697",
            },
          }),
      })

      render(<Header />)

      // Wait for workspace fetch to complete to avoid act() warning
      await waitFor(() => {
        expect(screen.getByText("my-project")).toBeInTheDocument()
      })

      // Verify initial color
      let header = screen.getByTestId("header")
      expect(header).toHaveStyle({ backgroundColor: "#4d9697" })

      // Change the accent color - this triggers a re-render through store subscription
      // Wrap in act() since we're directly calling store methods that cause state updates
      act(() => {
        useAppStore.getState().setAccentColor("#ff5733")
      })

      // Verify updated color
      header = screen.getByTestId("header")
      expect(header).toHaveStyle({ backgroundColor: "#ff5733" })
    })

    it("falls back to neutral gray when accent color is cleared", async () => {
      // Mock workspace response with initial accent color
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            workspace: {
              ...mockWorkspaceResponse.workspace,
              accentColor: "#4d9697",
            },
          }),
      })

      render(<Header />)

      // Wait for workspace fetch to complete to avoid act() warning
      await waitFor(() => {
        expect(screen.getByText("my-project")).toBeInTheDocument()
      })

      // Verify initial color
      let header = screen.getByTestId("header")
      expect(header).toHaveStyle({ backgroundColor: "#4d9697" })

      // Clear the accent color - this triggers a re-render through store subscription
      // Wrap in act() since we're directly calling store methods that cause state updates
      act(() => {
        useAppStore.getState().setAccentColor(null)
      })

      // Verify fallback to neutral gray
      header = screen.getByTestId("header")
      expect(header).toHaveStyle({ backgroundColor: "#374151" })
    })
  })

  // Note: Control bar has been moved to StatusBar (see rui-z4z)

  describe("instance count badge", () => {
    it("does not show badge when only one instance exists", async () => {
      render(<Header />)

      await waitFor(() => {
        expect(screen.getByText("my-project")).toBeInTheDocument()
      })

      expect(screen.queryByTestId("instance-count-badge")).not.toBeInTheDocument()
    })

    it("shows badge when multiple instances exist", async () => {
      // Add a second instance to the store
      act(() => {
        const store = useAppStore.getState()
        const instances = new Map(store.instances)
        instances.set("instance-2", createRalphInstance("instance-2", "Worktree 1"))
        useAppStore.setState({ instances })
      })

      render(<Header />)

      await waitFor(() => {
        expect(screen.getByText("my-project")).toBeInTheDocument()
      })

      const badge = screen.getByTestId("instance-count-badge")
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveTextContent("2")
    })

    it("shows correct count with three instances", async () => {
      // Add two more instances to the store
      act(() => {
        const store = useAppStore.getState()
        const instances = new Map(store.instances)
        instances.set("instance-2", createRalphInstance("instance-2", "Worktree 1"))
        instances.set("instance-3", createRalphInstance("instance-3", "Worktree 2"))
        useAppStore.setState({ instances })
      })

      render(<Header />)

      await waitFor(() => {
        expect(screen.getByText("my-project")).toBeInTheDocument()
      })

      const badge = screen.getByTestId("instance-count-badge")
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveTextContent("3")
    })
  })
})
