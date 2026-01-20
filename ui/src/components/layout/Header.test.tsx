import { render, screen, fireEvent, waitFor, act } from "@/test-utils"
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { Header } from "./Header"
import { useAppStore } from "@/store"

// Mock the useVSCodeTheme hook used by ThemePicker
vi.mock("@/hooks", async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>
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

  describe("theme toggle", () => {
    it("renders theme toggle button", async () => {
      render(<Header />)
      expect(screen.getByTestId("theme-toggle")).toBeInTheDocument()

      // Wait for workspace fetch to complete to avoid act() warning
      await waitFor(() => {
        expect(screen.getByText("my-project")).toBeInTheDocument()
      })
    })

    it("shows monitor icon for system theme", async () => {
      useAppStore.getState().setTheme("system")
      render(<Header />)

      const button = screen.getByTestId("theme-toggle")
      expect(button).toHaveAttribute("aria-label", "System theme")

      // Wait for workspace fetch to complete to avoid act() warning
      await waitFor(() => {
        expect(screen.getByText("my-project")).toBeInTheDocument()
      })
    })

    it("shows sun icon for light theme", async () => {
      // Set localStorage so useTheme initializes with light
      mockLocalStorage._setStore({ "ralph-ui-theme": "light" })
      render(<Header />)

      const button = screen.getByTestId("theme-toggle")
      expect(button).toHaveAttribute("aria-label", "Light theme")

      // Wait for workspace fetch to complete to avoid act() warning
      await waitFor(() => {
        expect(screen.getByText("my-project")).toBeInTheDocument()
      })
    })

    it("shows moon icon for dark theme", async () => {
      // Set localStorage so useTheme initializes with dark
      mockLocalStorage._setStore({ "ralph-ui-theme": "dark" })
      render(<Header />)

      const button = screen.getByTestId("theme-toggle")
      expect(button).toHaveAttribute("aria-label", "Dark theme")

      // Wait for workspace fetch to complete to avoid act() warning
      await waitFor(() => {
        expect(screen.getByText("my-project")).toBeInTheDocument()
      })
    })

    it("cycles theme when clicked: system -> light -> dark -> system", async () => {
      useAppStore.getState().setTheme("system")
      render(<Header />)

      // Wait for workspace fetch to complete to avoid act() warning
      await waitFor(() => {
        expect(screen.getByText("my-project")).toBeInTheDocument()
      })

      const button = screen.getByTestId("theme-toggle")

      // system -> light
      fireEvent.click(button)
      expect(useAppStore.getState().theme).toBe("light")

      // light -> dark
      fireEvent.click(button)
      expect(useAppStore.getState().theme).toBe("dark")

      // dark -> system
      fireEvent.click(button)
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
})
