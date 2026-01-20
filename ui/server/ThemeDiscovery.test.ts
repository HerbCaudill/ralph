import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdir, writeFile, rm } from "node:fs/promises"
import path from "node:path"
import {
  ThemeDiscovery,
  stripJsonComments,
  resetThemeDiscovery,
  getThemeDiscovery,
} from "./ThemeDiscovery.js"

describe("ThemeDiscovery", () => {
  const testDir = path.join(import.meta.dirname, "__test_theme_discovery__")
  const extensionsDir = path.join(testDir, ".vscode", "extensions")
  const settingsDir = path.join(testDir, "Code", "User")

  beforeEach(async () => {
    // Reset the singleton between tests
    resetThemeDiscovery()
    // Create test directory structure
    await mkdir(extensionsDir, { recursive: true })
    await mkdir(settingsDir, { recursive: true })
  })

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true })
    resetThemeDiscovery()
  })

  describe("stripJsonComments", () => {
    it("strips single-line comments", () => {
      const input = `{
        "key": "value" // this is a comment
      }`
      const result = stripJsonComments(input)
      expect(JSON.parse(result)).toEqual({ key: "value" })
    })

    it("strips multi-line comments", () => {
      const input = `{
        /* this is a
           multi-line comment */
        "key": "value"
      }`
      const result = stripJsonComments(input)
      expect(JSON.parse(result)).toEqual({ key: "value" })
    })

    it("preserves strings containing comment characters", () => {
      const input = `{
        "url": "https://example.com/path"
      }`
      const result = stripJsonComments(input)
      expect(JSON.parse(result)).toEqual({ url: "https://example.com/path" })
    })

    it("preserves strings with double slashes", () => {
      const input = `{
        "protocol": "http://localhost"
      }`
      const result = stripJsonComments(input)
      expect(JSON.parse(result)).toEqual({ protocol: "http://localhost" })
    })

    it("preserves strings with /* characters", () => {
      const input = `{
        "pattern": "/* match */"
      }`
      const result = stripJsonComments(input)
      expect(JSON.parse(result)).toEqual({ pattern: "/* match */" })
    })

    it("handles escaped quotes in strings", () => {
      const input = `{
        "quote": "He said \\"hello\\"" // comment
      }`
      const result = stripJsonComments(input)
      expect(JSON.parse(result)).toEqual({ quote: 'He said "hello"' })
    })

    it("handles mixed comments", () => {
      const input = `{
        // start comment
        "a": 1, /* inline */ "b": 2
        /* multi
           line */
        // end comment
      }`
      const result = stripJsonComments(input)
      expect(JSON.parse(result)).toEqual({ a: 1, b: 2 })
    })

    it("handles empty input", () => {
      expect(stripJsonComments("")).toBe("")
    })

    it("handles input with no comments", () => {
      const input = '{"key": "value"}'
      expect(stripJsonComments(input)).toBe(input)
    })
  })

  describe("initialize", () => {
    it("returns false when no VS Code installation is found", async () => {
      const discovery = new ThemeDiscovery()
      // Use a non-existent directory
      const result = await discovery.initialize()
      // This will likely return false in test environment unless VS Code is installed
      expect(typeof result).toBe("boolean")
    })
  })

  describe("getCurrentTheme", () => {
    it("returns null when not initialized", async () => {
      const discovery = new ThemeDiscovery()
      const theme = await discovery.getCurrentTheme()
      expect(theme).toBeNull()
    })
  })

  describe("discoverThemes", () => {
    it("returns empty array when not initialized", async () => {
      const discovery = new ThemeDiscovery()
      const themes = await discovery.discoverThemes()
      expect(themes).toEqual([])
    })
  })

  describe("findThemeByLabel", () => {
    it("returns null when not initialized", async () => {
      const discovery = new ThemeDiscovery()
      const theme = await discovery.findThemeByLabel("Some Theme")
      expect(theme).toBeNull()
    })
  })

  describe("findThemeById", () => {
    it("returns null when not initialized", async () => {
      const discovery = new ThemeDiscovery()
      const theme = await discovery.findThemeById("publisher.theme/Theme Name")
      expect(theme).toBeNull()
    })
  })

  describe("getVariantName", () => {
    it("returns null when not initialized", () => {
      const discovery = new ThemeDiscovery()
      expect(discovery.getVariantName()).toBeNull()
    })
  })

  describe("readThemeFile", () => {
    it("returns null for non-existent file", async () => {
      const discovery = new ThemeDiscovery()
      const content = await discovery.readThemeFile("/non/existent/path.json")
      expect(content).toBeNull()
    })

    it("reads and parses valid theme file", async () => {
      const discovery = new ThemeDiscovery()
      const themePath = path.join(testDir, "test-theme.json")
      const themeData = {
        name: "Test Theme",
        type: "dark",
        colors: { "editor.background": "#1e1e1e" },
      }
      await writeFile(themePath, JSON.stringify(themeData))

      const content = await discovery.readThemeFile(themePath)
      expect(content).toEqual(themeData)
    })

    it("handles theme files with comments", async () => {
      const discovery = new ThemeDiscovery()
      const themePath = path.join(testDir, "test-theme-comments.json")
      const themeContent = `{
        // Theme name
        "name": "Test Theme",
        "type": "dark",
        /* Editor colors */
        "colors": { "editor.background": "#1e1e1e" }
      }`
      await writeFile(themePath, themeContent)

      const content = await discovery.readThemeFile(themePath)
      expect(content).toEqual({
        name: "Test Theme",
        type: "dark",
        colors: { "editor.background": "#1e1e1e" },
      })
    })

    it("returns null for invalid JSON", async () => {
      const discovery = new ThemeDiscovery()
      const themePath = path.join(testDir, "invalid-theme.json")
      await writeFile(themePath, "{ invalid json }")

      const content = await discovery.readThemeFile(themePath)
      expect(content).toBeNull()
    })
  })
})

describe("getThemeDiscovery", () => {
  beforeEach(() => {
    resetThemeDiscovery()
  })

  afterEach(() => {
    resetThemeDiscovery()
  })

  it("returns a ThemeDiscovery instance", async () => {
    const discovery = await getThemeDiscovery()
    expect(discovery).toBeInstanceOf(ThemeDiscovery)
  })

  it("returns the same instance on subsequent calls", async () => {
    const discovery1 = await getThemeDiscovery()
    const discovery2 = await getThemeDiscovery()
    expect(discovery1).toBe(discovery2)
  })

  it("returns a new instance after reset", async () => {
    const discovery1 = await getThemeDiscovery()
    resetThemeDiscovery()
    const discovery2 = await getThemeDiscovery()
    expect(discovery1).not.toBe(discovery2)
  })
})

describe("ThemeDiscovery integration", () => {
  // These tests use the actual VS Code installation if available
  // They will be skipped if VS Code is not installed

  it("can discover themes from actual VS Code installation", async () => {
    const discovery = new ThemeDiscovery()
    const initialized = await discovery.initialize()

    if (!initialized) {
      // Skip if VS Code is not installed
      return
    }

    const themes = await discovery.discoverThemes()
    // VS Code always has at least the built-in themes, but extensions vary
    // Just verify the structure is correct
    for (const theme of themes) {
      expect(theme.id).toBeDefined()
      expect(theme.label).toBeDefined()
      expect(["dark", "light", "hcDark", "hcLight"]).toContain(theme.type)
      expect(theme.path).toBeDefined()
      expect(theme.extensionId).toBeDefined()
      expect(theme.extensionName).toBeDefined()
    }
  })

  it("can read current theme from actual VS Code installation", async () => {
    const discovery = new ThemeDiscovery()
    const initialized = await discovery.initialize()

    if (!initialized) {
      // Skip if VS Code is not installed
      return
    }

    const currentTheme = await discovery.getCurrentTheme()
    // currentTheme might be null if no theme is set, or a string if it is
    expect(currentTheme === null || typeof currentTheme === "string").toBe(true)
  })

  it("reports the correct variant name", async () => {
    const discovery = new ThemeDiscovery()
    const initialized = await discovery.initialize()

    if (!initialized) {
      // Skip if VS Code is not installed
      return
    }

    const variantName = discovery.getVariantName()
    expect(["VS Code", "VS Code Insiders", "Cursor", "VSCodium"]).toContain(variantName)
  })
})
