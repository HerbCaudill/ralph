/**
 * Parser and validator for VS Code theme JSON files.
 *
 * This module provides functions to:
 * - Parse raw JSON theme data into typed VSCodeTheme objects
 * - Validate theme structure and required fields
 * - Extract colors and tokenColors for application use
 */

import type {
  VSCodeTheme,
  VSCodeTokenColor,
  VSCodeTokenSettings,
  VSCodeEditorColors,
} from "./types"

/**
 * Result of parsing a theme file.
 * Either contains the parsed theme or an error.
 */
export type ParseResult = { success: true; theme: VSCodeTheme } | { success: false; error: string }

/**
 * Validation result for a theme object.
 */
export type ValidationResult = { valid: true } | { valid: false; errors: string[] }

/**
 * Parse a JSON string into a VSCodeTheme object.
 *
 * This function:
 * 1. Parses the JSON string
 * 2. Validates the structure
 * 3. Normalizes the data (fills in defaults)
 *
 * @param json - The raw JSON string from a theme file
 * @returns ParseResult with either the parsed theme or an error message
 */
export function parseThemeJson(json: string): ParseResult {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown parse error"
    return { success: false, error: `Invalid JSON: ${message}` }
  }

  return parseThemeObject(data)
}

/**
 * Parse an already-parsed JSON object into a VSCodeTheme object.
 *
 * Useful when the JSON has already been parsed (e.g., from a file read).
 *
 * @param data - The parsed JSON data
 * @returns ParseResult with either the parsed theme or an error message
 */
export function parseThemeObject(data: unknown): ParseResult {
  // Validate the basic structure
  const validation = validateThemeObject(data)
  if (!validation.valid) {
    return { success: false, error: validation.errors.join("; ") }
  }

  // At this point we know the data has the required structure
  const raw = data as Record<string, unknown>

  // Normalize and build the theme object
  const theme = normalizeTheme(raw)

  return { success: true, theme }
}

/**
 * Validate that an object has the required theme structure.
 *
 * @param data - The data to validate
 * @returns ValidationResult indicating if the data is a valid theme
 */
export function validateThemeObject(data: unknown): ValidationResult {
  const errors: string[] = []

  if (data === null || typeof data !== "object") {
    return { valid: false, errors: ["Theme must be an object"] }
  }

  const obj = data as Record<string, unknown>

  // Check required fields
  if (typeof obj.name !== "string" || obj.name.trim() === "") {
    errors.push("Theme must have a non-empty 'name' field")
  }

  // Type is required and must be one of the valid values
  const validTypes = ["dark", "light", "hcDark", "hcLight"]
  if (typeof obj.type !== "string" || !validTypes.includes(obj.type)) {
    errors.push(`Theme must have a 'type' field with one of: ${validTypes.join(", ")}`)
  }

  // colors should be an object if present
  if (obj.colors !== undefined) {
    if (typeof obj.colors !== "object" || obj.colors === null || Array.isArray(obj.colors)) {
      errors.push("'colors' must be an object")
    }
  }

  // tokenColors should be an array if present
  if (obj.tokenColors !== undefined) {
    if (!Array.isArray(obj.tokenColors)) {
      errors.push("'tokenColors' must be an array")
    } else {
      // Validate each token color entry
      obj.tokenColors.forEach((tc, index) => {
        const tcErrors = validateTokenColor(tc, index)
        errors.push(...tcErrors)
      })
    }
  }

  // semanticHighlighting should be a boolean if present
  if (obj.semanticHighlighting !== undefined && typeof obj.semanticHighlighting !== "boolean") {
    errors.push("'semanticHighlighting' must be a boolean")
  }

  // semanticTokenColors should be an object if present
  if (obj.semanticTokenColors !== undefined) {
    if (
      typeof obj.semanticTokenColors !== "object" ||
      obj.semanticTokenColors === null ||
      Array.isArray(obj.semanticTokenColors)
    ) {
      errors.push("'semanticTokenColors' must be an object")
    }
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors }
}

/**
 * Validate a single token color entry.
 *
 * @param tc - The token color entry to validate
 * @param index - The index in the tokenColors array (for error messages)
 * @returns Array of error messages (empty if valid)
 */
function validateTokenColor(tc: unknown, index: number): string[] {
  const errors: string[] = []
  const prefix = `tokenColors[${index}]`

  // Skip non-object entries silently - they'll be filtered during normalization
  // This allows themes with quirky data to still be parsed
  if (tc === null || typeof tc !== "object") {
    return errors
  }

  const entry = tc as Record<string, unknown>

  // settings is required
  if (entry.settings === undefined) {
    errors.push(`${prefix} must have a 'settings' field`)
  } else if (typeof entry.settings !== "object" || entry.settings === null) {
    errors.push(`${prefix}.settings must be an object`)
  } else {
    // Validate settings fields
    const settings = entry.settings as Record<string, unknown>
    if (settings.foreground !== undefined && typeof settings.foreground !== "string") {
      errors.push(`${prefix}.settings.foreground must be a string`)
    }
    if (settings.background !== undefined && typeof settings.background !== "string") {
      errors.push(`${prefix}.settings.background must be a string`)
    }
    if (settings.fontStyle !== undefined && typeof settings.fontStyle !== "string") {
      errors.push(`${prefix}.settings.fontStyle must be a string`)
    }
  }

  // scope is optional but must be string or string[] if present
  if (entry.scope !== undefined) {
    if (typeof entry.scope !== "string" && !Array.isArray(entry.scope)) {
      errors.push(`${prefix}.scope must be a string or array of strings`)
    } else if (Array.isArray(entry.scope)) {
      entry.scope.forEach((s, i) => {
        if (typeof s !== "string") {
          errors.push(`${prefix}.scope[${i}] must be a string`)
        }
      })
    }
  }

  // name is optional but must be string if present
  if (entry.name !== undefined && typeof entry.name !== "string") {
    errors.push(`${prefix}.name must be a string`)
  }

  return errors
}

/**
 * Normalize a raw theme object into a proper VSCodeTheme.
 *
 * This fills in defaults and ensures the structure is complete.
 *
 * @param raw - The raw theme object (already validated)
 * @returns The normalized VSCodeTheme
 */
function normalizeTheme(raw: Record<string, unknown>): VSCodeTheme {
  // Extract and normalize colors
  const colors = normalizeColors(raw.colors)

  // Extract and normalize token colors
  const tokenColors = normalizeTokenColors(raw.tokenColors)

  // Extract and normalize semantic token colors
  const semanticTokenColors = normalizeSemanticTokenColors(raw.semanticTokenColors)

  return {
    $schema: typeof raw.$schema === "string" ? raw.$schema : undefined,
    name: raw.name as string,
    type: raw.type as VSCodeTheme["type"],
    semanticHighlighting:
      typeof raw.semanticHighlighting === "boolean" ? raw.semanticHighlighting : undefined,
    colors,
    tokenColors,
    semanticTokenColors:
      Object.keys(semanticTokenColors).length > 0 ? semanticTokenColors : undefined,
  }
}

/**
 * Normalize the colors object.
 *
 * @param colors - The raw colors object
 * @returns Normalized VSCodeEditorColors
 */
function normalizeColors(colors: unknown): VSCodeEditorColors {
  if (colors === null || typeof colors !== "object" || Array.isArray(colors)) {
    return {}
  }

  const result: VSCodeEditorColors = {}
  const raw = colors as Record<string, unknown>

  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") {
      result[key] = value
    }
  }

  return result
}

/**
 * Normalize the tokenColors array.
 *
 * @param tokenColors - The raw tokenColors array
 * @returns Normalized array of VSCodeTokenColor
 */
function normalizeTokenColors(tokenColors: unknown): VSCodeTokenColor[] {
  if (!Array.isArray(tokenColors)) {
    return []
  }

  return tokenColors
    .filter((tc): tc is Record<string, unknown> => tc !== null && typeof tc === "object")
    .map(tc => {
      const settings = normalizeTokenSettings(tc.settings)
      const result: VSCodeTokenColor = { settings }

      if (typeof tc.name === "string") {
        result.name = tc.name
      }

      if (typeof tc.scope === "string") {
        result.scope = tc.scope
      } else if (Array.isArray(tc.scope)) {
        result.scope = tc.scope.filter((s): s is string => typeof s === "string")
      }

      return result
    })
}

/**
 * Normalize token settings.
 *
 * @param settings - The raw settings object
 * @returns Normalized VSCodeTokenSettings
 */
function normalizeTokenSettings(settings: unknown): VSCodeTokenSettings {
  if (settings === null || typeof settings !== "object") {
    return {}
  }

  const raw = settings as Record<string, unknown>
  const result: VSCodeTokenSettings = {}

  if (typeof raw.foreground === "string") {
    result.foreground = raw.foreground
  }
  if (typeof raw.background === "string") {
    result.background = raw.background
  }
  if (typeof raw.fontStyle === "string") {
    result.fontStyle = raw.fontStyle
  }

  return result
}

/**
 * Normalize semantic token colors.
 *
 * @param semanticTokenColors - The raw semanticTokenColors object
 * @returns Normalized record of semantic token colors
 */
function normalizeSemanticTokenColors(
  semanticTokenColors: unknown,
): Record<string, VSCodeTokenSettings | string> {
  if (
    semanticTokenColors === null ||
    typeof semanticTokenColors !== "object" ||
    Array.isArray(semanticTokenColors)
  ) {
    return {}
  }

  const result: Record<string, VSCodeTokenSettings | string> = {}
  const raw = semanticTokenColors as Record<string, unknown>

  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") {
      result[key] = value
    } else if (value !== null && typeof value === "object") {
      result[key] = normalizeTokenSettings(value)
    }
  }

  return result
}

/**
 * Extract a specific color from a theme by key.
 *
 * @param theme - The theme to extract from
 * @param key - The color key (e.g., "editor.background")
 * @returns The color value or undefined if not found
 */
export function getColor(theme: VSCodeTheme, key: string): string | undefined {
  return theme.colors[key]
}

/**
 * Extract token colors that match a specific scope.
 *
 * @param theme - The theme to search
 * @param scope - The TextMate scope to find
 * @returns Array of matching token colors (most specific first)
 */
export function getTokenColorsForScope(theme: VSCodeTheme, scope: string): VSCodeTokenColor[] {
  return theme.tokenColors.filter(tc => {
    if (tc.scope === undefined) return false
    if (typeof tc.scope === "string") {
      return scopeMatches(scope, tc.scope)
    }
    return tc.scope.some(s => scopeMatches(scope, s))
  })
}

/**
 * Check if a scope matches a pattern.
 *
 * TextMate scopes use a hierarchical matching system where
 * "source.js" matches "source.js.jsx" and "source.js".
 *
 * @param scope - The scope to check
 * @param pattern - The pattern to match against
 * @returns true if the scope matches the pattern
 */
function scopeMatches(scope: string, pattern: string): boolean {
  // Exact match
  if (scope === pattern) return true

  // Hierarchical match: "comment" matches "comment.line.double-slash"
  return scope.startsWith(pattern + ".")
}

/**
 * Get the foreground color for a specific scope.
 *
 * This searches through tokenColors to find the most specific match.
 *
 * @param theme - The theme to search
 * @param scope - The TextMate scope
 * @returns The foreground color or undefined if not found
 */
export function getForegroundForScope(theme: VSCodeTheme, scope: string): string | undefined {
  const tokens = getTokenColorsForScope(theme, scope)
  for (const token of tokens) {
    if (token.settings.foreground) {
      return token.settings.foreground
    }
  }
  return undefined
}

/**
 * Check if a theme is a dark theme.
 *
 * @param theme - The theme to check
 * @returns true if the theme is dark or high-contrast dark
 */
export function isDarkTheme(theme: VSCodeTheme): boolean {
  return theme.type === "dark" || theme.type === "hcDark"
}

/**
 * Check if a theme is a light theme.
 *
 * @param theme - The theme to check
 * @returns true if the theme is light or high-contrast light
 */
export function isLightTheme(theme: VSCodeTheme): boolean {
  return theme.type === "light" || theme.type === "hcLight"
}

/**
 * Check if a theme is a high-contrast theme.
 *
 * @param theme - The theme to check
 * @returns true if the theme is high-contrast (either dark or light)
 */
export function isHighContrastTheme(theme: VSCodeTheme): boolean {
  return theme.type === "hcDark" || theme.type === "hcLight"
}

/**
 * Get essential colors from a theme with fallbacks.
 *
 * Returns a set of colors that are commonly needed for UI rendering,
 * with sensible defaults if the theme doesn't specify them.
 *
 * @param theme - The theme to extract from
 * @returns Object with essential UI colors
 */
export function getEssentialColors(theme: VSCodeTheme): {
  background: string
  foreground: string
  accent: string
  muted: string
  border: string
  selection: string
} {
  const isDark = isDarkTheme(theme)

  // Default colors based on theme type
  const defaults =
    isDark ?
      {
        background: "#1e1e1e",
        foreground: "#d4d4d4",
        accent: "#007acc",
        muted: "#808080",
        border: "#454545",
        selection: "#264f78",
      }
    : {
        background: "#ffffff",
        foreground: "#333333",
        accent: "#0066b8",
        muted: "#6e6e6e",
        border: "#e5e5e5",
        selection: "#add6ff",
      }

  return {
    background: theme.colors["editor.background"] ?? defaults.background,
    foreground: theme.colors["editor.foreground"] ?? theme.colors.foreground ?? defaults.foreground,
    accent: theme.colors["button.background"] ?? theme.colors.focusBorder ?? defaults.accent,
    muted: theme.colors["editorLineNumber.foreground"] ?? defaults.muted,
    border: theme.colors["panel.border"] ?? theme.colors.contrastBorder ?? defaults.border,
    selection: theme.colors["editor.selectionBackground"] ?? defaults.selection,
  }
}
