import { describe, it, expect } from "vitest"
import {
  parseThemeJson,
  parseThemeObject,
  validateThemeObject,
  getColor,
  getTokenColorsForScope,
  getForegroundForScope,
  isDarkTheme,
  isLightTheme,
  isHighContrastTheme,
  getEssentialColors,
} from "./parser"
import type { VSCodeTheme } from "./types"

describe("parseThemeJson", () => {
  it("parses valid theme JSON", () => {
    const json = JSON.stringify({
      name: "Test Theme",
      type: "dark",
      colors: { "editor.background": "#1e1e1e" },
      tokenColors: [],
    })

    const result = parseThemeJson(json)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.theme.name).toBe("Test Theme")
      expect(result.theme.type).toBe("dark")
    }
  })

  it("returns error for invalid JSON", () => {
    const result = parseThemeJson("{ invalid json }")
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain("Invalid JSON")
    }
  })

  it("returns error for empty string", () => {
    const result = parseThemeJson("")
    expect(result.success).toBe(false)
  })

  it("parses theme with all optional fields", () => {
    const json = JSON.stringify({
      $schema: "vscode://schemas/color-theme",
      name: "Full Theme",
      type: "light",
      semanticHighlighting: true,
      colors: {
        "editor.background": "#ffffff",
        "editor.foreground": "#333333",
      },
      tokenColors: [
        {
          name: "Comment",
          scope: "comment",
          settings: { foreground: "#999999", fontStyle: "italic" },
        },
      ],
      semanticTokenColors: {
        function: "#ff0000",
      },
    })

    const result = parseThemeJson(json)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.theme.$schema).toBe("vscode://schemas/color-theme")
      expect(result.theme.semanticHighlighting).toBe(true)
      expect(result.theme.colors["editor.background"]).toBe("#ffffff")
      expect(result.theme.tokenColors).toHaveLength(1)
      expect(result.theme.semanticTokenColors?.function).toBe("#ff0000")
    }
  })
})

describe("parseThemeObject", () => {
  it("parses a valid theme object", () => {
    const obj = {
      name: "Test Theme",
      type: "dark",
      colors: {},
      tokenColors: [],
    }

    const result = parseThemeObject(obj)
    expect(result.success).toBe(true)
  })

  it("returns error for null", () => {
    const result = parseThemeObject(null)
    expect(result.success).toBe(false)
  })

  it("returns error for array", () => {
    const result = parseThemeObject([])
    expect(result.success).toBe(false)
  })

  it("returns error for missing name", () => {
    const result = parseThemeObject({
      type: "dark",
      colors: {},
      tokenColors: [],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain("name")
    }
  })

  it("returns error for invalid type", () => {
    const result = parseThemeObject({
      name: "Test",
      type: "invalid",
      colors: {},
      tokenColors: [],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain("type")
    }
  })
})

describe("validateThemeObject", () => {
  it("validates a minimal valid theme", () => {
    const result = validateThemeObject({
      name: "Test",
      type: "dark",
    })
    expect(result.valid).toBe(true)
  })

  it("rejects empty name", () => {
    const result = validateThemeObject({
      name: "",
      type: "dark",
    })
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors.some(e => e.includes("name"))).toBe(true)
    }
  })

  it("rejects whitespace-only name", () => {
    const result = validateThemeObject({
      name: "   ",
      type: "dark",
    })
    expect(result.valid).toBe(false)
  })

  it("accepts all valid theme types", () => {
    for (const type of ["dark", "light", "hcDark", "hcLight"]) {
      const result = validateThemeObject({ name: "Test", type })
      expect(result.valid).toBe(true)
    }
  })

  it("rejects invalid colors type", () => {
    const result = validateThemeObject({
      name: "Test",
      type: "dark",
      colors: "not an object",
    })
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors.some(e => e.includes("colors"))).toBe(true)
    }
  })

  it("rejects colors as array", () => {
    const result = validateThemeObject({
      name: "Test",
      type: "dark",
      colors: [],
    })
    expect(result.valid).toBe(false)
  })

  it("rejects invalid tokenColors type", () => {
    const result = validateThemeObject({
      name: "Test",
      type: "dark",
      tokenColors: "not an array",
    })
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors.some(e => e.includes("tokenColors"))).toBe(true)
    }
  })

  it("rejects tokenColor without settings", () => {
    const result = validateThemeObject({
      name: "Test",
      type: "dark",
      tokenColors: [{ scope: "comment" }],
    })
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors.some(e => e.includes("settings"))).toBe(true)
    }
  })

  it("rejects tokenColor with invalid settings", () => {
    const result = validateThemeObject({
      name: "Test",
      type: "dark",
      tokenColors: [{ settings: "not an object" }],
    })
    expect(result.valid).toBe(false)
  })

  it("rejects invalid settings.foreground type", () => {
    const result = validateThemeObject({
      name: "Test",
      type: "dark",
      tokenColors: [{ settings: { foreground: 123 } }],
    })
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors.some(e => e.includes("foreground"))).toBe(true)
    }
  })

  it("rejects invalid scope type", () => {
    const result = validateThemeObject({
      name: "Test",
      type: "dark",
      tokenColors: [{ scope: 123, settings: {} }],
    })
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors.some(e => e.includes("scope"))).toBe(true)
    }
  })

  it("accepts scope as array of strings", () => {
    const result = validateThemeObject({
      name: "Test",
      type: "dark",
      tokenColors: [{ scope: ["comment", "string"], settings: {} }],
    })
    expect(result.valid).toBe(true)
  })

  it("rejects scope array with non-strings", () => {
    const result = validateThemeObject({
      name: "Test",
      type: "dark",
      tokenColors: [{ scope: ["comment", 123], settings: {} }],
    })
    expect(result.valid).toBe(false)
  })

  it("rejects invalid semanticHighlighting type", () => {
    const result = validateThemeObject({
      name: "Test",
      type: "dark",
      semanticHighlighting: "yes",
    })
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors.some(e => e.includes("semanticHighlighting"))).toBe(true)
    }
  })

  it("rejects invalid semanticTokenColors type", () => {
    const result = validateThemeObject({
      name: "Test",
      type: "dark",
      semanticTokenColors: [],
    })
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors.some(e => e.includes("semanticTokenColors"))).toBe(true)
    }
  })
})

describe("getColor", () => {
  const theme: VSCodeTheme = {
    name: "Test",
    type: "dark",
    colors: {
      "editor.background": "#1e1e1e",
      "editor.foreground": "#d4d4d4",
    },
    tokenColors: [],
  }

  it("returns existing color", () => {
    expect(getColor(theme, "editor.background")).toBe("#1e1e1e")
  })

  it("returns undefined for missing color", () => {
    expect(getColor(theme, "nonexistent.color")).toBeUndefined()
  })
})

describe("getTokenColorsForScope", () => {
  const theme: VSCodeTheme = {
    name: "Test",
    type: "dark",
    colors: {},
    tokenColors: [
      { scope: "comment", settings: { foreground: "#999" } },
      { scope: ["string", "string.quoted"], settings: { foreground: "#ce9178" } },
      { scope: "comment.line", settings: { foreground: "#888" } },
      { settings: { foreground: "#ddd" } }, // Default colors, no scope
    ],
  }

  it("finds token color by exact scope match", () => {
    const result = getTokenColorsForScope(theme, "comment")
    expect(result).toHaveLength(1)
    expect(result[0].settings.foreground).toBe("#999")
  })

  it("finds token color by hierarchical scope match", () => {
    const result = getTokenColorsForScope(theme, "comment.line.double-slash")
    // Both "comment" and "comment.line" match the scope "comment.line.double-slash"
    expect(result).toHaveLength(2)
    expect(result.some(tc => tc.settings.foreground === "#888")).toBe(true)
    expect(result.some(tc => tc.settings.foreground === "#999")).toBe(true)
  })

  it("finds token color in array scope", () => {
    const result = getTokenColorsForScope(theme, "string")
    expect(result).toHaveLength(1)
  })

  it("returns empty array for no match", () => {
    const result = getTokenColorsForScope(theme, "variable")
    expect(result).toHaveLength(0)
  })

  it("skips entries without scope", () => {
    const result = getTokenColorsForScope(theme, "keyword")
    expect(result).toHaveLength(0)
  })
})

describe("getForegroundForScope", () => {
  const theme: VSCodeTheme = {
    name: "Test",
    type: "dark",
    colors: {},
    tokenColors: [
      { scope: "comment", settings: { foreground: "#999" } },
      { scope: "comment.block", settings: { fontStyle: "italic" } }, // No foreground
    ],
  }

  it("returns foreground color for matching scope", () => {
    expect(getForegroundForScope(theme, "comment")).toBe("#999")
  })

  it("returns foreground from parent scope when child has no foreground", () => {
    // "comment.block" matches both "comment" and "comment.block"
    // Since "comment.block" has no foreground, it falls through to "comment" which does
    expect(getForegroundForScope(theme, "comment.block")).toBe("#999")
  })

  it("returns undefined for no match", () => {
    expect(getForegroundForScope(theme, "variable")).toBeUndefined()
  })
})

describe("isDarkTheme", () => {
  it("returns true for dark theme", () => {
    expect(isDarkTheme({ name: "Test", type: "dark", colors: {}, tokenColors: [] })).toBe(true)
  })

  it("returns true for hcDark theme", () => {
    expect(isDarkTheme({ name: "Test", type: "hcDark", colors: {}, tokenColors: [] })).toBe(true)
  })

  it("returns false for light theme", () => {
    expect(isDarkTheme({ name: "Test", type: "light", colors: {}, tokenColors: [] })).toBe(false)
  })

  it("returns false for hcLight theme", () => {
    expect(isDarkTheme({ name: "Test", type: "hcLight", colors: {}, tokenColors: [] })).toBe(false)
  })
})

describe("isLightTheme", () => {
  it("returns true for light theme", () => {
    expect(isLightTheme({ name: "Test", type: "light", colors: {}, tokenColors: [] })).toBe(true)
  })

  it("returns true for hcLight theme", () => {
    expect(isLightTheme({ name: "Test", type: "hcLight", colors: {}, tokenColors: [] })).toBe(true)
  })

  it("returns false for dark theme", () => {
    expect(isLightTheme({ name: "Test", type: "dark", colors: {}, tokenColors: [] })).toBe(false)
  })
})

describe("isHighContrastTheme", () => {
  it("returns true for hcDark theme", () => {
    expect(isHighContrastTheme({ name: "Test", type: "hcDark", colors: {}, tokenColors: [] })).toBe(
      true,
    )
  })

  it("returns true for hcLight theme", () => {
    expect(
      isHighContrastTheme({ name: "Test", type: "hcLight", colors: {}, tokenColors: [] }),
    ).toBe(true)
  })

  it("returns false for dark theme", () => {
    expect(isHighContrastTheme({ name: "Test", type: "dark", colors: {}, tokenColors: [] })).toBe(
      false,
    )
  })

  it("returns false for light theme", () => {
    expect(isHighContrastTheme({ name: "Test", type: "light", colors: {}, tokenColors: [] })).toBe(
      false,
    )
  })
})

describe("getEssentialColors", () => {
  it("extracts colors from dark theme", () => {
    const theme: VSCodeTheme = {
      name: "Dark Test",
      type: "dark",
      colors: {
        "editor.background": "#282828",
        "editor.foreground": "#ebdbb2",
        "button.background": "#458588",
        "editorLineNumber.foreground": "#928374",
        "panel.border": "#3c3836",
        "editor.selectionBackground": "#504945",
      },
      tokenColors: [],
    }

    const colors = getEssentialColors(theme)
    expect(colors.background).toBe("#282828")
    expect(colors.foreground).toBe("#ebdbb2")
    expect(colors.accent).toBe("#458588")
    expect(colors.muted).toBe("#928374")
    expect(colors.border).toBe("#3c3836")
    expect(colors.selection).toBe("#504945")
  })

  it("uses defaults for missing dark theme colors", () => {
    const theme: VSCodeTheme = {
      name: "Minimal Dark",
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

  it("uses defaults for missing light theme colors", () => {
    const theme: VSCodeTheme = {
      name: "Minimal Light",
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

  it("falls back to foreground if editor.foreground is missing", () => {
    const theme: VSCodeTheme = {
      name: "Test",
      type: "dark",
      colors: {
        foreground: "#cccccc",
      },
      tokenColors: [],
    }

    const colors = getEssentialColors(theme)
    expect(colors.foreground).toBe("#cccccc")
  })

  it("falls back to focusBorder if button.background is missing", () => {
    const theme: VSCodeTheme = {
      name: "Test",
      type: "dark",
      colors: {
        focusBorder: "#00ffff",
      },
      tokenColors: [],
    }

    const colors = getEssentialColors(theme)
    expect(colors.accent).toBe("#00ffff")
  })

  it("falls back to contrastBorder if panel.border is missing", () => {
    const theme: VSCodeTheme = {
      name: "Test",
      type: "dark",
      colors: {
        contrastBorder: "#666666",
      },
      tokenColors: [],
    }

    const colors = getEssentialColors(theme)
    expect(colors.border).toBe("#666666")
  })
})

describe("normalization", () => {
  it("normalizes colors by filtering non-string values", () => {
    const result = parseThemeObject({
      name: "Test",
      type: "dark",
      colors: {
        "editor.background": "#1e1e1e",
        invalid: 123,
        nullValue: null,
        objectValue: {},
      },
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.theme.colors["editor.background"]).toBe("#1e1e1e")
      expect(result.theme.colors.invalid).toBeUndefined()
      expect(result.theme.colors.nullValue).toBeUndefined()
      expect(result.theme.colors.objectValue).toBeUndefined()
    }
  })

  it("normalizes tokenColors by filtering invalid entries", () => {
    const result = parseThemeObject({
      name: "Test",
      type: "dark",
      tokenColors: [{ settings: { foreground: "#fff" } }, null, "invalid", 123],
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.theme.tokenColors).toHaveLength(1)
    }
  })

  it("normalizes semanticTokenColors with string values", () => {
    const result = parseThemeObject({
      name: "Test",
      type: "dark",
      semanticTokenColors: {
        function: "#ff0000",
        variable: { foreground: "#00ff00" },
      },
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.theme.semanticTokenColors?.function).toBe("#ff0000")
      expect(result.theme.semanticTokenColors?.variable).toEqual({ foreground: "#00ff00" })
    }
  })

  it("omits semanticTokenColors if empty", () => {
    const result = parseThemeObject({
      name: "Test",
      type: "dark",
      semanticTokenColors: {},
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.theme.semanticTokenColors).toBeUndefined()
    }
  })
})
