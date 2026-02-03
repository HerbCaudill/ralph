import { readdir, readFile, stat } from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import type { ThemeMeta } from "./lib/theme/types"
import { stripJsonComments } from "./lib/stripJsonComments"

/**  NLS (localization) strings for resolving placeholders like %themeLabel% */
interface NlsStrings {
  [key: string]: string
}

/**  VS Code extension package.json structure for theme contributions. */
interface ExtensionPackageJson {
  name: string
  displayName?: string
  publisher?: string
  contributes?: {
    themes?: Array<{
      id?: string // Built-in themes may have an id field
      label: string
      uiTheme: "vs" | "vs-dark" | "hc-black" | "hc-light"
      path: string
    }>
  }
}

/**  VS Code settings.json structure (partial). */
interface VSCodeSettings {
  "workbench.colorTheme"?: string
  "workbench.preferredDarkColorTheme"?: string
  "workbench.preferredLightColorTheme"?: string
}

/**  Map VS Code uiTheme values to our theme type system. */
function mapUiThemeToType(
  /** The uiTheme value from VS Code (e.g., "vs", "vs-dark") */
  uiTheme: string,
): ThemeMeta["type"] {
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
    builtinExtensionsDir: {
      darwin: "/Applications/Visual Studio Code.app/Contents/Resources/app/extensions",
      win32: `${process.env.PROGRAMFILES || "C:\\Program Files"}\\Microsoft VS Code\\resources\\app\\extensions`,
      linux: "/usr/share/code/resources/app/extensions",
    },
  },
  {
    name: "VS Code Insiders",
    settingsPath: "Code - Insiders/User/settings.json",
    extensionsDir: ".vscode-insiders/extensions",
    builtinExtensionsDir: {
      darwin: "/Applications/Visual Studio Code - Insiders.app/Contents/Resources/app/extensions",
      win32: `${process.env.PROGRAMFILES || "C:\\Program Files"}\\Microsoft VS Code Insiders\\resources\\app\\extensions`,
      linux: "/usr/share/code-insiders/resources/app/extensions",
    },
  },
  {
    name: "Cursor",
    settingsPath: "Cursor/User/settings.json",
    extensionsDir: ".cursor/extensions",
    builtinExtensionsDir: {
      darwin: "/Applications/Cursor.app/Contents/Resources/app/extensions",
      win32: `${process.env.LOCALAPPDATA || ""}\\Programs\\Cursor\\resources\\app\\extensions`,
      linux: "/opt/Cursor/resources/app/extensions",
    },
  },
  {
    name: "VSCodium",
    settingsPath: "VSCodium/User/settings.json",
    extensionsDir: ".vscode-oss/extensions",
    builtinExtensionsDir: {
      darwin: "/Applications/VSCodium.app/Contents/Resources/app/extensions",
      win32: `${process.env.PROGRAMFILES || "C:\\Program Files"}\\VSCodium\\resources\\app\\extensions`,
      linux: "/usr/share/codium/resources/app/extensions",
    },
  },
] as const

/**  Get the Application Support directory path based on platform. */
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

/**  ThemeDiscovery class for scanning VS Code installations and themes. */
export class ThemeDiscovery {
  private settingsPath: string | null = null
  private extensionsDir: string | null = null
  private builtinExtensionsDir: string | null = null
  private variantName: string | null = null

  /**
   * Initialize the ThemeDiscovery by finding a valid VS Code installation.
   * Returns true if a valid installation was found.
   */
  async initialize(): Promise<boolean> {
    const appSupport = getAppSupportPath()
    const homeDir = os.homedir()
    const platform = process.platform as "darwin" | "win32" | "linux"

    for (const variant of VSCODE_VARIANTS) {
      const settingsPath = path.join(appSupport, variant.settingsPath)
      const extensionsDir = path.join(homeDir, variant.extensionsDir)
      const builtinDir = variant.builtinExtensionsDir[platform] || null

      // Check if settings file exists
      try {
        await stat(settingsPath)
        await stat(extensionsDir)
        this.settingsPath = settingsPath
        this.extensionsDir = extensionsDir
        this.variantName = variant.name

        // Check if built-in extensions directory exists (optional)
        if (builtinDir) {
          try {
            await stat(builtinDir)
            this.builtinExtensionsDir = builtinDir
          } catch {
            // Built-in dir not found, continue without it
            this.builtinExtensionsDir = null
          }
        }

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

    // Scan user-installed extensions
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
        const extensionThemes = await this.scanExtension(extensionPath, entry.name, false)
        themes.push(...extensionThemes)
      }
    } catch {
      // Extensions directory doesn't exist or can't be read
    }

    // Scan built-in themes
    if (this.builtinExtensionsDir) {
      try {
        const entries = await readdir(this.builtinExtensionsDir, { withFileTypes: true })

        for (const entry of entries) {
          if (!entry.isDirectory()) {
            continue
          }

          // Built-in theme directories typically start with "theme-"
          if (!entry.name.startsWith("theme-")) {
            continue
          }

          const extensionPath = path.join(this.builtinExtensionsDir, entry.name)
          const extensionThemes = await this.scanExtension(extensionPath, entry.name, true)
          themes.push(...extensionThemes)
        }
      } catch {
        // Built-in extensions directory doesn't exist or can't be read
      }
    }

    // Sort themes by label
    return themes.sort((a, b) => a.label.localeCompare(b.label))
  }

  /**
   * Load NLS (localization) strings from package.nls.json if it exists.
   */
  private async loadNlsStrings(
    /** Path to the extension directory */
    extensionPath: string,
  ): Promise<NlsStrings> {
    const nlsPath = path.join(extensionPath, "package.nls.json")
    try {
      const content = await readFile(nlsPath, "utf-8")
      return JSON.parse(content) as NlsStrings
    } catch {
      return {}
    }
  }

  /**
   * Resolve NLS placeholders like %themeLabel% using NLS strings.
   */
  private resolveNlsString(
    /** The value that may contain NLS placeholders (e.g., "%themeLabel%") */
    value: string,
    /** The NLS strings to use for resolving placeholders */
    nlsStrings: NlsStrings,
  ): string {
    // Match %key% pattern
    const match = /^%([^%]+)%$/.exec(value)
    if (match) {
      const key = match[1]
      return nlsStrings[key] || value
    }
    return value
  }

  /**
   * Scan a single extension directory for theme contributions.
   */
  private async scanExtension(
    /** Path to the extension directory */
    extensionPath: string,
    /** Extension name (unused, reserved for future use) */
    _extensionName: string,
    /** Whether this is a built-in VS Code theme */
    isBuiltin: boolean,
  ): Promise<ThemeMeta[]> {
    const themes: ThemeMeta[] = []
    const packageJsonPath = path.join(extensionPath, "package.json")

    try {
      const content = await readFile(packageJsonPath, "utf-8")
      const packageJson = JSON.parse(content) as ExtensionPackageJson

      const contributedThemes = packageJson.contributes?.themes
      if (!contributedThemes || !Array.isArray(contributedThemes)) {
        return []
      }

      // Load NLS strings for built-in themes (they use placeholders like %themeLabel%)
      const nlsStrings = isBuiltin ? await this.loadNlsStrings(extensionPath) : {}

      for (const theme of contributedThemes) {
        const themePath = path.join(extensionPath, theme.path)

        // Verify the theme file exists
        try {
          await stat(themePath)
        } catch {
          // Theme file doesn't exist, skip it
          continue
        }

        // Resolve NLS placeholders in label and displayName
        const resolvedLabel = this.resolveNlsString(theme.label, nlsStrings)
        const resolvedDisplayName =
          packageJson.displayName ?
            this.resolveNlsString(packageJson.displayName, nlsStrings)
          : packageJson.name

        // Create a unique ID: extensionId/themeLabel
        // For built-in themes, use "vscode" as the publisher
        const publisher = isBuiltin ? "vscode" : packageJson.publisher || "local"
        const extensionId = `${publisher}.${packageJson.name}`

        // Use the theme's id field if available (built-in themes often have this),
        // otherwise fall back to the resolved label
        const themeIdSuffix = theme.id || resolvedLabel
        const id = `${extensionId}/${themeIdSuffix}`

        themes.push({
          id,
          label: resolvedLabel,
          type: mapUiThemeToType(theme.uiTheme),
          path: themePath,
          extensionId,
          extensionName: resolvedDisplayName,
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
  async readThemeFile(
    /** Path to the theme JSON file */
    themePath: string,
  ): Promise<unknown | null> {
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
  async findThemeByLabel(
    /** The theme label to search for */
    label: string,
  ): Promise<ThemeMeta | null> {
    const themes = await this.discoverThemes()
    return themes.find(t => t.label === label) ?? null
  }

  /**
   * Find a theme by its ID.
   * Returns null if not found.
   */
  async findThemeById(
    /** The theme ID to search for */
    id: string,
  ): Promise<ThemeMeta | null> {
    const themes = await this.discoverThemes()
    return themes.find(t => t.id === id) ?? null
  }
}
