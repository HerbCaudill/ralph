import { describe, it, expect } from "vitest"
import type { VSCodeTheme } from "./types"
import { DEFAULT_DARK_STATUS_COLORS, DEFAULT_LIGHT_STATUS_COLORS } from "./types"
import {
  extractStatusColors,
  mapThemeToCSSVariables,
  createAppTheme,
  generateThemeCSS,
  isValidHexColor,
  normalizeHexColor,
} from "./mapper"

// Helper to create a minimal valid theme
function createMinimalTheme(overrides: Partial<VSCodeTheme> = {}): VSCodeTheme {
  return {
    name: "Test Theme",
    type: "dark",
    colors: {},
    tokenColors: [],
    ...overrides,
  }
}

describe("extractStatusColors", () => {
  describe("dark themes", () => {
    it("returns default dark colors when no theme colors provided", () => {
      const theme = createMinimalTheme({ type: "dark" })
      const colors = extractStatusColors(theme)

      expect(colors).toEqual(DEFAULT_DARK_STATUS_COLORS)
    })

    it("extracts success color from terminal.ansiGreen", () => {
      const theme = createMinimalTheme({
        type: "dark",
        colors: { "terminal.ansiGreen": "#00ff00" },
      })
      const colors = extractStatusColors(theme)

      expect(colors.success).toBe("#00ff00")
    })

    it("falls back to terminal.ansiBrightGreen if ansiGreen not present", () => {
      const theme = createMinimalTheme({
        type: "dark",
        colors: { "terminal.ansiBrightGreen": "#55ff55" },
      })
      const colors = extractStatusColors(theme)

      expect(colors.success).toBe("#55ff55")
    })

    it("falls back to gitDecoration.addedResourceForeground", () => {
      const theme = createMinimalTheme({
        type: "dark",
        colors: { "gitDecoration.addedResourceForeground": "#66ff66" },
      })
      const colors = extractStatusColors(theme)

      expect(colors.success).toBe("#66ff66")
    })

    it("extracts warning color from terminal.ansiYellow", () => {
      const theme = createMinimalTheme({
        type: "dark",
        colors: { "terminal.ansiYellow": "#ffff00" },
      })
      const colors = extractStatusColors(theme)

      expect(colors.warning).toBe("#ffff00")
    })

    it("extracts error color from terminal.ansiRed", () => {
      const theme = createMinimalTheme({
        type: "dark",
        colors: { "terminal.ansiRed": "#ff0000" },
      })
      const colors = extractStatusColors(theme)

      expect(colors.error).toBe("#ff0000")
    })

    it("falls back to editorError.foreground for error", () => {
      const theme = createMinimalTheme({
        type: "dark",
        colors: { "editorError.foreground": "#ff4444" },
      })
      const colors = extractStatusColors(theme)

      expect(colors.error).toBe("#ff4444")
    })

    it("extracts info color from terminal.ansiBlue", () => {
      const theme = createMinimalTheme({
        type: "dark",
        colors: { "terminal.ansiBlue": "#0000ff" },
      })
      const colors = extractStatusColors(theme)

      expect(colors.info).toBe("#0000ff")
    })

    it("extracts neutral color from editorLineNumber.foreground", () => {
      const theme = createMinimalTheme({
        type: "dark",
        colors: { "editorLineNumber.foreground": "#808080" },
      })
      const colors = extractStatusColors(theme)

      expect(colors.neutral).toBe("#808080")
    })
  })

  describe("light themes", () => {
    it("returns default light colors when no theme colors provided", () => {
      const theme = createMinimalTheme({ type: "light" })
      const colors = extractStatusColors(theme)

      expect(colors).toEqual(DEFAULT_LIGHT_STATUS_COLORS)
    })

    it("extracts colors from light theme", () => {
      const theme = createMinimalTheme({
        type: "light",
        colors: {
          "terminal.ansiGreen": "#008000",
          "terminal.ansiYellow": "#808000",
          "terminal.ansiRed": "#800000",
          "terminal.ansiBlue": "#000080",
          "editorLineNumber.foreground": "#6e6e6e",
        },
      })
      const colors = extractStatusColors(theme)

      expect(colors.success).toBe("#008000")
      expect(colors.warning).toBe("#808000")
      expect(colors.error).toBe("#800000")
      expect(colors.info).toBe("#000080")
      expect(colors.neutral).toBe("#6e6e6e")
    })
  })

  describe("high contrast themes", () => {
    it("treats hcDark as dark theme", () => {
      const theme = createMinimalTheme({ type: "hcDark" })
      const colors = extractStatusColors(theme)

      expect(colors).toEqual(DEFAULT_DARK_STATUS_COLORS)
    })

    it("treats hcLight as light theme", () => {
      const theme = createMinimalTheme({ type: "hcLight" })
      const colors = extractStatusColors(theme)

      expect(colors).toEqual(DEFAULT_LIGHT_STATUS_COLORS)
    })
  })
})

describe("mapThemeToCSSVariables", () => {
  describe("background and foreground", () => {
    it("maps editor.background to --background", () => {
      const theme = createMinimalTheme({
        colors: { "editor.background": "#1a1a1a" },
      })
      const vars = mapThemeToCSSVariables(theme)

      expect(vars["--background"]).toBe("#1a1a1a")
    })

    it("maps editor.foreground to --foreground", () => {
      const theme = createMinimalTheme({
        colors: { "editor.foreground": "#e0e0e0" },
      })
      const vars = mapThemeToCSSVariables(theme)

      expect(vars["--foreground"]).toBe("#e0e0e0")
    })

    it("falls back to foreground if editor.foreground not present", () => {
      const theme = createMinimalTheme({
        colors: { foreground: "#d0d0d0" },
      })
      const vars = mapThemeToCSSVariables(theme)

      expect(vars["--foreground"]).toBe("#d0d0d0")
    })
  })

  describe("primary colors", () => {
    it("maps button.background to --primary", () => {
      const theme = createMinimalTheme({
        colors: { "button.background": "#007acc" },
      })
      const vars = mapThemeToCSSVariables(theme)

      expect(vars["--primary"]).toBe("#007acc")
    })

    it("falls back to focusBorder for --primary", () => {
      const theme = createMinimalTheme({
        colors: { focusBorder: "#569cd6" },
      })
      const vars = mapThemeToCSSVariables(theme)

      expect(vars["--primary"]).toBe("#569cd6")
    })

    it("maps button.foreground to --primary-foreground", () => {
      const theme = createMinimalTheme({
        colors: { "button.foreground": "#ffffff" },
      })
      const vars = mapThemeToCSSVariables(theme)

      expect(vars["--primary-foreground"]).toBe("#ffffff")
    })
  })

  describe("sidebar colors", () => {
    it("maps sideBar.background to --sidebar", () => {
      const theme = createMinimalTheme({
        colors: { "sideBar.background": "#252526" },
      })
      const vars = mapThemeToCSSVariables(theme)

      expect(vars["--sidebar"]).toBe("#252526")
    })

    it("maps sideBar.foreground to --sidebar-foreground", () => {
      const theme = createMinimalTheme({
        colors: { "sideBar.foreground": "#cccccc" },
      })
      const vars = mapThemeToCSSVariables(theme)

      expect(vars["--sidebar-foreground"]).toBe("#cccccc")
    })
  })

  describe("status colors", () => {
    it("includes status colors in CSS variables", () => {
      const theme = createMinimalTheme({
        type: "dark",
        colors: {
          "terminal.ansiGreen": "#00ff00",
          "terminal.ansiYellow": "#ffff00",
          "terminal.ansiRed": "#ff0000",
          "terminal.ansiBlue": "#0000ff",
          "editorLineNumber.foreground": "#808080",
        },
      })
      const vars = mapThemeToCSSVariables(theme)

      expect(vars["--status-success"]).toBe("#00ff00")
      expect(vars["--status-warning"]).toBe("#ffff00")
      expect(vars["--status-error"]).toBe("#ff0000")
      expect(vars["--status-info"]).toBe("#0000ff")
      expect(vars["--status-neutral"]).toBe("#808080")
    })
  })

  describe("derived colors", () => {
    it("derives --border from background when not specified", () => {
      const theme = createMinimalTheme({
        type: "dark",
        colors: { "editor.background": "#1e1e1e" },
      })
      const vars = mapThemeToCSSVariables(theme)

      // Should be slightly lighter than background for dark themes
      expect(vars["--border"]).not.toBe("#1e1e1e")
      expect(vars["--border"]).toMatch(/^#[0-9a-f]{6}$/i)
    })

    it("uses panel.border when specified", () => {
      const theme = createMinimalTheme({
        type: "dark",
        colors: {
          "editor.background": "#1e1e1e",
          "panel.border": "#454545",
        },
      })
      const vars = mapThemeToCSSVariables(theme)

      expect(vars["--border"]).toBe("#454545")
    })
  })

  describe("defaults", () => {
    it("provides sensible defaults for dark theme", () => {
      const theme = createMinimalTheme({ type: "dark" })
      const vars = mapThemeToCSSVariables(theme)

      // All variables should be defined
      expect(vars["--background"]).toBeDefined()
      expect(vars["--foreground"]).toBeDefined()
      expect(vars["--primary"]).toBeDefined()
      expect(vars["--border"]).toBeDefined()
      expect(vars["--sidebar"]).toBeDefined()
    })

    it("provides sensible defaults for light theme", () => {
      const theme = createMinimalTheme({ type: "light" })
      const vars = mapThemeToCSSVariables(theme)

      // All variables should be defined
      expect(vars["--background"]).toBeDefined()
      expect(vars["--foreground"]).toBeDefined()
      expect(vars["--primary"]).toBeDefined()
      expect(vars["--border"]).toBeDefined()
      expect(vars["--sidebar"]).toBeDefined()
    })
  })
})

describe("createAppTheme", () => {
  const mockMeta = {
    id: "test.theme",
    label: "Test Theme",
    type: "dark" as const,
    path: "/path/to/theme.json",
    extensionId: "test.extension",
    extensionName: "Test Extension",
  }

  it("creates an AppTheme with all required fields", () => {
    const theme = createMinimalTheme({
      type: "dark",
      colors: {
        "editor.background": "#1e1e1e",
        "editor.foreground": "#d4d4d4",
      },
    })
    const appTheme = createAppTheme(theme, mockMeta)

    expect(appTheme.meta).toEqual(mockMeta)
    expect(appTheme.statusColors).toBeDefined()
    expect(appTheme.vscodeTheme).toBe(theme)
    expect(appTheme.colors).toBeDefined()
  })

  it("extracts essential colors", () => {
    const theme = createMinimalTheme({
      type: "dark",
      colors: {
        "editor.background": "#282c34",
        "editor.foreground": "#abb2bf",
        "button.background": "#61afef",
      },
    })
    const appTheme = createAppTheme(theme, mockMeta)

    expect(appTheme.colors.background).toBe("#282c34")
    expect(appTheme.colors.foreground).toBe("#abb2bf")
  })
})

describe("generateThemeCSS", () => {
  it("generates valid CSS with :root selector by default", () => {
    const theme = createMinimalTheme({
      type: "dark",
      colors: { "editor.background": "#1e1e1e" },
    })
    const css = generateThemeCSS(theme)

    expect(css).toContain(":root {")
    expect(css).toContain("--background: #1e1e1e;")
    expect(css).toContain("}")
  })

  it("uses custom selector when provided", () => {
    const theme = createMinimalTheme({ type: "dark" })
    const css = generateThemeCSS(theme, ".custom-theme")

    expect(css).toContain(".custom-theme {")
  })

  it("includes all CSS variables", () => {
    const theme = createMinimalTheme({ type: "dark" })
    const css = generateThemeCSS(theme)

    expect(css).toContain("--background:")
    expect(css).toContain("--foreground:")
    expect(css).toContain("--primary:")
    expect(css).toContain("--sidebar:")
    expect(css).toContain("--status-success:")
    expect(css).toContain("--status-error:")
  })
})

describe("isValidHexColor", () => {
  it("validates 3-digit hex colors", () => {
    expect(isValidHexColor("#fff")).toBe(true)
    expect(isValidHexColor("#F0F")).toBe(true)
    expect(isValidHexColor("#123")).toBe(true)
  })

  it("validates 6-digit hex colors", () => {
    expect(isValidHexColor("#ffffff")).toBe(true)
    expect(isValidHexColor("#FF00FF")).toBe(true)
    expect(isValidHexColor("#1a2b3c")).toBe(true)
  })

  it("validates 8-digit hex colors (with alpha)", () => {
    expect(isValidHexColor("#ffffff00")).toBe(true)
    expect(isValidHexColor("#FF00FF80")).toBe(true)
  })

  it("rejects invalid colors", () => {
    expect(isValidHexColor("fff")).toBe(false)
    expect(isValidHexColor("#gg0000")).toBe(false)
    expect(isValidHexColor("#ff")).toBe(false)
    expect(isValidHexColor("#fffffff")).toBe(false)
    expect(isValidHexColor("rgb(255,0,0)")).toBe(false)
  })
})

describe("normalizeHexColor", () => {
  it("expands 3-digit hex to 6-digit", () => {
    expect(normalizeHexColor("#fff")).toBe("#ffffff")
    expect(normalizeHexColor("#F0F")).toBe("#FF00FF")
    expect(normalizeHexColor("#123")).toBe("#112233")
  })

  it("keeps 6-digit hex unchanged", () => {
    expect(normalizeHexColor("#ffffff")).toBe("#ffffff")
    expect(normalizeHexColor("#1a2b3c")).toBe("#1a2b3c")
  })

  it("strips alpha from 8-digit hex", () => {
    expect(normalizeHexColor("#ffffff00")).toBe("#ffffff")
    expect(normalizeHexColor("#1a2b3c80")).toBe("#1a2b3c")
  })

  it("returns invalid colors unchanged", () => {
    expect(normalizeHexColor("invalid")).toBe("invalid")
    expect(normalizeHexColor("rgb(255,0,0)")).toBe("rgb(255,0,0)")
  })
})
