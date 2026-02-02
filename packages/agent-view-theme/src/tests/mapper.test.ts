/**
 * Tests for theme color mapping to CSS variables.
 */

import { describe, it, expect } from "vitest"
import {
  isValidHexColor,
  normalizeHexColor,
  extractStatusColors,
  mapThemeToCSSVariables,
  generateThemeCSS,
  createAppTheme,
} from ".././mapper"
import type { VSCodeTheme, ThemeMeta } from ".././types"
import { DEFAULT_DARK_STATUS_COLORS, DEFAULT_LIGHT_STATUS_COLORS } from ".././types"

describe("isValidHexColor", () => {
  it("should accept valid 3-digit hex colors", () => {
    expect(isValidHexColor("#fff")).toBe(true)
    expect(isValidHexColor("#000")).toBe(true)
    expect(isValidHexColor("#abc")).toBe(true)
    expect(isValidHexColor("#ABC")).toBe(true)
  })

  it("should accept valid 6-digit hex colors", () => {
    expect(isValidHexColor("#ffffff")).toBe(true)
    expect(isValidHexColor("#000000")).toBe(true)
    expect(isValidHexColor("#abcdef")).toBe(true)
    expect(isValidHexColor("#ABCDEF")).toBe(true)
  })

  it("should accept valid 8-digit hex colors (with alpha)", () => {
    expect(isValidHexColor("#ffffff80")).toBe(true)
    expect(isValidHexColor("#00000000")).toBe(true)
    expect(isValidHexColor("#abcdef12")).toBe(true)
  })

  it("should reject invalid hex colors", () => {
    expect(isValidHexColor("ffffff")).toBe(false) // Missing #
    expect(isValidHexColor("#ff")).toBe(false) // Too short
    expect(isValidHexColor("#fffff")).toBe(false) // Invalid length
    expect(isValidHexColor("#gggggg")).toBe(false) // Invalid characters
    expect(isValidHexColor("rgb(255,255,255)")).toBe(false) // Not hex
    expect(isValidHexColor("")).toBe(false) // Empty
    expect(isValidHexColor("#")).toBe(false) // Just #
  })
})

describe("normalizeHexColor", () => {
  it("should expand 3-digit hex to 6-digit", () => {
    expect(normalizeHexColor("#fff")).toBe("#ffffff")
    expect(normalizeHexColor("#000")).toBe("#000000")
    expect(normalizeHexColor("#abc")).toBe("#aabbcc")
    expect(normalizeHexColor("#ABC")).toBe("#AABBCC")
  })

  it("should keep 6-digit hex unchanged", () => {
    expect(normalizeHexColor("#ffffff")).toBe("#ffffff")
    expect(normalizeHexColor("#000000")).toBe("#000000")
    expect(normalizeHexColor("#abcdef")).toBe("#abcdef")
  })

  it("should strip alpha from 8-digit hex", () => {
    expect(normalizeHexColor("#ffffff80")).toBe("#ffffff")
    expect(normalizeHexColor("#00000000")).toBe("#000000")
    expect(normalizeHexColor("#abcdef12")).toBe("#abcdef")
  })

  it("should return original string for invalid hex", () => {
    expect(normalizeHexColor("invalid")).toBe("invalid")
    expect(normalizeHexColor("rgb(255,255,255)")).toBe("rgb(255,255,255)")
    expect(normalizeHexColor("#gg")).toBe("#gg")
  })
})

describe("extractStatusColors", () => {
  it("should extract status colors from dark theme", () => {
    const theme: VSCodeTheme = {
      name: "Dark Theme",
      type: "dark",
      colors: {
        "terminal.ansiGreen": "#98c379",
        "terminal.ansiYellow": "#e5c07b",
        "terminal.ansiRed": "#e06c75",
        "terminal.ansiBlue": "#61afef",
        "editorLineNumber.foreground": "#4b5263",
      },
      tokenColors: [],
    }

    const colors = extractStatusColors(theme)

    expect(colors.success).toBe("#98c379")
    expect(colors.warning).toBe("#e5c07b")
    expect(colors.error).toBe("#e06c75")
    expect(colors.info).toBe("#61afef")
    expect(colors.neutral).toBe("#4b5263")
  })

  it("should extract status colors from light theme", () => {
    const theme: VSCodeTheme = {
      name: "Light Theme",
      type: "light",
      colors: {
        "terminal.ansiGreen": "#22863a",
        "terminal.ansiYellow": "#b08800",
        "terminal.ansiRed": "#d73a49",
        "terminal.ansiBlue": "#005cc5",
        "editorLineNumber.foreground": "#6e7781",
      },
      tokenColors: [],
    }

    const colors = extractStatusColors(theme)

    expect(colors.success).toBe("#22863a")
    expect(colors.warning).toBe("#b08800")
    expect(colors.error).toBe("#d73a49")
    expect(colors.info).toBe("#005cc5")
    expect(colors.neutral).toBe("#6e7781")
  })

  it("should use fallback chain for missing colors", () => {
    const theme: VSCodeTheme = {
      name: "Minimal",
      type: "dark",
      colors: {
        "gitDecoration.addedResourceForeground": "#4ec9b0",
        "editorWarning.foreground": "#dcdcaa",
        errorForeground: "#f48771",
        focusBorder: "#007acc",
      },
      tokenColors: [],
    }

    const colors = extractStatusColors(theme)

    expect(colors.success).toBe("#4ec9b0") // Second fallback
    expect(colors.warning).toBe("#dcdcaa") // Third fallback
    expect(colors.error).toBe("#f48771") // Fourth fallback
    expect(colors.info).toBe("#007acc") // Fifth fallback
  })

  it("should use default dark colors when no theme colors available", () => {
    const theme: VSCodeTheme = {
      name: "Empty Dark",
      type: "dark",
      colors: {},
      tokenColors: [],
    }

    const colors = extractStatusColors(theme)

    expect(colors).toEqual(DEFAULT_DARK_STATUS_COLORS)
  })

  it("should use default light colors when no theme colors available", () => {
    const theme: VSCodeTheme = {
      name: "Empty Light",
      type: "light",
      colors: {},
      tokenColors: [],
    }

    const colors = extractStatusColors(theme)

    expect(colors).toEqual(DEFAULT_LIGHT_STATUS_COLORS)
  })
})

describe("mapThemeToCSSVariables", () => {
  it("should map theme colors to CSS variables", () => {
    const theme: VSCodeTheme = {
      name: "Test",
      type: "dark",
      colors: {
        "editor.background": "#282c34",
        "editor.foreground": "#abb2bf",
        "button.background": "#61afef",
        "panel.border": "#3e4451",
        "terminal.ansiGreen": "#98c379",
        "terminal.ansiYellow": "#e5c07b",
        "terminal.ansiRed": "#e06c75",
        "terminal.ansiBlue": "#61afef",
        "editorLineNumber.foreground": "#4b5263",
      },
      tokenColors: [],
    }

    const vars = mapThemeToCSSVariables(theme)

    expect(vars["--background"]).toBe("#282c34")
    expect(vars["--foreground"]).toBe("#abb2bf")
    expect(vars["--primary"]).toBe("#61afef")
    expect(vars["--border"]).toBe("#3e4451")
    expect(vars["--status-success"]).toBe("#98c379")
    expect(vars["--status-warning"]).toBe("#e5c07b")
    expect(vars["--status-error"]).toBe("#e06c75")
    expect(vars["--status-info"]).toBe("#61afef")
  })

  it("should return all required CSS variable keys", () => {
    const theme: VSCodeTheme = {
      name: "Test",
      type: "dark",
      colors: {},
      tokenColors: [],
    }

    const vars = mapThemeToCSSVariables(theme)

    // Base colors
    expect(vars).toHaveProperty("--background")
    expect(vars).toHaveProperty("--foreground")
    expect(vars).toHaveProperty("--card")
    expect(vars).toHaveProperty("--card-foreground")
    expect(vars).toHaveProperty("--popover")
    expect(vars).toHaveProperty("--popover-foreground")
    expect(vars).toHaveProperty("--primary")
    expect(vars).toHaveProperty("--primary-foreground")
    expect(vars).toHaveProperty("--secondary")
    expect(vars).toHaveProperty("--secondary-foreground")
    expect(vars).toHaveProperty("--muted")
    expect(vars).toHaveProperty("--muted-foreground")
    expect(vars).toHaveProperty("--accent")
    expect(vars).toHaveProperty("--accent-foreground")
    expect(vars).toHaveProperty("--destructive")
    expect(vars).toHaveProperty("--border")
    expect(vars).toHaveProperty("--input")
    expect(vars).toHaveProperty("--input-placeholder")
    expect(vars).toHaveProperty("--ring")

    // Sidebar colors
    expect(vars).toHaveProperty("--sidebar")
    expect(vars).toHaveProperty("--sidebar-foreground")
    expect(vars).toHaveProperty("--sidebar-primary")
    expect(vars).toHaveProperty("--sidebar-primary-foreground")
    expect(vars).toHaveProperty("--sidebar-accent")
    expect(vars).toHaveProperty("--sidebar-accent-foreground")
    expect(vars).toHaveProperty("--sidebar-border")
    expect(vars).toHaveProperty("--sidebar-ring")

    // Status colors
    expect(vars).toHaveProperty("--status-success")
    expect(vars).toHaveProperty("--status-warning")
    expect(vars).toHaveProperty("--status-error")
    expect(vars).toHaveProperty("--status-info")
    expect(vars).toHaveProperty("--status-neutral")
  })

  it("should use defaults for missing colors in dark theme", () => {
    const theme: VSCodeTheme = {
      name: "Dark",
      type: "dark",
      colors: {},
      tokenColors: [],
    }

    const vars = mapThemeToCSSVariables(theme)

    expect(vars["--background"]).toBe("#1e1e1e")
    expect(vars["--foreground"]).toBe("#d4d4d4")
    expect(vars["--primary"]).toBe("#007acc")
  })

  it("should use defaults for missing colors in light theme", () => {
    const theme: VSCodeTheme = {
      name: "Light",
      type: "light",
      colors: {},
      tokenColors: [],
    }

    const vars = mapThemeToCSSVariables(theme)

    expect(vars["--background"]).toBe("#ffffff")
    expect(vars["--foreground"]).toBe("#333333")
    expect(vars["--primary"]).toBe("#0066b8")
  })

  it("should derive colors when needed", () => {
    const theme: VSCodeTheme = {
      name: "Test",
      type: "dark",
      colors: {
        "editor.background": "#1e1e1e",
        "button.background": "#007acc",
      },
      tokenColors: [],
    }

    const vars = mapThemeToCSSVariables(theme)

    // Should derive primary-foreground based on dark theme
    expect(vars["--primary-foreground"]).toBe("#1e1e1e")
    // Should derive accent from primary
    expect(vars["--accent"]).toBe("#007acc")
  })
})

describe("generateThemeCSS", () => {
  it("should generate valid CSS with :root selector", () => {
    const theme: VSCodeTheme = {
      name: "Test",
      type: "dark",
      colors: {
        "editor.background": "#282c34",
        "editor.foreground": "#abb2bf",
      },
      tokenColors: [],
    }

    const css = generateThemeCSS(theme)

    expect(css).toContain(":root {")
    expect(css).toContain("--background: #282c34;")
    expect(css).toContain("--foreground: #abb2bf;")
    expect(css).toContain("}")
  })

  it("should use custom selector when provided", () => {
    const theme: VSCodeTheme = {
      name: "Test",
      type: "dark",
      colors: {},
      tokenColors: [],
    }

    const css = generateThemeCSS(theme, ".dark-mode")

    expect(css).toContain(".dark-mode {")
    expect(css).toContain("}")
  })

  it("should include all CSS variables", () => {
    const theme: VSCodeTheme = {
      name: "Test",
      type: "dark",
      colors: {},
      tokenColors: [],
    }

    const css = generateThemeCSS(theme)

    expect(css).toContain("--background:")
    expect(css).toContain("--foreground:")
    expect(css).toContain("--status-success:")
    expect(css).toContain("--status-warning:")
    expect(css).toContain("--status-error:")
    expect(css).toContain("--sidebar:")
  })
})

describe("createAppTheme", () => {
  const meta: ThemeMeta = {
    id: "test.theme",
    label: "Test Theme",
    type: "dark",
    path: "/path/to/theme.json",
    extensionId: "test.extension",
    extensionName: "Test Extension",
  }

  it("should create complete AppTheme", () => {
    const vscodeTheme: VSCodeTheme = {
      name: "Test",
      type: "dark",
      colors: {
        "editor.background": "#282c34",
        "editor.foreground": "#abb2bf",
        "button.background": "#61afef",
        "terminal.ansiGreen": "#98c379",
      },
      tokenColors: [],
    }

    const appTheme = createAppTheme(vscodeTheme, meta)

    expect(appTheme.meta).toEqual(meta)
    expect(appTheme.vscodeTheme).toEqual(vscodeTheme)
    expect(appTheme.statusColors.success).toBe("#98c379")
    expect(appTheme.colors.background).toBe("#282c34")
    expect(appTheme.colors.foreground).toBe("#abb2bf")
    expect(appTheme.colors.accent).toBe("#61afef")
  })

  it("should extract all essential colors", () => {
    const vscodeTheme: VSCodeTheme = {
      name: "Test",
      type: "light",
      colors: {},
      tokenColors: [],
    }

    const appTheme = createAppTheme(vscodeTheme, meta)

    expect(appTheme.colors).toHaveProperty("background")
    expect(appTheme.colors).toHaveProperty("foreground")
    expect(appTheme.colors).toHaveProperty("accent")
    expect(appTheme.colors).toHaveProperty("muted")
    expect(appTheme.colors).toHaveProperty("border")
    expect(appTheme.colors).toHaveProperty("selection")
  })

  it("should extract all status colors", () => {
    const vscodeTheme: VSCodeTheme = {
      name: "Test",
      type: "dark",
      colors: {},
      tokenColors: [],
    }

    const appTheme = createAppTheme(vscodeTheme, meta)

    expect(appTheme.statusColors).toHaveProperty("success")
    expect(appTheme.statusColors).toHaveProperty("warning")
    expect(appTheme.statusColors).toHaveProperty("error")
    expect(appTheme.statusColors).toHaveProperty("info")
    expect(appTheme.statusColors).toHaveProperty("neutral")
  })
})
