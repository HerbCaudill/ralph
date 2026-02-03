import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useTheme } from ".././useTheme"
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

  beforeEach(() => {
    // Save original implementations
    originalMatchMedia = window.matchMedia

    // Default matchMedia to dark
    window.matchMedia = mockMatchMedia(true)

    // Reset store state
    useAppStore.getState().reset()
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
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

    it("persists theme to store", () => {
      const { result } = renderHook(() => useTheme())

      act(() => {
        result.current.setTheme("dark")
      })

      expect(useAppStore.getState().theme).toBe("dark")
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

  describe("store initialization", () => {
    it("uses theme from store", () => {
      useAppStore.getState().setTheme("dark")

      const { result } = renderHook(() => useTheme())

      expect(result.current.theme).toBe("dark")
    })
  })

  describe("setMode", () => {
    it("sets theme to light mode", () => {
      const { result } = renderHook(() => useTheme())

      act(() => {
        result.current.setMode("light")
      })

      expect(result.current.theme).toBe("light")
      expect(result.current.resolvedTheme).toBe("light")
    })

    it("sets theme to dark mode", () => {
      const { result } = renderHook(() => useTheme())

      act(() => {
        result.current.setMode("dark")
      })

      expect(result.current.theme).toBe("dark")
      expect(result.current.resolvedTheme).toBe("dark")
    })

    it("calls onModeSwitch callback when provided", () => {
      const onModeSwitch = vi.fn()
      const { result } = renderHook(() => useTheme(onModeSwitch))

      act(() => {
        result.current.setMode("light")
      })

      expect(onModeSwitch).toHaveBeenCalledWith("light")
    })

    it("persists mode to store", () => {
      const { result } = renderHook(() => useTheme())

      act(() => {
        result.current.setMode("light")
      })

      expect(useAppStore.getState().theme).toBe("light")
    })
  })

  describe("cycleTheme with callback", () => {
    it("calls onModeSwitch callback when cycling to light or dark", () => {
      const onModeSwitch = vi.fn()
      const { result } = renderHook(() => useTheme(onModeSwitch))

      // Cycle from system to light
      act(() => {
        result.current.cycleTheme()
      })
      expect(onModeSwitch).toHaveBeenCalledWith("light")

      // Cycle from light to dark
      act(() => {
        result.current.cycleTheme()
      })
      expect(onModeSwitch).toHaveBeenCalledWith("dark")
    })

    it("does not call onModeSwitch when cycling to system", () => {
      const onModeSwitch = vi.fn()
      const { result } = renderHook(() => useTheme(onModeSwitch))

      // Set to dark first
      act(() => {
        result.current.setTheme("dark")
      })
      onModeSwitch.mockClear()

      // Cycle from dark to system
      act(() => {
        result.current.cycleTheme()
      })
      expect(onModeSwitch).not.toHaveBeenCalled()
      expect(result.current.theme).toBe("system")
    })
  })
})
