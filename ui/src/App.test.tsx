import { render, screen, waitFor, act } from "@/test-utils"
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { App } from "./App"
import { useAppStore } from "./store"

// Mock fetch for WorkspacePicker
const mockFetch = vi.fn()
;(globalThis as { fetch: typeof fetch }).fetch = mockFetch

// Mock the useVSCodeTheme hook used by ThemePicker (via Header)
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

  it("auto-focuses task input on mount", async () => {
    vi.useFakeTimers()
    render(<App />)

    // Fast-forward the timeout for auto-focus
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150)
    })

    // Task input should be focused
    const taskInput = screen.getByRole("textbox", { name: "New task title" })
    expect(document.activeElement).toBe(taskInput)

    vi.useRealTimers()
  })

  it("Tab key toggles focus between task input and chat input", async () => {
    // Set up connected state so chat input is enabled
    // (ChatInput is disabled when not connected or not running)
    useAppStore.getState().setConnectionStatus("connected")
    useAppStore.getState().setRalphStatus("running")

    render(<App />)

    // Wait for async operations
    await waitFor(() => {
      expect(screen.getAllByText("workspace").length).toBeGreaterThan(0)
    })

    const taskInput = screen.getByRole("textbox", { name: "New task title" })
    const chatInput = screen.getByRole("textbox", { name: "Message input" })

    // Focus task input first
    act(() => {
      taskInput.focus()
    })
    expect(document.activeElement).toBe(taskInput)

    // Press Tab - should switch to chat input
    // Fire keydown on window since useHotkeys listens on window with capture: true
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }))
    })
    expect(document.activeElement).toBe(chatInput)

    // Press Tab again - should switch back to task input
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }))
    })
    expect(document.activeElement).toBe(taskInput)
  })
})
