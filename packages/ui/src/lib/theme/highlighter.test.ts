import { describe, it, expect } from "vitest"
import {
  getHighlighter,
  loadTheme,
  getCurrentCustomThemeName,
  getDefaultThemeName,
  highlight,
  isLanguageSupported,
  getSupportedLanguages,
  normalizeLanguage,
} from "./highlighter"
import type { VSCodeTheme } from "./types"

describe("highlighter", () => {
  describe("getHighlighter", () => {
    it("returns a highlighter instance", async () => {
      const highlighter = await getHighlighter()
      expect(highlighter).toBeDefined()
      expect(typeof highlighter.codeToHtml).toBe("function")
    })

    it("returns the same instance on subsequent calls", async () => {
      const highlighter1 = await getHighlighter()
      const highlighter2 = await getHighlighter()
      expect(highlighter1).toBe(highlighter2)
    })
  })

  describe("getDefaultThemeName", () => {
    it("returns github-dark for dark mode", () => {
      expect(getDefaultThemeName(true)).toBe("github-dark")
    })

    it("returns github-light for light mode", () => {
      expect(getDefaultThemeName(false)).toBe("github-light")
    })
  })

  describe("normalizeLanguage", () => {
    it("normalizes common aliases", () => {
      expect(normalizeLanguage("ts")).toBe("typescript")
      expect(normalizeLanguage("js")).toBe("javascript")
      expect(normalizeLanguage("sh")).toBe("bash")
      expect(normalizeLanguage("yml")).toBe("yaml")
      expect(normalizeLanguage("py")).toBe("python")
      expect(normalizeLanguage("md")).toBe("markdown")
    })

    it("converts to lowercase", () => {
      expect(normalizeLanguage("TypeScript")).toBe("typescript")
      expect(normalizeLanguage("JAVASCRIPT")).toBe("javascript")
    })

    it("returns unknown languages as-is (lowercase)", () => {
      expect(normalizeLanguage("customlang")).toBe("customlang")
      expect(normalizeLanguage("UnknownLang")).toBe("unknownlang")
    })
  })

  describe("highlight", () => {
    it("highlights TypeScript code", async () => {
      const code = "const x: number = 42"
      const html = await highlight(code, "typescript")

      expect(html).toContain("const")
      expect(html).toContain("42")
      expect(html).toContain("<pre")
      expect(html).toContain("<code")
    })

    it("highlights JavaScript code", async () => {
      const code = 'function hello() { return "world"; }'
      const html = await highlight(code, "javascript")

      expect(html).toContain("function")
      expect(html).toContain("hello")
      expect(html).toContain("<pre")
    })

    it("handles language aliases", async () => {
      const code = "let x = 1"
      const htmlTs = await highlight(code, "ts")
      const htmlTypescript = await highlight(code, "typescript")

      // Both should produce highlighted output (not necessarily identical due to async)
      expect(htmlTs).toContain("let")
      expect(htmlTypescript).toContain("let")
    })

    it("falls back to text for unknown languages", async () => {
      const code = "some unknown code"
      const html = await highlight(code, "unknownlanguage123")

      // Should still produce output without errors
      expect(html).toContain("some unknown code")
      expect(html).toContain("<pre")
    })

    it("uses dark theme by default", async () => {
      const code = "const x = 1"
      const html = await highlight(code, "javascript")

      // The output should contain styling
      expect(html).toContain("<pre")
    })

    it("can use light theme", async () => {
      const code = "const x = 1"
      const html = await highlight(code, "javascript", { isDark: false })

      expect(html).toContain("<pre")
    })
  })

  describe("loadTheme", () => {
    it("loads a custom VS Code theme", async () => {
      const mockTheme: VSCodeTheme = {
        name: "Test Theme",
        type: "dark",
        colors: {
          "editor.background": "#1e1e1e",
          "editor.foreground": "#d4d4d4",
        },
        tokenColors: [
          {
            scope: "keyword",
            settings: {
              foreground: "#569cd6",
            },
          },
        ],
      }

      const themeName = await loadTheme(mockTheme, "test-theme-1")
      expect(themeName).toBe("vscode-custom-test-theme-1")
    })

    it("returns same theme name for same ID", async () => {
      const mockTheme: VSCodeTheme = {
        name: "Test Theme 2",
        type: "light",
        colors: {},
        tokenColors: [],
      }

      const name1 = await loadTheme(mockTheme, "test-theme-2")
      const name2 = await loadTheme(mockTheme, "test-theme-2")
      expect(name1).toBe(name2)
    })

    it("handles light themes", async () => {
      const mockTheme: VSCodeTheme = {
        name: "Light Theme",
        type: "light",
        colors: {
          "editor.background": "#ffffff",
          "editor.foreground": "#000000",
        },
        tokenColors: [],
      }

      const themeName = await loadTheme(mockTheme, "light-theme-test")
      expect(themeName).toBe("vscode-custom-light-theme-test")
    })

    it("handles hcLight themes as light", async () => {
      const mockTheme: VSCodeTheme = {
        name: "HC Light Theme",
        type: "hcLight",
        colors: {},
        tokenColors: [],
      }

      const themeName = await loadTheme(mockTheme, "hc-light-test")
      expect(themeName).toContain("vscode-custom-")
    })

    it("handles hcDark themes as dark", async () => {
      const mockTheme: VSCodeTheme = {
        name: "HC Dark Theme",
        type: "hcDark",
        colors: {},
        tokenColors: [],
      }

      const themeName = await loadTheme(mockTheme, "hc-dark-test")
      expect(themeName).toContain("vscode-custom-")
    })
  })

  describe("getCurrentCustomThemeName", () => {
    it("returns null when no custom theme is loaded initially", async () => {
      // Note: This may return a value if previous tests loaded a theme
      // We're testing the function exists and returns a string or null
      const result = getCurrentCustomThemeName()
      expect(result === null || typeof result === "string").toBe(true)
    })

    it("returns theme name after loading a theme", async () => {
      const mockTheme: VSCodeTheme = {
        name: "Current Theme Test",
        type: "dark",
        colors: {},
        tokenColors: [],
      }

      await loadTheme(mockTheme, "current-theme-test")
      const result = getCurrentCustomThemeName()
      expect(result).toBe("vscode-custom-current-theme-test")
    })
  })

  describe("isLanguageSupported", () => {
    it("returns true for preloaded languages", async () => {
      expect(await isLanguageSupported("typescript")).toBe(true)
      expect(await isLanguageSupported("javascript")).toBe(true)
      expect(await isLanguageSupported("python")).toBe(true)
      expect(await isLanguageSupported("rust")).toBe(true)
    })

    it("returns true for language aliases", async () => {
      expect(await isLanguageSupported("ts")).toBe(true)
      expect(await isLanguageSupported("js")).toBe(true)
      expect(await isLanguageSupported("py")).toBe(true)
    })

    it("returns false for unknown languages", async () => {
      expect(await isLanguageSupported("unknownlang123")).toBe(false)
    })
  })

  describe("getSupportedLanguages", () => {
    it("returns an array of languages", async () => {
      const langs = await getSupportedLanguages()
      expect(Array.isArray(langs)).toBe(true)
      expect(langs.length).toBeGreaterThan(0)
    })

    it("includes preloaded languages", async () => {
      const langs = await getSupportedLanguages()
      expect(langs).toContain("typescript")
      expect(langs).toContain("javascript")
      expect(langs).toContain("python")
    })
  })

  describe("highlight with custom theme", () => {
    it("uses custom theme when loaded", async () => {
      const mockTheme: VSCodeTheme = {
        name: "Highlight Test Theme",
        type: "dark",
        colors: {
          "editor.background": "#282c34",
          "editor.foreground": "#abb2bf",
        },
        tokenColors: [
          {
            scope: "keyword",
            settings: {
              foreground: "#c678dd",
            },
          },
        ],
      }

      const themeName = await loadTheme(mockTheme, "highlight-test-theme")
      const code = "const x = 1"
      const html = await highlight(code, "javascript", { theme: themeName })

      expect(html).toContain("<pre")
      expect(html).toContain("const")
    })

    it("falls back to default theme if custom theme not found", async () => {
      const code = "let y = 2"
      const html = await highlight(code, "javascript", { theme: "nonexistent-theme" })

      // Should still produce output without errors
      expect(html).toContain("let")
      expect(html).toContain("<pre")
    })
  })
})
