/**
 * Shiki highlighter singleton for code syntax highlighting.
 *
 * This module provides a lazy-initialized Shiki highlighter that:
 * - Is created on first use for optimal startup performance
 * - Supports dynamic theme loading for VS Code theme integration
 * - Provides a simple highlight() wrapper for consistent usage
 */

import { createHighlighter, type Highlighter, type BundledLanguage } from "shiki"
import type { VSCodeTheme } from "./types"

// Singleton highlighter instance (lazy-initialized)
let highlighterPromise: Promise<Highlighter> | null = null
let highlighterInstance: Highlighter | null = null

// Currently loaded custom theme ID
let currentThemeId: string | null = null

// Default bundled themes
const DEFAULT_LIGHT_THEME = "github-light"
const DEFAULT_DARK_THEME = "github-dark"

// Custom theme name prefix to avoid conflicts with bundled themes
const CUSTOM_THEME_PREFIX = "vscode-custom-"

/**
 * Languages to pre-load for immediate highlighting.
 * Common languages used in development are included.
 */
const PRELOADED_LANGUAGES: BundledLanguage[] = [
  "typescript",
  "javascript",
  "tsx",
  "jsx",
  "json",
  "html",
  "css",
  "bash",
  "shell",
  "python",
  "rust",
  "go",
  "markdown",
  "yaml",
  "toml",
  "sql",
  "graphql",
  "diff",
]

/**
 * Language alias mapping for common variations.
 */
const LANGUAGE_ALIASES: Record<string, string> = {
  ts: "typescript",
  js: "javascript",
  sh: "bash",
  zsh: "bash",
  yml: "yaml",
  py: "python",
  rb: "ruby",
  md: "markdown",
}

/**
 * Get or create the Shiki highlighter singleton.
 * The highlighter is lazy-initialized on first call.
 *
 * @returns Promise resolving to the Highlighter instance
 */
export async function getHighlighter(): Promise<Highlighter> {
  if (highlighterInstance) {
    return highlighterInstance
  }

  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [DEFAULT_LIGHT_THEME, DEFAULT_DARK_THEME],
      langs: PRELOADED_LANGUAGES,
    }).then(h => {
      highlighterInstance = h
      return h
    })
  }

  return highlighterPromise
}

/**
 * Load a VS Code theme into the highlighter for use with code blocks.
 *
 * The theme is registered with a custom ID and can be used for highlighting.
 * Subsequent calls with the same theme ID will skip re-registration.
 *
 * @param theme - The VS Code theme object to load
 * @param themeId - Unique identifier for this theme (used for caching)
 * @returns The theme name to use with highlight()
 */
export async function loadTheme(theme: VSCodeTheme, themeId: string): Promise<string> {
  const highlighter = await getHighlighter()
  const customThemeName = `${CUSTOM_THEME_PREFIX}${themeId}`

  // Skip if already loaded
  if (currentThemeId === themeId) {
    return customThemeName
  }

  // Filter out undefined values from colors (Shiki requires Record<string, string>)
  const filteredColors: Record<string, string> = {}
  for (const [key, value] of Object.entries(theme.colors)) {
    if (value !== undefined) {
      filteredColors[key] = value
    }
  }

  // Filter semantic token colors to only include string values (Shiki requires Record<string, string>)
  // VSCodeTokenSettings objects are converted to their foreground color if available
  let filteredSemanticTokenColors: Record<string, string> | undefined
  if (theme.semanticTokenColors) {
    filteredSemanticTokenColors = {}
    for (const [key, value] of Object.entries(theme.semanticTokenColors)) {
      if (typeof value === "string") {
        filteredSemanticTokenColors[key] = value
      } else if (value && typeof value === "object" && value.foreground) {
        filteredSemanticTokenColors[key] = value.foreground
      }
    }
  }

  // Register the theme with Shiki
  // Shiki expects a theme object with name, type, colors, and tokenColors
  await highlighter.loadTheme({
    name: customThemeName,
    type: theme.type === "light" || theme.type === "hcLight" ? "light" : "dark",
    colors: filteredColors,
    tokenColors: theme.tokenColors,
    semanticHighlighting: theme.semanticHighlighting,
    semanticTokenColors: filteredSemanticTokenColors,
  })

  currentThemeId = themeId
  return customThemeName
}

/**
 * Get the name of the currently loaded custom theme.
 *
 * @returns The custom theme name if loaded, null otherwise
 */
export function getCurrentCustomThemeName(): string | null {
  if (currentThemeId === null) {
    return null
  }
  return `${CUSTOM_THEME_PREFIX}${currentThemeId}`
}

/**
 * Get a default bundled theme name based on light/dark preference.
 *
 * @param isDark - Whether to return the dark theme
 * @returns The default theme name
 */
export function getDefaultThemeName(isDark: boolean): string {
  return isDark ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME
}

/**
 * Highlight code with syntax highlighting.
 *
 * @param code - The source code to highlight
 * @param language - The programming language (supports common aliases)
 * @param options - Highlighting options
 * @param options.theme - Theme name to use (custom or bundled)
 * @param options.isDark - If no theme specified, use dark or light default
 * @returns HTML string with highlighted code
 */
export async function highlight(
  code: string,
  language: string,
  options: {
    theme?: string
    isDark?: boolean
  } = {},
): Promise<string> {
  const highlighter = await getHighlighter()

  // Normalize language using aliases
  const normalizedLang = LANGUAGE_ALIASES[language.toLowerCase()] || language.toLowerCase()

  // Check if language is available
  const loadedLangs = highlighter.getLoadedLanguages()
  const langToUse = loadedLangs.includes(normalizedLang) ? normalizedLang : "text"

  // Determine theme to use
  let themeName: string
  if (options.theme) {
    themeName = options.theme
  } else if (currentThemeId) {
    themeName = `${CUSTOM_THEME_PREFIX}${currentThemeId}`
  } else {
    themeName = options.isDark !== false ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME
  }

  // Check if the theme is loaded
  const loadedThemes = highlighter.getLoadedThemes()
  if (!loadedThemes.includes(themeName)) {
    // Fall back to default theme
    themeName = options.isDark !== false ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME
  }

  // Highlight the code
  return highlighter.codeToHtml(code, {
    lang: langToUse,
    theme: themeName,
  })
}

/**
 * Check if a language is supported by the highlighter.
 *
 * @param language - The language to check (supports aliases)
 * @returns true if the language is loaded and supported
 */
export async function isLanguageSupported(language: string): Promise<boolean> {
  const highlighter = await getHighlighter()
  const normalizedLang = LANGUAGE_ALIASES[language.toLowerCase()] || language.toLowerCase()
  return highlighter.getLoadedLanguages().includes(normalizedLang)
}

/**
 * Get the list of supported languages.
 *
 * @returns Array of loaded language IDs
 */
export async function getSupportedLanguages(): Promise<string[]> {
  const highlighter = await getHighlighter()
  return highlighter.getLoadedLanguages()
}

/**
 * Normalize a language identifier using common aliases.
 *
 * @param language - The language to normalize
 * @returns The normalized language ID
 */
export function normalizeLanguage(language: string): string {
  return LANGUAGE_ALIASES[language.toLowerCase()] || language.toLowerCase()
}
