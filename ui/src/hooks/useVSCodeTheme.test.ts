import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useVSCodeTheme } from "./useVSCodeTheme"
import type { ThemeMeta, AppTheme } from "@/lib/theme"

// Mock the theme library functions
vi.mock("@/lib/theme", () => ({
  loadTheme: vi.fn().mockResolvedValue("mock-theme-name"),
  applyThemeToElement: vi.fn(),
}))

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Test data
const mockThemes: ThemeMeta[] = [
  {
    id: "test.theme/Dark Theme",
    label: "Dark Theme",
    type: "dark",
    path: "/path/to/dark.json",
    extensionId: "test.theme",
    extensionName: "Test Theme Extension",
  },
  {
    id: "test.theme/Light Theme",
    label: "Light Theme",
    type: "light",
    path: "/path/to/light.json",
    extensionId: "test.theme",
    extensionName: "Test Theme Extension",
  },
]

const mockAppTheme: AppTheme = {
  meta: mockThemes[0],
  statusColors: {
    success: "#4ec9b0",
    warning: "#dcdcaa",
    error: "#f44747",
    info: "#569cd6",
    neutral: "#808080",
  },
  vscodeTheme: {
    name: "Dark Theme",
    type: "dark",
    colors: {
      "editor.background": "#1e1e1e",
      "editor.foreground": "#d4d4d4",
    },
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
}

const mockCSSVariables = {
  "--background": "#1e1e1e",
  "--foreground": "#d4d4d4",
  "--card": "#252526",
  "--card-foreground": "#d4d4d4",
  "--popover": "#252526",
  "--popover-foreground": "#d4d4d4",
  "--primary": "#007acc",
  "--primary-foreground": "#ffffff",
  "--secondary": "#3c3c3c",
  "--secondary-foreground": "#d4d4d4",
  "--muted": "#3c3c3c",
  "--muted-foreground": "#808080",
  "--accent": "#264f78",
  "--accent-foreground": "#ffffff",
  "--destructive": "#f14c4c",
  "--border": "#454545",
  "--input": "#3c3c3c",
  "--ring": "#007acc",
  "--sidebar": "#252526",
  "--sidebar-foreground": "#d4d4d4",
  "--sidebar-primary": "#007acc",
  "--sidebar-primary-foreground": "#ffffff",
  "--sidebar-accent": "#37373d",
  "--sidebar-accent-foreground": "#d4d4d4",
  "--sidebar-border": "#454545",
  "--sidebar-ring": "#007acc",
  "--status-success": "#4ec9b0",
  "--status-warning": "#dcdcaa",
  "--status-error": "#f44747",
  "--status-info": "#569cd6",
  "--status-neutral": "#808080",
}

describe("useVSCodeTheme", () => {
  let originalLocalStorage: Storage

  beforeEach(() => {
    // Save original localStorage
    originalLocalStorage = window.localStorage

    // Mock localStorage
    const store: Record<string, string> = {}
    const mockLocalStorage = {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key]
      }),
      clear: vi.fn(() => Object.keys(store).forEach(key => delete store[key])),
      key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
      length: 0,
    }
    Object.defineProperty(window, "localStorage", {
      value: mockLocalStorage,
      writable: true,
    })

    // Reset fetch mock
    mockFetch.mockReset()

    // Default fetch responses
    mockFetch.mockImplementation((url: string) => {
      if (url === "/api/themes") {
        return Promise.resolve({
          json: () =>
            Promise.resolve({
              ok: true,
              themes: mockThemes,
              currentTheme: "Dark Theme",
              variant: "VS Code",
            }),
        })
      }
      if (url.startsWith("/api/themes/")) {
        return Promise.resolve({
          json: () =>
            Promise.resolve({
              ok: true,
              theme: mockAppTheme,
              cssVariables: mockCSSVariables,
            }),
        })
      }
      return Promise.reject(new Error("Unknown URL"))
    })

    // Clear any existing style properties
    const style = document.documentElement.style
    Object.keys(mockCSSVariables).forEach(key => {
      style.removeProperty(key)
    })
  })

  afterEach(() => {
    Object.defineProperty(window, "localStorage", {
      value: originalLocalStorage,
      writable: true,
    })
    vi.restoreAllMocks()
  })

  describe("initial state", () => {
    it("starts with empty themes array", () => {
      // Prevent auto-initialization
      mockFetch.mockResolvedValue({ json: () => Promise.resolve({ ok: true, themes: [] }) })

      const { result } = renderHook(() => useVSCodeTheme())

      expect(result.current.themes).toEqual([])
      expect(result.current.activeTheme).toBeNull()
      expect(result.current.activeThemeId).toBeNull()
    })

    it("starts with loading state false", () => {
      const { result } = renderHook(() => useVSCodeTheme())

      // Note: isLoadingList may be true initially due to auto-fetch
      expect(result.current.isLoadingTheme).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  describe("fetchThemes", () => {
    it("fetches themes from API on mount", async () => {
      const { result } = renderHook(() => useVSCodeTheme())

      await waitFor(() => {
        expect(result.current.themes).toHaveLength(2)
      })

      expect(mockFetch).toHaveBeenCalledWith("/api/themes")
      expect(result.current.currentVSCodeTheme).toBe("Dark Theme")
      expect(result.current.variant).toBe("VS Code")
    })

    it("sets error on fetch failure", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url === "/api/themes") {
          return Promise.resolve({
            json: () => Promise.resolve({ ok: false, error: "Network error" }),
          })
        }
        return Promise.reject(new Error("Unknown URL"))
      })

      const { result } = renderHook(() => useVSCodeTheme())

      await waitFor(() => {
        expect(result.current.error).toBe("Network error")
      })
    })

    it("can manually refetch themes", async () => {
      const { result } = renderHook(() => useVSCodeTheme())

      await waitFor(() => {
        expect(result.current.themes).toHaveLength(2)
      })

      // Clear and refetch
      mockFetch.mockClear()

      await act(async () => {
        await result.current.fetchThemes()
      })

      expect(mockFetch).toHaveBeenCalledWith("/api/themes")
    })
  })

  describe("applyTheme", () => {
    it("applies a theme by ID", async () => {
      const { result } = renderHook(() => useVSCodeTheme())

      await waitFor(() => {
        expect(result.current.themes).toHaveLength(2)
      })

      await act(async () => {
        await result.current.applyTheme("test.theme/Dark Theme")
      })

      expect(result.current.activeThemeId).toBe("test.theme/Dark Theme")
      expect(result.current.activeTheme).not.toBeNull()
    })

    it("applies CSS variables to document root", async () => {
      const { result } = renderHook(() => useVSCodeTheme())

      await waitFor(() => {
        expect(result.current.themes).toHaveLength(2)
      })

      await act(async () => {
        await result.current.applyTheme("test.theme/Dark Theme")
      })

      const style = document.documentElement.style
      expect(style.getPropertyValue("--background")).toBe("#1e1e1e")
      expect(style.getPropertyValue("--foreground")).toBe("#d4d4d4")
    })

    it("persists theme ID to localStorage", async () => {
      const { result } = renderHook(() => useVSCodeTheme())

      await waitFor(() => {
        expect(result.current.themes).toHaveLength(2)
      })

      await act(async () => {
        await result.current.applyTheme("test.theme/Dark Theme")
      })

      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        "ralph-ui-vscode-theme",
        "test.theme/Dark Theme",
      )
    })

    it("sets error on theme fetch failure", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url === "/api/themes") {
          return Promise.resolve({
            json: () =>
              Promise.resolve({
                ok: true,
                themes: mockThemes,
                currentTheme: null,
                variant: "VS Code",
              }),
          })
        }
        if (url.startsWith("/api/themes/")) {
          return Promise.resolve({
            json: () => Promise.resolve({ ok: false, error: "Theme not found" }),
          })
        }
        return Promise.reject(new Error("Unknown URL"))
      })

      const { result } = renderHook(() => useVSCodeTheme())

      await waitFor(() => {
        expect(result.current.themes).toHaveLength(2)
      })

      await act(async () => {
        await result.current.applyTheme("test.theme/NonExistent")
      })

      expect(result.current.error).toBe("Theme not found")
    })
  })

  describe("previewTheme", () => {
    it("temporarily applies theme CSS without saving", async () => {
      const { result } = renderHook(() => useVSCodeTheme())

      await waitFor(() => {
        expect(result.current.themes).toHaveLength(2)
      })

      // Apply a theme first
      await act(async () => {
        await result.current.applyTheme("test.theme/Dark Theme")
      })

      // Preview a different theme
      await act(async () => {
        await result.current.previewTheme("test.theme/Light Theme")
      })

      // Active theme should still be the original
      expect(result.current.activeThemeId).toBe("test.theme/Dark Theme")
    })

    it("does not save preview theme to localStorage", async () => {
      const { result } = renderHook(() => useVSCodeTheme())

      await waitFor(() => {
        expect(result.current.themes).toHaveLength(2)
      })

      // Apply a theme first
      await act(async () => {
        await result.current.applyTheme("test.theme/Dark Theme")
      })

      // Clear localStorage mock calls
      vi.mocked(window.localStorage.setItem).mockClear()

      // Preview a different theme
      await act(async () => {
        await result.current.previewTheme("test.theme/Light Theme")
      })

      // localStorage should not have been called for the preview
      expect(window.localStorage.setItem).not.toHaveBeenCalledWith(
        "ralph-ui-vscode-theme",
        "test.theme/Light Theme",
      )
    })
  })

  describe("clearPreview", () => {
    it("restores original CSS after preview", async () => {
      const { result } = renderHook(() => useVSCodeTheme())

      await waitFor(() => {
        expect(result.current.themes).toHaveLength(2)
      })

      // Apply a theme first
      await act(async () => {
        await result.current.applyTheme("test.theme/Dark Theme")
      })

      const originalBackground = document.documentElement.style.getPropertyValue("--background")

      // Preview (which may apply different CSS)
      await act(async () => {
        await result.current.previewTheme("test.theme/Light Theme")
      })

      // Clear preview
      act(() => {
        result.current.clearPreview()
      })

      // CSS should be restored
      expect(document.documentElement.style.getPropertyValue("--background")).toBe(
        originalBackground,
      )
    })
  })

  describe("resetToDefault", () => {
    it("clears active theme", async () => {
      const { result } = renderHook(() => useVSCodeTheme())

      await waitFor(() => {
        expect(result.current.themes).toHaveLength(2)
      })

      // Apply a theme first
      await act(async () => {
        await result.current.applyTheme("test.theme/Dark Theme")
      })

      expect(result.current.activeThemeId).not.toBeNull()

      // Reset to default
      act(() => {
        result.current.resetToDefault()
      })

      expect(result.current.activeTheme).toBeNull()
      expect(result.current.activeThemeId).toBeNull()
    })

    it("removes theme from localStorage", async () => {
      const { result } = renderHook(() => useVSCodeTheme())

      await waitFor(() => {
        expect(result.current.themes).toHaveLength(2)
      })

      // Apply a theme first
      await act(async () => {
        await result.current.applyTheme("test.theme/Dark Theme")
      })

      // Reset to default
      act(() => {
        result.current.resetToDefault()
      })

      expect(window.localStorage.removeItem).toHaveBeenCalledWith("ralph-ui-vscode-theme")
    })

    it("clears custom CSS variables", async () => {
      const { result } = renderHook(() => useVSCodeTheme())

      await waitFor(() => {
        expect(result.current.themes).toHaveLength(2)
      })

      // Apply a theme first
      await act(async () => {
        await result.current.applyTheme("test.theme/Dark Theme")
      })

      // Verify CSS was applied
      expect(document.documentElement.style.getPropertyValue("--background")).toBe("#1e1e1e")

      // Reset to default
      act(() => {
        result.current.resetToDefault()
      })

      // CSS variables should be cleared
      expect(document.documentElement.style.getPropertyValue("--background")).toBe("")
    })
  })

  describe("auto-apply current VS Code theme", () => {
    it("applies stored theme from localStorage on mount", async () => {
      // Set up localStorage with a stored theme
      ;(window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        "test.theme/Dark Theme",
      )

      const { result } = renderHook(() => useVSCodeTheme())

      await waitFor(() => {
        expect(result.current.activeThemeId).toBe("test.theme/Dark Theme")
      })
    })

    it("applies current VS Code theme when no stored theme exists", async () => {
      // No stored theme
      ;(window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null)

      // Mock API to return current VS Code theme
      mockFetch.mockImplementation((url: string) => {
        if (url === "/api/themes") {
          return Promise.resolve({
            json: () =>
              Promise.resolve({
                ok: true,
                themes: mockThemes,
                currentTheme: "Dark Theme", // VS Code's current theme
                variant: "VS Code",
              }),
          })
        }
        if (url.startsWith("/api/themes/")) {
          return Promise.resolve({
            json: () =>
              Promise.resolve({
                ok: true,
                theme: mockAppTheme,
                cssVariables: mockCSSVariables,
              }),
          })
        }
        return Promise.reject(new Error("Unknown URL"))
      })

      const { result } = renderHook(() => useVSCodeTheme())

      await waitFor(() => {
        expect(result.current.activeThemeId).toBe("test.theme/Dark Theme")
      })
    })
  })

  describe("loading states", () => {
    it("sets isLoadingList during theme list fetch", async () => {
      let resolvePromise: (value: unknown) => void
      mockFetch.mockImplementation((url: string) => {
        if (url === "/api/themes") {
          return new Promise(resolve => {
            resolvePromise = resolve
          })
        }
        return Promise.reject(new Error("Unknown URL"))
      })

      const { result } = renderHook(() => useVSCodeTheme())

      // Should be loading initially
      expect(result.current.isLoadingList).toBe(true)

      // Resolve the fetch
      await act(async () => {
        resolvePromise!({
          json: () =>
            Promise.resolve({
              ok: true,
              themes: mockThemes,
              currentTheme: null,
              variant: "VS Code",
            }),
        })
      })

      await waitFor(() => {
        expect(result.current.isLoadingList).toBe(false)
      })
    })

    it("sets isLoadingTheme during theme application", async () => {
      let resolveThemePromise: (value: unknown) => void

      mockFetch.mockImplementation((url: string) => {
        if (url === "/api/themes") {
          return Promise.resolve({
            json: () =>
              Promise.resolve({
                ok: true,
                themes: mockThemes,
                currentTheme: null,
                variant: "VS Code",
              }),
          })
        }
        if (url.startsWith("/api/themes/")) {
          return new Promise(resolve => {
            resolveThemePromise = resolve
          })
        }
        return Promise.reject(new Error("Unknown URL"))
      })

      const { result } = renderHook(() => useVSCodeTheme())

      await waitFor(() => {
        expect(result.current.themes).toHaveLength(2)
      })

      // Start applying theme
      let applyPromise: Promise<void>
      act(() => {
        applyPromise = result.current.applyTheme("test.theme/Dark Theme")
      })

      // Should be loading
      expect(result.current.isLoadingTheme).toBe(true)

      // Resolve the theme fetch
      await act(async () => {
        resolveThemePromise!({
          json: () =>
            Promise.resolve({
              ok: true,
              theme: mockAppTheme,
              cssVariables: mockCSSVariables,
            }),
        })
        await applyPromise
      })

      expect(result.current.isLoadingTheme).toBe(false)
    })
  })
})
