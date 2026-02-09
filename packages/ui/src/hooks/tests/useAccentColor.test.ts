import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useAccentColor } from "../useAccentColor"
import { DEFAULT_ACCENT_COLOR } from "@/constants"

describe("useAccentColor", () => {
  beforeEach(() => {
    // Clean up any existing CSS variables
    document.documentElement.style.removeProperty("--repo-accent")
    document.documentElement.style.removeProperty("--repo-accent-foreground")
  })

  afterEach(() => {
    // Clean up after each test
    document.documentElement.style.removeProperty("--repo-accent")
    document.documentElement.style.removeProperty("--repo-accent-foreground")
  })

  describe("CSS variable injection", () => {
    it("sets --repo-accent to the provided color", () => {
      renderHook(() => useAccentColor("#ff5500"))

      const accentColor = document.documentElement.style.getPropertyValue("--repo-accent")
      expect(accentColor).toBe("#ff5500")
    })

    it("sets --repo-accent-foreground for contrast", () => {
      renderHook(() => useAccentColor("#ff5500"))

      const foregroundColor = document.documentElement.style.getPropertyValue(
        "--repo-accent-foreground",
      )
      // Dark color background should get white foreground
      expect(foregroundColor).toBe("#ffffff")
    })

    it("uses white foreground for dark accent colors", () => {
      renderHook(() => useAccentColor("#1a1a1a"))

      const foregroundColor = document.documentElement.style.getPropertyValue(
        "--repo-accent-foreground",
      )
      expect(foregroundColor).toBe("#ffffff")
    })

    it("uses black foreground for light accent colors", () => {
      renderHook(() => useAccentColor("#ffff00"))

      const foregroundColor = document.documentElement.style.getPropertyValue(
        "--repo-accent-foreground",
      )
      expect(foregroundColor).toBe("#000000")
    })
  })

  describe("default color", () => {
    it("uses default accent color when null is provided", () => {
      renderHook(() => useAccentColor(null))

      const accentColor = document.documentElement.style.getPropertyValue("--repo-accent")
      expect(accentColor).toBe(DEFAULT_ACCENT_COLOR)
    })

    it("uses default accent color when undefined is provided", () => {
      renderHook(() => useAccentColor(undefined))

      const accentColor = document.documentElement.style.getPropertyValue("--repo-accent")
      expect(accentColor).toBe(DEFAULT_ACCENT_COLOR)
    })
  })

  describe("color updates", () => {
    it("updates CSS variables when accent color changes", () => {
      const { rerender } = renderHook(({ color }) => useAccentColor(color), {
        initialProps: { color: "#ff5500" as string | null | undefined },
      })

      expect(document.documentElement.style.getPropertyValue("--repo-accent")).toBe("#ff5500")

      act(() => {
        rerender({ color: "#00ff00" })
      })

      expect(document.documentElement.style.getPropertyValue("--repo-accent")).toBe("#00ff00")
    })
  })

  describe("cleanup", () => {
    it("removes CSS variables on unmount", () => {
      const { unmount } = renderHook(() => useAccentColor("#ff5500"))

      expect(document.documentElement.style.getPropertyValue("--repo-accent")).toBe("#ff5500")

      unmount()

      expect(document.documentElement.style.getPropertyValue("--repo-accent")).toBe("")
      expect(document.documentElement.style.getPropertyValue("--repo-accent-foreground")).toBe("")
    })
  })
})
