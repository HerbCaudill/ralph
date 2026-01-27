import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useThemeCoordinator } from "./useThemeCoordinator"
import { useAppStore } from "@/store"

// Mock the theme library functions
vi.mock("@/lib/theme", () => ({
  loadTheme: vi.fn().mockResolvedValue("mock-theme-name"),
  applyThemeToElement: vi.fn(),
}))

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe("useThemeCoordinator", () => {
  let originalMatchMedia: typeof window.matchMedia

  beforeEach(() => {
    // Save originals
    originalMatchMedia = window.matchMedia

    // Mock matchMedia
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true, // Default to dark mode
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    // Reset fetch mock
    mockFetch.mockReset()

    // Default fetch response - empty themes
    mockFetch.mockImplementation((url: string) => {
      if (url === "/api/themes") {
        return Promise.resolve({
          json: () =>
            Promise.resolve({
              ok: true,
              themes: [],
              currentTheme: null,
              variant: "VS Code",
            }),
        })
      }
      return Promise.reject(new Error("Unknown URL"))
    })

    // Reset store
    useAppStore.getState().reset()
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    vi.restoreAllMocks()
  })

  describe("basic functionality", () => {
    it("combines useTheme and useVSCodeTheme return values", async () => {
      const { result } = renderHook(() => useThemeCoordinator())

      await waitFor(() => {
        expect(result.current.isLoadingList).toBe(false)
      })

      // Check useTheme properties
      expect(result.current.theme).toBeDefined()
      expect(result.current.resolvedTheme).toBeDefined()
      expect(result.current.setTheme).toBeDefined()
      expect(result.current.setMode).toBeDefined()
      expect(result.current.cycleTheme).toBeDefined()

      // Check useVSCodeTheme properties
      expect(result.current.themes).toBeDefined()
      expect(result.current.activeTheme).toBeDefined()
      expect(result.current.activeThemeId).toBeDefined()
      expect(result.current.applyTheme).toBeDefined()
      expect(result.current.fetchThemes).toBeDefined()
    })
  })

  describe("theme mode coordination", () => {
    it("switching to dark mode via setMode updates light/dark theme", async () => {
      const { result } = renderHook(() => useThemeCoordinator())

      await waitFor(() => {
        expect(result.current.isLoadingList).toBe(false)
      })

      // Switch to light mode first
      act(() => {
        result.current.setMode("light")
      })
      expect(result.current.theme).toBe("light")

      // Switch back to dark
      act(() => {
        result.current.setMode("dark")
      })
      expect(result.current.theme).toBe("dark")
    })

    it("setTheme works for system mode", async () => {
      const { result } = renderHook(() => useThemeCoordinator())

      await waitFor(() => {
        expect(result.current.isLoadingList).toBe(false)
      })

      // Set to dark first
      act(() => {
        result.current.setTheme("dark")
      })

      // Set to system
      act(() => {
        result.current.setTheme("system")
      })
      expect(result.current.theme).toBe("system")
    })
  })

  describe("last theme persistence", () => {
    it("saves theme ID to store when applying", async () => {
      // Setup mock themes and fetch response
      const mockDarkTheme = {
        id: "test.dark-theme",
        label: "Dark Theme",
        type: "dark" as const,
        path: "/path/to/dark.json",
        extensionId: "test",
        extensionName: "Test",
      }

      mockFetch.mockImplementation((url: string) => {
        if (url === "/api/themes") {
          return Promise.resolve({
            json: () =>
              Promise.resolve({
                ok: true,
                themes: [mockDarkTheme],
                currentTheme: null,
                variant: "VS Code",
              }),
          })
        }
        if (url.startsWith("/api/themes/")) {
          return Promise.resolve({
            json: () =>
              Promise.resolve({
                ok: true,
                theme: {
                  meta: mockDarkTheme,
                  statusColors: {
                    success: "#00ff00",
                    warning: "#ffff00",
                    error: "#ff0000",
                    info: "#0000ff",
                    neutral: "#808080",
                  },
                  vscodeTheme: {
                    name: "Dark Theme",
                    type: "dark",
                    colors: {},
                    tokenColors: [],
                  },
                  colors: {
                    background: "#1e1e1e",
                    foreground: "#d4d4d4",
                    accent: "#007acc",
                    muted: "#808080",
                    border: "#454545",
                    selection: "#264f78",
                  },
                },
                cssVariables: {
                  "--background": "#1e1e1e",
                  "--foreground": "#d4d4d4",
                },
              }),
          })
        }
        return Promise.reject(new Error("Unknown URL"))
      })

      const { result } = renderHook(() => useThemeCoordinator())

      await waitFor(() => {
        expect(result.current.themes).toHaveLength(1)
      })

      // Apply the dark theme
      await act(async () => {
        await result.current.applyTheme("test.dark-theme")
      })

      // Check that last dark theme was saved in store
      expect(useAppStore.getState().lastDarkThemeId).toBe("test.dark-theme")

      // Check that the light/dark mode was updated to dark
      expect(result.current.theme).toBe("dark")
    })
  })
})
