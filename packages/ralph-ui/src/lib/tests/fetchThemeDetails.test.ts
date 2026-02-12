import { describe, expect, it, vi, beforeEach } from "vitest"
import { fetchThemeDetails } from "../fetchThemeDetails"

describe("fetchThemeDetails", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("returns CSS variables and theme type on success", async () => {
    const mockCssVariables = {
      "--background": "#1e1e1e",
      "--foreground": "#d4d4d4",
    }

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        theme: { meta: { type: "dark" } },
        cssVariables: mockCssVariables,
      }),
    } as Response)

    const result = await fetchThemeDetails("test-theme-id")

    expect(result).toEqual({
      cssVariables: mockCssVariables,
      themeType: "dark",
    })
    expect(fetch).toHaveBeenCalledWith("/api/themes/test-theme-id")
  })

  it("URI-encodes the theme ID in the URL", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
    } as Response)

    await fetchThemeDetails("vscode.theme-gruvbox/dark medium")

    expect(fetch).toHaveBeenCalledWith("/api/themes/vscode.theme-gruvbox%2Fdark%20medium")
  })

  it("returns null when response is not ok", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
    } as Response)

    const result = await fetchThemeDetails("missing-theme")

    expect(result).toBeNull()
  })

  it("returns null when API response has ok: false", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: false, error: "Theme not found" }),
    } as Response)

    const result = await fetchThemeDetails("missing-theme")

    expect(result).toBeNull()
  })

  it("returns null on fetch error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"))

    const result = await fetchThemeDetails("any-theme")

    expect(result).toBeNull()
  })
})
