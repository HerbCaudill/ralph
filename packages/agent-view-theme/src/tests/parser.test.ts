/**
 * Tests for VS Code theme JSON parsing and validation.
 */

import { describe, it, expect } from "vitest"
import {
  parseThemeJson,
  parseThemeObject,
  validateThemeObject,
  getColor,
  isDarkTheme,
  isLightTheme,
  isHighContrastTheme,
  getEssentialColors,
  getForegroundForScope,
  getTokenColorsForScope,
} from ".././parser"
import type { VSCodeTheme } from ".././types"

describe("parseThemeJson", () => {
  it("should parse valid JSON theme", () => {
    const json = JSON.stringify({
      name: "Test Theme",
      type: "dark",
      colors: {
        "editor.background": "#1e1e1e",
        "editor.foreground": "#d4d4d4",
      },
      tokenColors: [],
    })

    const result = parseThemeJson(json)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.theme.name).toBe("Test Theme")
      expect(result.theme.type).toBe("dark")
    }
  })

  it("should return error for invalid JSON", () => {
    const result = parseThemeJson("{ invalid json")

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain("Invalid JSON")
    }
  })

  it("should return error for missing required fields", () => {
    const json = JSON.stringify({
      colors: {},
    })

    const result = parseThemeJson(json)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain("name")
    }
  })
})

describe("parseThemeObject", () => {
  it("should parse valid theme object", () => {
    const data = {
      name: "Test Theme",
      type: "light",
      colors: {
        "editor.background": "#ffffff",
      },
      tokenColors: [],
    }

    const result = parseThemeObject(data)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.theme.name).toBe("Test Theme")
      expect(result.theme.type).toBe("light")
    }
  })

  it("should parse minimal valid theme", () => {
    const data = {
      name: "Minimal",
      type: "dark",
    }

    const result = parseThemeObject(data)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.theme.name).toBe("Minimal")
      expect(result.theme.colors).toEqual({})
      expect(result.theme.tokenColors).toEqual([])
    }
  })

  it("should normalize theme with all optional fields", () => {
    const data = {
      $schema: "vscode://schemas/color-theme",
      name: "Full Theme",
      type: "hcDark",
      semanticHighlighting: true,
      colors: {
        foreground: "#ffffff",
        "editor.background": "#000000",
      },
      tokenColors: [
        {
          name: "Comment",
          scope: "comment",
          settings: {
            foreground: "#6a9955",
            fontStyle: "italic",
          },
        },
      ],
      semanticTokenColors: {
        variable: "#9cdcfe",
      },
    }

    const result = parseThemeObject(data)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.theme.$schema).toBe("vscode://schemas/color-theme")
      expect(result.theme.semanticHighlighting).toBe(true)
      expect(result.theme.tokenColors).toHaveLength(1)
      expect(result.theme.semanticTokenColors).toEqual({ variable: "#9cdcfe" })
    }
  })

  it("should handle array scope in token colors", () => {
    const data = {
      name: "Test",
      type: "dark",
      tokenColors: [
        {
          scope: ["keyword", "storage"],
          settings: {
            foreground: "#569cd6",
          },
        },
      ],
    }

    const result = parseThemeObject(data)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.theme.tokenColors[0].scope).toEqual(["keyword", "storage"])
    }
  })
})

describe("validateThemeObject", () => {
  it("should validate valid theme", () => {
    const data = {
      name: "Valid",
      type: "dark",
      colors: {},
      tokenColors: [],
    }

    const result = validateThemeObject(data)

    expect(result.valid).toBe(true)
  })

  it("should reject non-object", () => {
    const result = validateThemeObject(null)

    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors).toContain("Theme must be an object")
    }
  })

  it("should reject missing name", () => {
    const data = {
      type: "dark",
    }

    const result = validateThemeObject(data)

    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors.some(e => e.includes("name"))).toBe(true)
    }
  })

  it("should reject empty name", () => {
    const data = {
      name: "  ",
      type: "dark",
    }

    const result = validateThemeObject(data)

    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors.some(e => e.includes("name"))).toBe(true)
    }
  })

  it("should reject invalid type", () => {
    const data = {
      name: "Test",
      type: "invalid",
    }

    const result = validateThemeObject(data)

    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors.some(e => e.includes("type"))).toBe(true)
    }
  })

  it("should reject non-object colors", () => {
    const data = {
      name: "Test",
      type: "dark",
      colors: [],
    }

    const result = validateThemeObject(data)

    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors.some(e => e.includes("colors"))).toBe(true)
    }
  })

  it("should reject non-array tokenColors", () => {
    const data = {
      name: "Test",
      type: "dark",
      tokenColors: {},
    }

    const result = validateThemeObject(data)

    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors.some(e => e.includes("tokenColors"))).toBe(true)
    }
  })

  it("should validate token color entries", () => {
    const data = {
      name: "Test",
      type: "dark",
      tokenColors: [
        {
          settings: {
            foreground: "#ffffff",
          },
        },
        {
          // Missing settings
          scope: "comment",
        },
      ],
    }

    const result = validateThemeObject(data)

    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors.some(e => e.includes("settings"))).toBe(true)
    }
  })
})

describe("getColor", () => {
  const theme: VSCodeTheme = {
    name: "Test",
    type: "dark",
    colors: {
      "editor.background": "#1e1e1e",
      foreground: "#d4d4d4",
    },
    tokenColors: [],
  }

  it("should get existing color", () => {
    expect(getColor(theme, "editor.background")).toBe("#1e1e1e")
    expect(getColor(theme, "foreground")).toBe("#d4d4d4")
  })

  it("should return undefined for missing key", () => {
    expect(getColor(theme, "nonexistent.color")).toBeUndefined()
  })
})

describe("isDarkTheme", () => {
  it("should return true for dark theme", () => {
    const theme: VSCodeTheme = {
      name: "Dark",
      type: "dark",
      colors: {},
      tokenColors: [],
    }
    expect(isDarkTheme(theme)).toBe(true)
  })

  it("should return true for high-contrast dark theme", () => {
    const theme: VSCodeTheme = {
      name: "HC Dark",
      type: "hcDark",
      colors: {},
      tokenColors: [],
    }
    expect(isDarkTheme(theme)).toBe(true)
  })

  it("should return false for light theme", () => {
    const theme: VSCodeTheme = {
      name: "Light",
      type: "light",
      colors: {},
      tokenColors: [],
    }
    expect(isDarkTheme(theme)).toBe(false)
  })

  it("should return false for high-contrast light theme", () => {
    const theme: VSCodeTheme = {
      name: "HC Light",
      type: "hcLight",
      colors: {},
      tokenColors: [],
    }
    expect(isDarkTheme(theme)).toBe(false)
  })
})

describe("isLightTheme", () => {
  it("should return true for light theme", () => {
    const theme: VSCodeTheme = {
      name: "Light",
      type: "light",
      colors: {},
      tokenColors: [],
    }
    expect(isLightTheme(theme)).toBe(true)
  })

  it("should return true for high-contrast light theme", () => {
    const theme: VSCodeTheme = {
      name: "HC Light",
      type: "hcLight",
      colors: {},
      tokenColors: [],
    }
    expect(isLightTheme(theme)).toBe(true)
  })

  it("should return false for dark theme", () => {
    const theme: VSCodeTheme = {
      name: "Dark",
      type: "dark",
      colors: {},
      tokenColors: [],
    }
    expect(isLightTheme(theme)).toBe(false)
  })
})

describe("isHighContrastTheme", () => {
  it("should return true for high-contrast dark theme", () => {
    const theme: VSCodeTheme = {
      name: "HC Dark",
      type: "hcDark",
      colors: {},
      tokenColors: [],
    }
    expect(isHighContrastTheme(theme)).toBe(true)
  })

  it("should return true for high-contrast light theme", () => {
    const theme: VSCodeTheme = {
      name: "HC Light",
      type: "hcLight",
      colors: {},
      tokenColors: [],
    }
    expect(isHighContrastTheme(theme)).toBe(true)
  })

  it("should return false for regular dark theme", () => {
    const theme: VSCodeTheme = {
      name: "Dark",
      type: "dark",
      colors: {},
      tokenColors: [],
    }
    expect(isHighContrastTheme(theme)).toBe(false)
  })

  it("should return false for regular light theme", () => {
    const theme: VSCodeTheme = {
      name: "Light",
      type: "light",
      colors: {},
      tokenColors: [],
    }
    expect(isHighContrastTheme(theme)).toBe(false)
  })
})

describe("getEssentialColors", () => {
  it("should use theme colors when available", () => {
    const theme: VSCodeTheme = {
      name: "Test",
      type: "dark",
      colors: {
        "editor.background": "#282c34",
        "editor.foreground": "#abb2bf",
        "button.background": "#61afef",
        "panel.border": "#3e4451",
      },
      tokenColors: [],
    }

    const colors = getEssentialColors(theme)

    expect(colors.background).toBe("#282c34")
    expect(colors.foreground).toBe("#abb2bf")
    expect(colors.accent).toBe("#61afef")
    expect(colors.border).toBe("#3e4451")
  })

  it("should use dark defaults for dark theme when colors missing", () => {
    const theme: VSCodeTheme = {
      name: "Dark",
      type: "dark",
      colors: {},
      tokenColors: [],
    }

    const colors = getEssentialColors(theme)

    expect(colors.background).toBe("#1e1e1e")
    expect(colors.foreground).toBe("#d4d4d4")
    expect(colors.accent).toBe("#007acc")
    expect(colors.muted).toBe("#808080")
    expect(colors.border).toBe("#454545")
    expect(colors.selection).toBe("#264f78")
  })

  it("should use light defaults for light theme when colors missing", () => {
    const theme: VSCodeTheme = {
      name: "Light",
      type: "light",
      colors: {},
      tokenColors: [],
    }

    const colors = getEssentialColors(theme)

    expect(colors.background).toBe("#ffffff")
    expect(colors.foreground).toBe("#333333")
    expect(colors.accent).toBe("#0066b8")
    expect(colors.muted).toBe("#6e6e6e")
    expect(colors.border).toBe("#e5e5e5")
    expect(colors.selection).toBe("#add6ff")
  })

  it("should use fallback chain for foreground", () => {
    const theme: VSCodeTheme = {
      name: "Test",
      type: "dark",
      colors: {
        foreground: "#cccccc",
      },
      tokenColors: [],
    }

    const colors = getEssentialColors(theme)

    // Should use foreground as fallback for editor.foreground
    expect(colors.foreground).toBe("#cccccc")
  })
})

describe("getTokenColorsForScope", () => {
  const theme: VSCodeTheme = {
    name: "Test",
    type: "dark",
    colors: {},
    tokenColors: [
      {
        name: "Comment",
        scope: "comment",
        settings: { foreground: "#6a9955" },
      },
      {
        name: "Keywords",
        scope: ["keyword", "storage"],
        settings: { foreground: "#569cd6" },
      },
      {
        name: "Comment Line",
        scope: "comment.line",
        settings: { foreground: "#5c6370" },
      },
    ],
  }

  it("should find exact scope match", () => {
    const tokens = getTokenColorsForScope(theme, "comment")
    expect(tokens).toHaveLength(1)
    expect(tokens[0].name).toBe("Comment")
  })

  it("should find hierarchical scope match", () => {
    const tokens = getTokenColorsForScope(theme, "comment.line.double-slash")
    expect(tokens).toHaveLength(2)
    // Should match both "comment" and "comment.line"
    const names = tokens.map(t => t.name)
    expect(names).toContain("Comment")
    expect(names).toContain("Comment Line")
  })

  it("should find scope in array", () => {
    const tokens = getTokenColorsForScope(theme, "keyword")
    expect(tokens).toHaveLength(1)
    expect(tokens[0].name).toBe("Keywords")
  })

  it("should return empty array for no match", () => {
    const tokens = getTokenColorsForScope(theme, "nonexistent")
    expect(tokens).toEqual([])
  })
})

describe("getForegroundForScope", () => {
  const theme: VSCodeTheme = {
    name: "Test",
    type: "dark",
    colors: {},
    tokenColors: [
      {
        scope: "comment",
        settings: { foreground: "#6a9955" },
      },
      {
        scope: "keyword",
        settings: { fontStyle: "bold" }, // No foreground
      },
    ],
  }

  it("should return foreground for scope with color", () => {
    expect(getForegroundForScope(theme, "comment")).toBe("#6a9955")
  })

  it("should return undefined when scope has no foreground", () => {
    expect(getForegroundForScope(theme, "keyword")).toBeUndefined()
  })

  it("should return undefined when scope not found", () => {
    expect(getForegroundForScope(theme, "nonexistent")).toBeUndefined()
  })
})
