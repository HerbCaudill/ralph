import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useThemes } from "../useThemes"

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe("useThemes", () => {
  const mockThemes = [
    {
      id: "vscode.theme-defaults/Dark+",
      label: "Dark+",
      type: "dark" as const,
      path: "/path/to/dark.json",
      extensionId: "vscode.theme-defaults",
      extensionName: "Default themes",
    },
    {
      id: "gruvbox.gruvbox/Gruvbox Dark Medium",
      label: "Gruvbox Dark Medium",
      type: "dark" as const,
      path: "/path/to/gruvbox.json",
      extensionId: "gruvbox.gruvbox",
      extensionName: "Gruvbox",
    },
    {
      id: "vscode.theme-defaults/Light+",
      label: "Light+",
      type: "light" as const,
      path: "/path/to/light.json",
      extensionId: "vscode.theme-defaults",
      extensionName: "Default themes",
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ themes: mockThemes, variant: "VS Code" }),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("initialization", () => {
    it("fetches themes on mount", async () => {
      const { result } = renderHook(() => useThemes())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockFetch).toHaveBeenCalledWith("/api/themes")
    })

    it("sets isLoading while fetching", async () => {
      let resolvePromise: (value: unknown) => void
      const controlledPromise = new Promise(resolve => {
        resolvePromise = resolve
      })

      mockFetch.mockReturnValue({
        ok: true,
        json: () => controlledPromise,
      })

      const { result } = renderHook(() => useThemes())

      expect(result.current.isLoading).toBe(true)

      await act(async () => {
        resolvePromise!({ themes: mockThemes, variant: "VS Code" })
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    it("handles network errors", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"))

      const { result } = renderHook(() => useThemes())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBe("Network error")
      expect(result.current.themes).toEqual([])
    })

    it("handles non-ok response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      })

      const { result } = renderHook(() => useThemes())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBe("Failed to fetch themes")
      expect(result.current.themes).toEqual([])
    })
  })

  describe("theme data", () => {
    it("returns fetched themes", async () => {
      const { result } = renderHook(() => useThemes())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.themes).toEqual(mockThemes)
    })

    it("returns variant name", async () => {
      const { result } = renderHook(() => useThemes())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.variant).toBe("VS Code")
    })

    it("handles empty themes response", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ themes: [], variant: null }),
      })

      const { result } = renderHook(() => useThemes())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.themes).toEqual([])
      expect(result.current.variant).toBeNull()
    })
  })

  describe("refresh", () => {
    it("refetches themes when refresh is called", async () => {
      const { result } = renderHook(() => useThemes())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      mockFetch.mockClear()
      const newThemes = [...mockThemes, {
        id: "new.theme/New Theme",
        label: "New Theme",
        type: "dark" as const,
        path: "/path/to/new.json",
        extensionId: "new.theme",
        extensionName: "New Theme Extension",
      }]

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ themes: newThemes, variant: "VS Code" }),
      })

      await act(async () => {
        await result.current.refresh()
      })

      expect(mockFetch).toHaveBeenCalledWith("/api/themes")
      expect(result.current.themes).toHaveLength(4)
    })

    it("clears error on successful refresh", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Initial error"))

      const { result } = renderHook(() => useThemes())

      await waitFor(() => {
        expect(result.current.error).toBe("Initial error")
      })

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ themes: mockThemes, variant: "VS Code" }),
      })

      await act(async () => {
        await result.current.refresh()
      })

      expect(result.current.error).toBeNull()
    })
  })

  describe("memoization", () => {
    it("returns stable themes array reference when data does not change", async () => {
      const { result, rerender } = renderHook(() => useThemes())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const firstThemes = result.current.themes

      rerender()

      expect(result.current.themes).toBe(firstThemes)
    })

    it("returns stable refresh function reference", async () => {
      const { result, rerender } = renderHook(() => useThemes())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const firstRefresh = result.current.refresh

      rerender()

      expect(result.current.refresh).toBe(firstRefresh)
    })
  })
})
