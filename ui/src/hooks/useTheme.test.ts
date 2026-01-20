import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useTheme, getStoredTheme } from "./useTheme"
import { useAppStore } from "@/store"

// Mock matchMedia
const mockMatchMedia = (matches: boolean) => {
  const listeners: Array<(e: MediaQueryListEvent) => void> = []

  return vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: (_: string, listener: (e: MediaQueryListEvent) => void) => {
      listeners.push(listener)
    },
    removeEventListener: (_: string, listener: (e: MediaQueryListEvent) => void) => {
      const index = listeners.indexOf(listener)
      if (index > -1) listeners.splice(index, 1)
    },
    dispatchEvent: vi.fn(),
    // Utility to trigger change
    _trigger: (newMatches: boolean) => {
      listeners.forEach(listener => listener({ matches: newMatches } as MediaQueryListEvent))
    },
    _listeners: listeners,
  }))
}

describe("useTheme", () => {
  let originalMatchMedia: typeof window.matchMedia
  let originalLocalStorage: Storage

  beforeEach(() => {
    // Save original implementations
    originalMatchMedia = window.matchMedia
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

    // Default matchMedia to dark
    window.matchMedia = mockMatchMedia(true)

    // Reset store state
    useAppStore.getState().reset()
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    Object.defineProperty(window, "localStorage", {
      value: originalLocalStorage,
      writable: true,
    })
    vi.restoreAllMocks()
  })

  describe("initial state", () => {
    it("defaults to system theme", () => {
      const { result } = renderHook(() => useTheme())
      expect(result.current.theme).toBe("system")
    })

    it("resolves to dark when system prefers dark", () => {
      window.matchMedia = mockMatchMedia(true)
      const { result } = renderHook(() => useTheme())
      expect(result.current.resolvedTheme).toBe("dark")
    })

    it("resolves to light when system prefers light", () => {
      window.matchMedia = mockMatchMedia(false)
      const { result } = renderHook(() => useTheme())
      expect(result.current.resolvedTheme).toBe("light")
    })
  })

  describe("setTheme", () => {
    it("changes theme to light", () => {
      const { result } = renderHook(() => useTheme())

      act(() => {
        result.current.setTheme("light")
      })

      expect(result.current.theme).toBe("light")
      expect(result.current.resolvedTheme).toBe("light")
    })

    it("changes theme to dark", () => {
      const { result } = renderHook(() => useTheme())

      act(() => {
        result.current.setTheme("dark")
      })

      expect(result.current.theme).toBe("dark")
      expect(result.current.resolvedTheme).toBe("dark")
    })

    it("changes theme back to system", () => {
      window.matchMedia = mockMatchMedia(false) // light system preference

      const { result } = renderHook(() => useTheme())

      act(() => {
        result.current.setTheme("dark")
      })
      expect(result.current.resolvedTheme).toBe("dark")

      act(() => {
        result.current.setTheme("system")
      })
      expect(result.current.theme).toBe("system")
      expect(result.current.resolvedTheme).toBe("light")
    })

    it("persists theme to localStorage", () => {
      const { result } = renderHook(() => useTheme())

      act(() => {
        result.current.setTheme("dark")
      })

      expect(window.localStorage.setItem).toHaveBeenCalledWith("ralph-ui-theme", "dark")
    })
  })

  describe("cycleTheme", () => {
    it("cycles from system to light", () => {
      const { result } = renderHook(() => useTheme())
      expect(result.current.theme).toBe("system")

      act(() => {
        result.current.cycleTheme()
      })

      expect(result.current.theme).toBe("light")
    })

    it("cycles from light to dark", () => {
      const { result } = renderHook(() => useTheme())

      act(() => {
        result.current.setTheme("light")
      })

      act(() => {
        result.current.cycleTheme()
      })

      expect(result.current.theme).toBe("dark")
    })

    it("cycles from dark to system", () => {
      const { result } = renderHook(() => useTheme())

      act(() => {
        result.current.setTheme("dark")
      })

      act(() => {
        result.current.cycleTheme()
      })

      expect(result.current.theme).toBe("system")
    })
  })

  describe("DOM class application", () => {
    beforeEach(() => {
      // Ensure clean DOM state
      document.documentElement.classList.remove("dark")
    })

    it("adds dark class when resolved theme is dark", () => {
      useAppStore.getState().setTheme("dark")
      renderHook(() => useTheme())

      expect(document.documentElement.classList.contains("dark")).toBe(true)
    })

    it("removes dark class when resolved theme is light", () => {
      document.documentElement.classList.add("dark")
      // Set localStorage so initialization doesn't overwrite the theme
      ;(window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue("light")
      useAppStore.getState().setTheme("light")

      renderHook(() => useTheme())

      expect(document.documentElement.classList.contains("dark")).toBe(false)
    })

    it("applies system preference dark when theme is system", () => {
      window.matchMedia = mockMatchMedia(true) // dark system preference
      useAppStore.getState().setTheme("system")

      renderHook(() => useTheme())

      expect(document.documentElement.classList.contains("dark")).toBe(true)
    })

    it("applies system preference light when theme is system", () => {
      document.documentElement.classList.add("dark")
      window.matchMedia = mockMatchMedia(false) // light system preference
      useAppStore.getState().setTheme("system")

      renderHook(() => useTheme())

      expect(document.documentElement.classList.contains("dark")).toBe(false)
    })
  })

  describe("getStoredTheme", () => {
    it("returns system when no theme is stored", () => {
      expect(getStoredTheme()).toBe("system")
    })

    it("returns stored theme value", () => {
      ;(window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue("dark")
      expect(getStoredTheme()).toBe("dark")
    })

    it("returns system for invalid stored value", () => {
      ;(window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue("invalid")
      expect(getStoredTheme()).toBe("system")
    })
  })

  describe("localStorage initialization", () => {
    it("initializes theme from localStorage on mount", () => {
      ;(window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue("dark")

      renderHook(() => useTheme())

      expect(useAppStore.getState().theme).toBe("dark")
    })
  })
})
