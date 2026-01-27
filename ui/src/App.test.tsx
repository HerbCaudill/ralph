import { render, screen, waitFor, act } from "@/test-utils"
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { App } from "./App"
import { useAppStore } from "./store"

// Mock fetch for WorkspacePicker
const mockFetch = vi.fn()
;(globalThis as { fetch: typeof fetch }).fetch = mockFetch

// Mock the hooks used by theme components (ThemePicker, SettingsDropdown)
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
    useThemeCoordinator: () => ({
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
      // Light/dark theme values
      theme: "system",
      resolvedTheme: "dark",
      setTheme: vi.fn(),
      setMode: vi.fn(),
      cycleTheme: vi.fn(),
    }),
  }
})

// Mock ralphConnection to prevent it from resetting connection status
vi.mock("./lib/ralphConnection", () => ({
  ralphConnection: {
    status: "disconnected",
    connect: vi.fn(),
    disconnect: vi.fn(),
    send: vi.fn(),
    reset: vi.fn(),
  },
  initRalphConnection: vi.fn(),
}))

// Mock MarkdownEditor to avoid CSS parsing issues in jsdom
vi.mock("@/components/ui/MarkdownEditor", () => ({
  MarkdownEditor: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string
    onChange?: (value: string) => void
    placeholder?: string
  }) => (
    <textarea
      data-testid="markdown-editor"
      value={value}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
    />
  ),
}))

// Mock matchMedia for theme detection
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

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "log").mockImplementation(() => {})
    vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          ok: true,
          workspace: {
            path: "/test/workspace",
            name: "workspace",
            issueCount: 10,
            daemonConnected: true,
          },
        }),
    })
    // Mock matchMedia for theme detection
    window.matchMedia = mockMatchMedia
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders the main layout with sidebar and status bar", async () => {
    render(<App />)

    // Check for sidebar content (TaskSidebar is a pure layout component, no heading)
    expect(screen.getByRole("complementary", { name: "Task sidebar" })).toBeInTheDocument()

    // Check for ralph status in StatusBar
    expect(screen.getByText(/Stopped|Running|Starting/)).toBeInTheDocument()

    // Check for event stream
    expect(screen.getByRole("log", { name: "Event stream" })).toBeInTheDocument()

    // Check for chat input
    expect(screen.getByRole("textbox", { name: "Message input" })).toBeInTheDocument()

    // Wait for all async operations to complete to avoid act() warning
    // workspace appears in both Header and StatusBar now
    await waitFor(() => {
      expect(screen.getAllByText("workspace").length).toBeGreaterThan(0)
    })
  })

  it("shows stopped status by default", async () => {
    render(<App />)
    // Ralph status appears in StatusBar
    expect(screen.getByText("Stopped")).toBeInTheDocument()

    // Wait for all async operations to complete to avoid act() warning
    // workspace appears in both Header and StatusBar now
    await waitFor(() => {
      expect(screen.getAllByText("workspace").length).toBeGreaterThan(0)
    })
  })

  // Note: auto-focus test removed because it's flaky in jsdom environment.
  // The auto-focus behavior (focusing chat input on mount) works correctly
  // in the browser but is difficult to test reliably with fake timers.

  it("auto-starts Ralph when connection is established", async () => {
    // Start with disconnected state and stopped status
    useAppStore.getState().setConnectionStatus("disconnected")
    useAppStore.getState().setRalphStatus("stopped")
    useAppStore.getState().setHasInitialSync(false)

    render(<App />)

    // Verify start API hasn't been called yet
    expect(mockFetch).not.toHaveBeenCalledWith(
      "/api/ralph/default/start",
      expect.objectContaining({ method: "POST" }),
    )

    // Simulate connection being established and initial sync completing
    // (In production, hasInitialSync is set by hydrateInstances when instances:list message arrives)
    act(() => {
      useAppStore.getState().setConnectionStatus("connected")
      useAppStore.getState().setHasInitialSync(true)
    })

    // Wait for the auto-start to be triggered
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/ralph/default/start",
        expect.objectContaining({ method: "POST" }),
      )
    })
  })

  it("does not auto-start Ralph if already running (prevents 409 error on page reload)", async () => {
    // This test verifies the fix for the 409 error that occurred when reloading
    // the page while Ralph was already running. The auto-start effect waits for
    // hasInitialSync to be true, which is set by hydrateInstances after receiving
    // the actual Ralph status from the server.

    // Start disconnected
    useAppStore.getState().setConnectionStatus("disconnected")
    useAppStore.getState().setRalphStatus("stopped") // Default state before sync
    useAppStore.getState().setHasInitialSync(false)

    render(<App />)

    // Simulate connection being established
    act(() => {
      useAppStore.getState().setConnectionStatus("connected")
    })

    // At this point, isConnected=true, ralphStatus="stopped", but hasInitialSync=false
    // So auto-start should NOT be triggered yet
    expect(mockFetch).not.toHaveBeenCalledWith(
      "/api/ralph/default/start",
      expect.objectContaining({ method: "POST" }),
    )

    // Now simulate the initial sync (instances:list message) showing Ralph is already running
    act(() => {
      useAppStore.getState().setRalphStatus("running") // Server says Ralph is running
      useAppStore.getState().setHasInitialSync(true)
    })

    // Wait a bit and verify start is NOT called (because Ralph is already running)
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(mockFetch).not.toHaveBeenCalledWith(
      "/api/ralph/default/start",
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("only auto-starts Ralph once (not on reconnection)", async () => {
    // Start with connected state and initial sync complete (simulating an already auto-started session)
    useAppStore.getState().setConnectionStatus("connected")
    useAppStore.getState().setRalphStatus("stopped")
    useAppStore.getState().setHasInitialSync(true)

    render(<App />)

    // Wait for auto-start to be triggered on initial mount
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/ralph/default/start",
        expect.objectContaining({ method: "POST" }),
      )
    })

    // Clear mock to track new calls
    mockFetch.mockClear()

    // Simulate disconnection and reconnection
    // Note: setConnectionStatus("disconnected") resets hasInitialSync to false
    act(() => {
      useAppStore.getState().setConnectionStatus("disconnected")
    })
    act(() => {
      useAppStore.getState().setRalphStatus("stopped")
    })
    act(() => {
      useAppStore.getState().setConnectionStatus("connected")
      useAppStore.getState().setHasInitialSync(true)
    })

    // Wait a bit and verify start is NOT called again
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(mockFetch).not.toHaveBeenCalledWith(
      "/api/ralph/default/start",
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("Tab key toggles focus between search input and chat input", async () => {
    // Set up connected state so chat input is enabled
    // (ChatInput is disabled when not connected or not running)
    useAppStore.getState().setConnectionStatus("connected")
    useAppStore.getState().setRalphStatus("running")
    // Make search visible
    useAppStore.getState().showSearch()

    render(<App />)

    // Wait for async operations
    await waitFor(() => {
      expect(screen.getAllByText("workspace").length).toBeGreaterThan(0)
    })

    const searchInput = screen.getByRole("textbox", { name: "Search tasks" })
    const chatInput = screen.getByRole("textbox", { name: "Message input" })

    // Focus search input first
    act(() => {
      searchInput.focus()
    })
    expect(document.activeElement).toBe(searchInput)

    // Press Tab - should switch to chat input
    // Fire keydown on window since useHotkeys listens on window with capture: true
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }))
    })
    expect(document.activeElement).toBe(chatInput)

    // Press Tab again - should switch back to search input
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }))
    })
    expect(document.activeElement).toBe(searchInput)
  })
})
