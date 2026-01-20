/**
 * ThemeDiscovery - Scan VS Code extensions for theme files and read settings.
 *
 * This server-side class handles:
 * - Scanning ~/.vscode/extensions for theme extensions
 * - Reading VS Code settings.json to get the current theme
 * - Providing theme metadata for the ThemePicker component
 */

import { readdir, readFile, stat } from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import type { ThemeMeta } from "../src/lib/theme/types.js"

/**
 * VS Code extension package.json structure for theme contributions.
 */
interface ExtensionPackageJson {
  name: string
  displayName?: string
  publisher?: string
  contributes?: {
    themes?: Array<{
      label: string
      uiTheme: "vs" | "vs-dark" | "hc-black" | "hc-light"
      path: string
    }>
  }
}

/**
 * VS Code settings.json structure (partial).
 */
interface VSCodeSettings {
  "workbench.colorTheme"?: string
  "workbench.preferredDarkColorTheme"?: string
  "workbench.preferredLightColorTheme"?: string
}

/**
 * Map VS Code uiTheme values to our theme type system.
 */
function mapUiThemeToType(uiTheme: string): ThemeMeta["type"] {
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
      return "dark" // Default to dark for unknown values
  }
}

/**
 * Supported VS Code variants and their settings paths.
 * Order matters - first match wins.
 */
const VSCODE_VARIANTS = [
  {
    name: "VS Code",
    settingsPath: "Code/User/settings.json",
    extensionsDir: ".vscode/extensions",
  },
  {
    name: "VS Code Insiders",
    settingsPath: "Code - Insiders/User/settings.json",
    extensionsDir: ".vscode-insiders/extensions",
  },
  {
    name: "Cursor",
    settingsPath: "Cursor/User/settings.json",
    extensionsDir: ".cursor/extensions",
  },
  {
    name: "VSCodium",
    settingsPath: "VSCodium/User/settings.json",
    extensionsDir: ".vscode-oss/extensions",
  },
] as const

/**
 * Get the Application Support directory path based on platform.
 */
function getAppSupportPath(): string {
  const homeDir = os.homedir()
  switch (process.platform) {
    case "darwin":
      return path.join(homeDir, "Library", "Application Support")
    case "win32":
      return process.env.APPDATA || path.join(homeDir, "AppData", "Roaming")
    case "linux":
    default:
      return path.join(homeDir, ".config")
  }
}

/**
 * ThemeDiscovery class for scanning VS Code installations and themes.
 */
export class ThemeDiscovery {
  private settingsPath: string | null = null
  private extensionsDir: string | null = null
  private variantName: string | null = null

  /**
   * Initialize the ThemeDiscovery by finding a valid VS Code installation.
   * Returns true if a valid installation was found.
   */
  async initialize(): Promise<boolean> {
    const appSupport = getAppSupportPath()
    const homeDir = os.homedir()

    for (const variant of VSCODE_VARIANTS) {
      const settingsPath = path.join(appSupport, variant.settingsPath)
      const extensionsDir = path.join(homeDir, variant.extensionsDir)

      // Check if settings file exists
      try {
        await stat(settingsPath)
        await stat(extensionsDir)
        this.settingsPath = settingsPath
        this.extensionsDir = extensionsDir
        this.variantName = variant.name
        return true
      } catch {
        // This variant doesn't exist, try the next one
        continue
      }
    }

    return false
  }

  /**
   * Get the name of the detected VS Code variant.
   */
  getVariantName(): string | null {
    return this.variantName
  }

  /**
   * Get the current theme name from VS Code settings.
   * Returns null if settings cannot be read.
   */
  async getCurrentTheme(): Promise<string | null> {
    if (!this.settingsPath) {
      return null
    }

    try {
      const content = await readFile(this.settingsPath, "utf-8")
      // VS Code settings can have comments (JSONC), so we need to strip them
      const cleanedContent = stripJsonComments(content)
      const settings = JSON.parse(cleanedContent) as VSCodeSettings
      return settings["workbench.colorTheme"] ?? null
    } catch {
      return null
    }
  }

  /**
   * Get the preferred dark theme from VS Code settings.
   */
  async getPreferredDarkTheme(): Promise<string | null> {
    if (!this.settingsPath) {
      return null
    }

    try {
      const content = await readFile(this.settingsPath, "utf-8")
      const cleanedContent = stripJsonComments(content)
      const settings = JSON.parse(cleanedContent) as VSCodeSettings
      return settings["workbench.preferredDarkColorTheme"] ?? null
    } catch {
      return null
    }
  }

  /**
   * Get the preferred light theme from VS Code settings.
   */
  async getPreferredLightTheme(): Promise<string | null> {
    if (!this.settingsPath) {
      return null
    }

    try {
      const content = await readFile(this.settingsPath, "utf-8")
      const cleanedContent = stripJsonComments(content)
      const settings = JSON.parse(cleanedContent) as VSCodeSettings
      return settings["workbench.preferredLightColorTheme"] ?? null
    } catch {
      return null
    }
  }

  /**
   * Scan all VS Code extensions and discover available themes.
   * Returns an array of ThemeMeta objects.
   */
  async discoverThemes(): Promise<ThemeMeta[]> {
    if (!this.extensionsDir) {
      return []
    }

    const themes: ThemeMeta[] = []

    try {
      const entries = await readdir(this.extensionsDir, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue
        }

        // Skip hidden directories and the .obsolete file
        if (entry.name.startsWith(".")) {
          continue
        }

        const extensionPath = path.join(this.extensionsDir, entry.name)
        const extensionThemes = await this.scanExtension(extensionPath, entry.name)
        themes.push(...extensionThemes)
      }
    } catch {
      // Extensions directory doesn't exist or can't be read
      return []
    }

    // Sort themes by label
    return themes.sort((a, b) => a.label.localeCompare(b.label))
  }

  /**
   * Scan a single extension directory for theme contributions.
   */
  private async scanExtension(extensionPath: string, _extensionName: string): Promise<ThemeMeta[]> {
    const themes: ThemeMeta[] = []
    const packageJsonPath = path.join(extensionPath, "package.json")

    try {
      const content = await readFile(packageJsonPath, "utf-8")
      const packageJson = JSON.parse(content) as ExtensionPackageJson

      const contributedThemes = packageJson.contributes?.themes
      if (!contributedThemes || !Array.isArray(contributedThemes)) {
        return []
      }

      for (const theme of contributedThemes) {
        const themePath = path.join(extensionPath, theme.path)

        // Verify the theme file exists
        try {
          await stat(themePath)
        } catch {
          // Theme file doesn't exist, skip it
          continue
        }

        // Create a unique ID: extensionId/themeLabel
        const extensionId = `${packageJson.publisher || "local"}.${packageJson.name}`
        const id = `${extensionId}/${theme.label}`

        themes.push({
          id,
          label: theme.label,
          type: mapUiThemeToType(theme.uiTheme),
          path: themePath,
          extensionId,
          extensionName: packageJson.displayName || packageJson.name,
        })
      }
    } catch {
      // Invalid package.json or no themes - skip this extension
    }

    return themes
  }

  /**
   * Read a theme file and return its JSON content.
   * Returns null if the file cannot be read.
   */
  async readThemeFile(themePath: string): Promise<unknown | null> {
    try {
      const content = await readFile(themePath, "utf-8")
      // Theme files are usually valid JSON, but some may have comments
      const cleanedContent = stripJsonComments(content)
      return JSON.parse(cleanedContent)
    } catch {
      return null
    }
  }

  /**
   * Find a theme by its label (the name shown in VS Code).
   * Returns null if not found.
   */
  async findThemeByLabel(label: string): Promise<ThemeMeta | null> {
    const themes = await this.discoverThemes()
    return themes.find(t => t.label === label) ?? null
  }

  /**
   * Find a theme by its ID.
   * Returns null if not found.
   */
  async findThemeById(id: string): Promise<ThemeMeta | null> {
    const themes = await this.discoverThemes()
    return themes.find(t => t.id === id) ?? null
  }
}

/**
 * Strip JSON comments from a string.
 * Handles both single-line (//) and multi-line (/* * /) comments.
 * Preserves strings that contain // or /* characters.
 */
export function stripJsonComments(json: string): string {
  let result = ""
  let inString = false
  let inSingleComment = false
  let inMultiComment = false
  let i = 0

  while (i < json.length) {
    const char = json[i]
    const nextChar = json[i + 1]

    // Handle string state
    if (!inSingleComment && !inMultiComment) {
      if (char === '"' && json[i - 1] !== "\\") {
        inString = !inString
        result += char
        i++
        continue
      }
    }

    // If we're in a string, just copy characters
    if (inString) {
      result += char
      i++
      continue
    }

    // Handle comment start
    if (!inSingleComment && !inMultiComment) {
      if (char === "/" && nextChar === "/") {
        inSingleComment = true
        i += 2
        continue
      }
      if (char === "/" && nextChar === "*") {
        inMultiComment = true
        i += 2
        continue
      }
    }

    // Handle single-line comment end
    if (inSingleComment) {
      if (char === "\n") {
        inSingleComment = false
        result += char // Keep the newline
      }
      i++
      continue
    }

    // Handle multi-line comment end
    if (inMultiComment) {
      if (char === "*" && nextChar === "/") {
        inMultiComment = false
        i += 2
        continue
      }
      i++
      continue
    }

    // Regular character
    result += char
    i++
  }

  return result
}

/**
 * Singleton instance of ThemeDiscovery.
 */
let themeDiscoveryInstance: ThemeDiscovery | null = null

/**
 * Get the singleton ThemeDiscovery instance, initializing it if needed.
 */
export async function getThemeDiscovery(): Promise<ThemeDiscovery> {
  if (!themeDiscoveryInstance) {
    themeDiscoveryInstance = new ThemeDiscovery()
    await themeDiscoveryInstance.initialize()
  }
  return themeDiscoveryInstance
}

/**
 * Reset the ThemeDiscovery singleton (for testing).
 */
export function resetThemeDiscovery(): void {
  themeDiscoveryInstance = null
}
