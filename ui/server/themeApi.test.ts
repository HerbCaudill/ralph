import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { createServer, type Server } from "node:http"
import { mkdir, writeFile, rm } from "node:fs/promises"
import path from "node:path"
import express, { type Express, type Request, type Response } from "express"
import { ThemeDiscovery, resetThemeDiscovery } from "./ThemeDiscovery.js"
import { parseThemeObject } from "../src/lib/theme/parser.js"
import { mapThemeToCSSVariables, createAppTheme } from "../src/lib/theme/mapper.js"
import type { ThemeMeta, AppTheme } from "../src/lib/theme/types.js"
import type { CSSVariables } from "../src/lib/theme/mapper.js"

// Response types for the theme API
interface ThemeListResponse {
  ok: boolean
  themes: ThemeMeta[]
  currentTheme: string | null
  variant: string | null
  error?: string
}

interface ThemeDetailResponse {
  ok: boolean
  theme?: AppTheme
  cssVariables?: CSSVariables
  error?: string
}

// Create test app with theme endpoints
function createTestApp(getDiscovery: () => Promise<ThemeDiscovery>): Express {
  const app = express()
  app.use(express.json())

  app.get("/api/themes", async (_req: Request, res: Response) => {
    try {
      const themeDiscovery = await getDiscovery()
      const themes = await themeDiscovery.discoverThemes()
      const currentTheme = await themeDiscovery.getCurrentTheme()

      res.status(200).json({
        ok: true,
        themes,
        currentTheme,
        variant: themeDiscovery.getVariantName(),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to list themes"
      res.status(500).json({ ok: false, error: message })
    }
  })

  app.get("/api/themes/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params as { id: string }
      const decodedId = decodeURIComponent(id)

      const themeDiscovery = await getDiscovery()
      const themeMeta = await themeDiscovery.findThemeById(decodedId)

      if (!themeMeta) {
        res.status(404).json({ ok: false, error: "Theme not found" })
        return
      }

      // Read and parse the theme file
      const themeData = await themeDiscovery.readThemeFile(themeMeta.path)
      if (!themeData) {
        res.status(500).json({ ok: false, error: "Failed to read theme file" })
        return
      }

      const parseResult = parseThemeObject(themeData)
      if (!parseResult.success) {
        res.status(500).json({ ok: false, error: `Failed to parse theme: ${parseResult.error}` })
        return
      }

      // Map to CSS variables and create app theme
      const cssVariables = mapThemeToCSSVariables(parseResult.theme)
      const appTheme = createAppTheme(parseResult.theme, themeMeta)

      res.status(200).json({
        ok: true,
        theme: appTheme,
        cssVariables,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to get theme"
      res.status(500).json({ ok: false, error: message })
    }
  })

  return app
}

/**
 * Helper to create a mock ThemeDiscovery that reads from a test directory
 */
class MockThemeDiscovery extends ThemeDiscovery {
  private mockExtensionsDir: string
  private mockSettingsPath: string | null = null
  private initialized = false

  constructor(extensionsDir: string, settingsPath?: string) {
    super()
    this.mockExtensionsDir = extensionsDir
    this.mockSettingsPath = settingsPath ?? null
  }

  async initialize(): Promise<boolean> {
    this.initialized = true
    return true
  }

  getVariantName(): string | null {
    return this.initialized ? "Mock VS Code" : null
  }

  async getCurrentTheme(): Promise<string | null> {
    if (!this.mockSettingsPath) return null
    try {
      const { readFile } = await import("node:fs/promises")
      const content = await readFile(this.mockSettingsPath, "utf-8")
      const settings = JSON.parse(content)
      return settings["workbench.colorTheme"] ?? null
    } catch {
      return null
    }
  }

  async discoverThemes() {
    if (!this.initialized) return []

    const { readdir, readFile, stat } = await import("node:fs/promises")
    const themes: Awaited<ReturnType<ThemeDiscovery["discoverThemes"]>> = []

    try {
      const entries = await readdir(this.mockExtensionsDir, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith(".")) continue

        const extensionPath = path.join(this.mockExtensionsDir, entry.name)
        const packageJsonPath = path.join(extensionPath, "package.json")

        try {
          const content = await readFile(packageJsonPath, "utf-8")
          const packageJson = JSON.parse(content)

          const contributedThemes = packageJson.contributes?.themes
          if (!contributedThemes || !Array.isArray(contributedThemes)) continue

          for (const theme of contributedThemes) {
            const themePath = path.join(extensionPath, theme.path)

            try {
              await stat(themePath)
            } catch {
              continue
            }

            const extensionId = `${packageJson.publisher || "local"}.${packageJson.name}`
            const id = `${extensionId}/${theme.label}`

            themes.push({
              id,
              label: theme.label,
              type: this.mapUiThemeToType(theme.uiTheme),
              path: themePath,
              extensionId,
              extensionName: packageJson.displayName || packageJson.name,
            })
          }
        } catch {
          // Skip invalid extensions
        }
      }
    } catch {
      return []
    }

    return themes.sort((a, b) => a.label.localeCompare(b.label))
  }

  private mapUiThemeToType(uiTheme: string): "dark" | "light" | "hcDark" | "hcLight" {
    switch (uiTheme) {
      case "vs":
        return "light"
      case "vs-dark":
        return "dark"
      case "hc-black":
        return "hcDark"
      case "hc-light":
        return "hcLight"
      default:
        return "dark"
    }
  }
}

describe("Theme API endpoints", () => {
  const testDir = path.join(import.meta.dirname, "__test_theme_api__")
  const extensionsDir = path.join(testDir, "extensions")
  const settingsPath = path.join(testDir, "settings.json")

  let server: Server
  let mockDiscovery: MockThemeDiscovery
  const port = 3099 // Use a unique port for theme API tests

  beforeAll(async () => {
    // Create test directory structure
    await mkdir(extensionsDir, { recursive: true })

    // Create a mock theme extension
    const mockExtDir = path.join(extensionsDir, "test-publisher.test-theme-1.0.0")
    const mockThemesDir = path.join(mockExtDir, "themes")
    await mkdir(mockThemesDir, { recursive: true })

    // Create package.json
    await writeFile(
      path.join(mockExtDir, "package.json"),
      JSON.stringify({
        name: "test-theme",
        displayName: "Test Theme Extension",
        publisher: "test-publisher",
        contributes: {
          themes: [
            {
              label: "Test Dark Theme",
              uiTheme: "vs-dark",
              path: "./themes/dark.json",
            },
            {
              label: "Test Light Theme",
              uiTheme: "vs",
              path: "./themes/light.json",
            },
          ],
        },
      }),
    )

    // Create dark theme file
    await writeFile(
      path.join(mockThemesDir, "dark.json"),
      JSON.stringify({
        name: "Test Dark Theme",
        type: "dark",
        colors: {
          "editor.background": "#1e1e1e",
          "editor.foreground": "#d4d4d4",
          "terminal.ansiGreen": "#4ec9b0",
          "terminal.ansiYellow": "#dcdcaa",
          "terminal.ansiRed": "#f44747",
          "terminal.ansiBlue": "#569cd6",
        },
        tokenColors: [],
      }),
    )

    // Create light theme file
    await writeFile(
      path.join(mockThemesDir, "light.json"),
      JSON.stringify({
        name: "Test Light Theme",
        type: "light",
        colors: {
          "editor.background": "#ffffff",
          "editor.foreground": "#333333",
          "terminal.ansiGreen": "#22863a",
          "terminal.ansiYellow": "#b08800",
          "terminal.ansiRed": "#cb2431",
          "terminal.ansiBlue": "#0366d6",
        },
        tokenColors: [],
      }),
    )

    // Create settings.json
    await writeFile(
      settingsPath,
      JSON.stringify({
        "workbench.colorTheme": "Test Dark Theme",
      }),
    )

    // Create mock discovery
    mockDiscovery = new MockThemeDiscovery(extensionsDir, settingsPath)
    await mockDiscovery.initialize()

    // Create and start server
    const app = createTestApp(async () => mockDiscovery)
    server = createServer(app)

    await new Promise<void>(resolve => {
      server.listen(port, "localhost", () => resolve())
    })
  })

  afterAll(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true })
    resetThemeDiscovery()

    // Close server
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Server close timeout"))
      }, 5000)
      server.close(err => {
        clearTimeout(timeout)
        if (err) reject(err)
        else resolve()
      })
    })
  })

  describe("GET /api/themes", () => {
    it("returns list of available themes", async () => {
      const response = await fetch(`http://localhost:${port}/api/themes`)
      const data = (await response.json()) as ThemeListResponse

      expect(response.status).toBe(200)
      expect(data.ok).toBe(true)
      expect(Array.isArray(data.themes)).toBe(true)
      expect(data.themes.length).toBe(2)

      // Check theme structure
      const darkTheme = data.themes.find(t => t.label === "Test Dark Theme")
      expect(darkTheme).toBeDefined()
      expect(darkTheme!.id).toBe("test-publisher.test-theme/Test Dark Theme")
      expect(darkTheme!.type).toBe("dark")
      expect(darkTheme!.extensionId).toBe("test-publisher.test-theme")
      expect(darkTheme!.extensionName).toBe("Test Theme Extension")

      const lightTheme = data.themes.find(t => t.label === "Test Light Theme")
      expect(lightTheme).toBeDefined()
      expect(lightTheme!.type).toBe("light")
    })

    it("returns current theme name", async () => {
      const response = await fetch(`http://localhost:${port}/api/themes`)
      const data = (await response.json()) as ThemeListResponse

      expect(data.currentTheme).toBe("Test Dark Theme")
    })

    it("returns VS Code variant name", async () => {
      const response = await fetch(`http://localhost:${port}/api/themes`)
      const data = (await response.json()) as ThemeListResponse

      expect(data.variant).toBe("Mock VS Code")
    })
  })

  describe("GET /api/themes/:id", () => {
    it("returns theme details with CSS variables", async () => {
      const themeId = encodeURIComponent("test-publisher.test-theme/Test Dark Theme")
      const response = await fetch(`http://localhost:${port}/api/themes/${themeId}`)
      const data = (await response.json()) as ThemeDetailResponse

      expect(response.status).toBe(200)
      expect(data.ok).toBe(true)

      // Check theme structure
      expect(data.theme).toBeDefined()
      expect(data.theme!.meta.label).toBe("Test Dark Theme")
      expect(data.theme!.meta.type).toBe("dark")

      // Check status colors are extracted
      expect(data.theme!.statusColors).toBeDefined()
      expect(data.theme!.statusColors.success).toBe("#4ec9b0")
      expect(data.theme!.statusColors.warning).toBe("#dcdcaa")
      expect(data.theme!.statusColors.error).toBe("#f44747")
      expect(data.theme!.statusColors.info).toBe("#569cd6")

      // Check CSS variables
      expect(data.cssVariables).toBeDefined()
      expect(data.cssVariables!["--background"]).toBe("#1e1e1e")
      expect(data.cssVariables!["--foreground"]).toBe("#d4d4d4")
      expect(data.cssVariables!["--status-success"]).toBe("#4ec9b0")
    })

    it("returns 404 for non-existent theme", async () => {
      const themeId = encodeURIComponent("non-existent/theme")
      const response = await fetch(`http://localhost:${port}/api/themes/${themeId}`)
      const data = (await response.json()) as ThemeDetailResponse

      expect(response.status).toBe(404)
      expect(data.ok).toBe(false)
      expect(data.error).toBe("Theme not found")
    })

    it("handles URL-encoded theme IDs correctly", async () => {
      // Theme ID contains a slash which needs encoding
      const themeId = encodeURIComponent("test-publisher.test-theme/Test Light Theme")
      const response = await fetch(`http://localhost:${port}/api/themes/${themeId}`)
      const data = (await response.json()) as ThemeDetailResponse

      expect(response.status).toBe(200)
      expect(data.ok).toBe(true)
      expect(data.theme!.meta.label).toBe("Test Light Theme")
      expect(data.theme!.meta.type).toBe("light")
    })

    it("returns colors for light theme", async () => {
      const themeId = encodeURIComponent("test-publisher.test-theme/Test Light Theme")
      const response = await fetch(`http://localhost:${port}/api/themes/${themeId}`)
      const data = (await response.json()) as ThemeDetailResponse

      expect(response.status).toBe(200)
      expect(data.cssVariables!["--background"]).toBe("#ffffff")
      expect(data.cssVariables!["--foreground"]).toBe("#333333")
    })
  })
})

describe("Theme API with uninitialized discovery", () => {
  const testDir = path.join(import.meta.dirname, "__test_theme_api_empty__")

  let server: Server
  let mockDiscovery: MockThemeDiscovery
  const port = 3100 // Use a different port

  beforeAll(async () => {
    await mkdir(testDir, { recursive: true })

    // Create discovery but don't initialize (empty extensions dir)
    mockDiscovery = new MockThemeDiscovery(path.join(testDir, "empty-extensions"))

    const app = createTestApp(async () => mockDiscovery)
    server = createServer(app)

    await new Promise<void>(resolve => {
      server.listen(port, "localhost", () => resolve())
    })
  })

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true })

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Server close timeout"))
      }, 5000)
      server.close(err => {
        clearTimeout(timeout)
        if (err) reject(err)
        else resolve()
      })
    })
  })

  it("returns empty themes array when discovery is not initialized", async () => {
    const response = await fetch(`http://localhost:${port}/api/themes`)
    const data = (await response.json()) as ThemeListResponse

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.themes).toEqual([])
    expect(data.currentTheme).toBeNull()
  })
})
