/**
 * Theme color mapper for VS Code themes.
 *
 * This module maps VS Code color tokens to CSS variables used by the application.
 * It uses fallback chains to handle themes that don't provide all color values.
 *
 * The mapper extracts colors from VS Code themes and maps them to:
 * - Status colors (success, warning, error, info, neutral)
 * - UI colors (background, foreground, accent, muted, border, selection)
 * - Component-specific colors (sidebar, card, popover, etc.)
 */

import type { VSCodeTheme, StatusColors, AppTheme, ThemeMeta } from "./types"
import { DEFAULT_DARK_STATUS_COLORS, DEFAULT_LIGHT_STATUS_COLORS } from "./types"
import { isDarkTheme, getEssentialColors } from "./parser"

/**
 * CSS variable names used by the application.
 * These correspond to the variables defined in index.css.
 */
export interface CSSVariables {
  // Base colors
  "--background": string
  "--foreground": string
  "--card": string
  "--card-foreground": string
  "--popover": string
  "--popover-foreground": string
  "--primary": string
  "--primary-foreground": string
  "--secondary": string
  "--secondary-foreground": string
  "--muted": string
  "--muted-foreground": string
  "--accent": string
  "--accent-foreground": string
  "--destructive": string
  "--border": string
  "--input": string
  "--ring": string

  // Sidebar colors
  "--sidebar": string
  "--sidebar-foreground": string
  "--sidebar-primary": string
  "--sidebar-primary-foreground": string
  "--sidebar-accent": string
  "--sidebar-accent-foreground": string
  "--sidebar-border": string
  "--sidebar-ring": string

  // Status colors
  "--status-success": string
  "--status-warning": string
  "--status-error": string
  "--status-info": string
  "--status-neutral": string
}

/**
 * Fallback chain definition.
 * Each entry specifies VS Code color keys to try in order,
 * with an optional default value if none are found.
 */
interface FallbackChain {
  /** VS Code color keys to try in order */
  keys: string[]
  /** Default value if no keys are found */
  default?: string
  /** Function to derive the color from another resolved color */
  derive?: (resolved: Partial<CSSVariables>, theme: VSCodeTheme) => string | undefined
}

/**
 * Fallback chains for status colors.
 * These map VS Code color tokens to our status color semantics.
 */
const STATUS_COLOR_FALLBACKS: Record<keyof StatusColors, FallbackChain> = {
  success: {
    keys: [
      "terminal.ansiGreen",
      "terminal.ansiBrightGreen",
      "gitDecoration.addedResourceForeground",
      "editorGutter.addedBackground",
    ],
  },
  warning: {
    keys: [
      "terminal.ansiYellow",
      "terminal.ansiBrightYellow",
      "editorWarning.foreground",
      "inputValidation.warningBorder",
      "gitDecoration.modifiedResourceForeground",
    ],
  },
  error: {
    keys: [
      "terminal.ansiRed",
      "terminal.ansiBrightRed",
      "editorError.foreground",
      "errorForeground",
      "inputValidation.errorBorder",
      "gitDecoration.deletedResourceForeground",
    ],
  },
  info: {
    keys: [
      "terminal.ansiBlue",
      "terminal.ansiBrightBlue",
      "editorInfo.foreground",
      "inputValidation.infoBorder",
      "focusBorder",
    ],
  },
  neutral: {
    keys: [
      "editorLineNumber.foreground",
      "tab.inactiveForeground",
      "sideBarTitle.foreground",
      "panelTitle.inactiveForeground",
    ],
  },
}

/**
 * Fallback chains for CSS variables.
 * These map VS Code color tokens to our CSS variable semantics.
 */
const CSS_VARIABLE_FALLBACKS: Record<keyof CSSVariables, FallbackChain> = {
  // Base colors
  "--background": {
    keys: ["editor.background"],
  },
  "--foreground": {
    keys: ["editor.foreground", "foreground"],
  },
  "--card": {
    keys: ["editor.background", "sideBar.background"],
  },
  "--card-foreground": {
    keys: ["editor.foreground", "foreground"],
  },
  "--popover": {
    keys: ["dropdown.background", "editor.background"],
  },
  "--popover-foreground": {
    keys: ["dropdown.foreground", "editor.foreground", "foreground"],
  },
  "--primary": {
    keys: ["button.background", "focusBorder", "activityBar.foreground"],
  },
  "--primary-foreground": {
    keys: ["button.foreground"],
    derive: (resolved, theme) => {
      // If we have a primary color, derive foreground from theme type
      if (resolved["--primary"]) {
        return isDarkTheme(theme) ? "#1e1e1e" : "#ffffff"
      }
      return undefined
    },
  },
  "--secondary": {
    keys: ["sideBar.background", "activityBar.background"],
    derive: (resolved, theme) => {
      // Fall back to a slightly different shade of background
      const bg = resolved["--background"]
      if (bg) {
        return adjustColorBrightness(bg, isDarkTheme(theme) ? 0.1 : -0.03)
      }
      return undefined
    },
  },
  "--secondary-foreground": {
    keys: ["sideBar.foreground", "activityBar.foreground", "editor.foreground"],
  },
  "--muted": {
    keys: ["tab.inactiveBackground", "sideBarSectionHeader.background"],
    derive: (resolved, theme) => {
      const bg = resolved["--background"]
      if (bg) {
        return adjustColorBrightness(bg, isDarkTheme(theme) ? 0.1 : -0.03)
      }
      return undefined
    },
  },
  "--muted-foreground": {
    keys: ["editorLineNumber.foreground", "tab.inactiveForeground", "sideBarTitle.foreground"],
  },
  "--accent": {
    keys: ["list.activeSelectionBackground", "button.background", "focusBorder"],
    derive: resolved => resolved["--primary"],
  },
  "--accent-foreground": {
    keys: ["list.activeSelectionForeground", "button.foreground"],
    derive: resolved => resolved["--primary-foreground"],
  },
  "--destructive": {
    keys: [
      "terminal.ansiRed",
      "terminal.ansiBrightRed",
      "editorError.foreground",
      "errorForeground",
    ],
  },
  "--border": {
    keys: ["panel.border", "sideBar.border", "contrastBorder", "widget.border", "input.border"],
    derive: (resolved, theme) => {
      const bg = resolved["--background"]
      if (bg) {
        return adjustColorBrightness(bg, isDarkTheme(theme) ? 0.15 : -0.08)
      }
      return undefined
    },
  },
  "--input": {
    keys: ["input.background"],
    derive: (resolved, theme) => {
      const bg = resolved["--background"]
      if (bg) {
        return adjustColorBrightness(bg, isDarkTheme(theme) ? 0.05 : -0.02)
      }
      return undefined
    },
  },
  "--ring": {
    keys: ["focusBorder"],
    derive: resolved => resolved["--primary"],
  },

  // Sidebar colors
  "--sidebar": {
    keys: ["sideBar.background", "activityBar.background"],
    derive: (resolved, theme) => {
      const bg = resolved["--background"]
      if (bg) {
        return adjustColorBrightness(bg, isDarkTheme(theme) ? 0.05 : -0.02)
      }
      return undefined
    },
  },
  "--sidebar-foreground": {
    keys: ["sideBar.foreground", "activityBar.foreground", "editor.foreground"],
  },
  "--sidebar-primary": {
    keys: ["button.background", "focusBorder"],
    derive: resolved => resolved["--primary"],
  },
  "--sidebar-primary-foreground": {
    keys: ["button.foreground"],
    derive: resolved => resolved["--primary-foreground"],
  },
  "--sidebar-accent": {
    keys: ["list.activeSelectionBackground", "sideBarSectionHeader.background"],
    derive: (resolved, theme) => {
      const sidebar = resolved["--sidebar"]
      if (sidebar) {
        return adjustColorBrightness(sidebar, isDarkTheme(theme) ? 0.1 : -0.05)
      }
      return undefined
    },
  },
  "--sidebar-accent-foreground": {
    keys: ["list.activeSelectionForeground", "sideBar.foreground"],
  },
  "--sidebar-border": {
    keys: ["sideBar.border", "panel.border", "contrastBorder"],
    derive: resolved => resolved["--border"],
  },
  "--sidebar-ring": {
    keys: ["focusBorder"],
    derive: resolved => resolved["--ring"],
  },

  // Status colors (these use the status color fallbacks)
  "--status-success": {
    keys: STATUS_COLOR_FALLBACKS.success.keys,
  },
  "--status-warning": {
    keys: STATUS_COLOR_FALLBACKS.warning.keys,
  },
  "--status-error": {
    keys: STATUS_COLOR_FALLBACKS.error.keys,
  },
  "--status-info": {
    keys: STATUS_COLOR_FALLBACKS.info.keys,
  },
  "--status-neutral": {
    keys: STATUS_COLOR_FALLBACKS.neutral.keys,
  },
}

/**
 * Extract status colors from a VS Code theme.
 *
 * @param theme - The VS Code theme to extract from
 * @returns StatusColors with values from the theme or defaults
 */
export function extractStatusColors(theme: VSCodeTheme): StatusColors {
  const defaultColors =
    isDarkTheme(theme) ? DEFAULT_DARK_STATUS_COLORS : DEFAULT_LIGHT_STATUS_COLORS

  return {
    success: getFirstColor(theme, STATUS_COLOR_FALLBACKS.success.keys) ?? defaultColors.success,
    warning: getFirstColor(theme, STATUS_COLOR_FALLBACKS.warning.keys) ?? defaultColors.warning,
    error: getFirstColor(theme, STATUS_COLOR_FALLBACKS.error.keys) ?? defaultColors.error,
    info: getFirstColor(theme, STATUS_COLOR_FALLBACKS.info.keys) ?? defaultColors.info,
    neutral: getFirstColor(theme, STATUS_COLOR_FALLBACKS.neutral.keys) ?? defaultColors.neutral,
  }
}

/**
 * Map a VS Code theme to CSS variables.
 *
 * @param theme - The VS Code theme to map
 * @returns Record of CSS variable names to color values
 */
export function mapThemeToCSSVariables(theme: VSCodeTheme): CSSVariables {
  const isDark = isDarkTheme(theme)
  const resolved: Partial<CSSVariables> = {}

  // First pass: resolve colors from direct key lookups
  for (const [varName, fallback] of Object.entries(CSS_VARIABLE_FALLBACKS) as [
    keyof CSSVariables,
    FallbackChain,
  ][]) {
    const color = getFirstColor(theme, fallback.keys)
    if (color) {
      resolved[varName] = color
    }
  }

  // Second pass: apply derive functions for any unresolved colors
  for (const [varName, fallback] of Object.entries(CSS_VARIABLE_FALLBACKS) as [
    keyof CSSVariables,
    FallbackChain,
  ][]) {
    if (!resolved[varName] && fallback.derive) {
      const derived = fallback.derive(resolved, theme)
      if (derived) {
        resolved[varName] = derived
      }
    }
  }

  // Third pass: apply defaults for any still-unresolved colors
  const defaults = getDefaultCSSVariables(isDark)
  for (const varName of Object.keys(CSS_VARIABLE_FALLBACKS) as (keyof CSSVariables)[]) {
    if (!resolved[varName]) {
      resolved[varName] = defaults[varName]
    }
  }

  // Get status colors with their fallbacks
  const statusColors = extractStatusColors(theme)
  resolved["--status-success"] = statusColors.success
  resolved["--status-warning"] = statusColors.warning
  resolved["--status-error"] = statusColors.error
  resolved["--status-info"] = statusColors.info
  resolved["--status-neutral"] = statusColors.neutral

  return resolved as CSSVariables
}

/**
 * Create an AppTheme from a VS Code theme and metadata.
 *
 * @param theme - The VS Code theme
 * @param meta - Theme metadata
 * @returns Complete AppTheme object
 */
export function createAppTheme(theme: VSCodeTheme, meta: ThemeMeta): AppTheme {
  const statusColors = extractStatusColors(theme)
  const essentialColors = getEssentialColors(theme)

  return {
    meta,
    statusColors,
    vscodeTheme: theme,
    colors: essentialColors,
  }
}

/**
 * Generate a CSS string with all theme variables.
 *
 * @param theme - The VS Code theme
 * @param selector - CSS selector to apply variables to (default: ":root")
 * @returns CSS string with variable definitions
 */
export function generateThemeCSS(theme: VSCodeTheme, selector: string = ":root"): string {
  const variables = mapThemeToCSSVariables(theme)
  const lines = Object.entries(variables).map(([name, value]) => `  ${name}: ${value};`)

  return `${selector} {\n${lines.join("\n")}\n}`
}

/**
 * Apply theme variables to a DOM element.
 *
 * @param element - The DOM element to apply to
 * @param theme - The VS Code theme
 */
export function applyThemeToElement(element: HTMLElement, theme: VSCodeTheme): void {
  const variables = mapThemeToCSSVariables(theme)
  for (const [name, value] of Object.entries(variables)) {
    element.style.setProperty(name, value)
  }
}

/**
 * Get the first available color from a list of keys.
 *
 * @param theme - The theme to search
 * @param keys - Keys to try in order
 * @returns The first found color or undefined
 */
function getFirstColor(theme: VSCodeTheme, keys: string[]): string | undefined {
  for (const key of keys) {
    const color = theme.colors[key]
    if (color) {
      return color
    }
  }
  return undefined
}

/**
 * Get default CSS variable values based on theme type.
 *
 * @param isDark - Whether the theme is dark
 * @returns Default CSS variables
 */
function getDefaultCSSVariables(isDark: boolean): CSSVariables {
  if (isDark) {
    return {
      "--background": "#1e1e1e",
      "--foreground": "#d4d4d4",
      "--card": "#252526",
      "--card-foreground": "#d4d4d4",
      "--popover": "#252526",
      "--popover-foreground": "#d4d4d4",
      "--primary": "#007acc",
      "--primary-foreground": "#ffffff",
      "--secondary": "#3c3c3c",
      "--secondary-foreground": "#d4d4d4",
      "--muted": "#3c3c3c",
      "--muted-foreground": "#808080",
      "--accent": "#264f78",
      "--accent-foreground": "#ffffff",
      "--destructive": "#f14c4c",
      "--border": "#454545",
      "--input": "#3c3c3c",
      "--ring": "#007acc",
      "--sidebar": "#252526",
      "--sidebar-foreground": "#d4d4d4",
      "--sidebar-primary": "#007acc",
      "--sidebar-primary-foreground": "#ffffff",
      "--sidebar-accent": "#37373d",
      "--sidebar-accent-foreground": "#d4d4d4",
      "--sidebar-border": "#454545",
      "--sidebar-ring": "#007acc",
      "--status-success": DEFAULT_DARK_STATUS_COLORS.success,
      "--status-warning": DEFAULT_DARK_STATUS_COLORS.warning,
      "--status-error": DEFAULT_DARK_STATUS_COLORS.error,
      "--status-info": DEFAULT_DARK_STATUS_COLORS.info,
      "--status-neutral": DEFAULT_DARK_STATUS_COLORS.neutral,
    }
  }

  return {
    "--background": "#ffffff",
    "--foreground": "#333333",
    "--card": "#ffffff",
    "--card-foreground": "#333333",
    "--popover": "#ffffff",
    "--popover-foreground": "#333333",
    "--primary": "#0066b8",
    "--primary-foreground": "#ffffff",
    "--secondary": "#f3f3f3",
    "--secondary-foreground": "#333333",
    "--muted": "#f3f3f3",
    "--muted-foreground": "#6e6e6e",
    "--accent": "#0066b8",
    "--accent-foreground": "#ffffff",
    "--destructive": "#d32f2f",
    "--border": "#e5e5e5",
    "--input": "#ffffff",
    "--ring": "#0066b8",
    "--sidebar": "#f3f3f3",
    "--sidebar-foreground": "#333333",
    "--sidebar-primary": "#0066b8",
    "--sidebar-primary-foreground": "#ffffff",
    "--sidebar-accent": "#e8e8e8",
    "--sidebar-accent-foreground": "#333333",
    "--sidebar-border": "#e5e5e5",
    "--sidebar-ring": "#0066b8",
    "--status-success": DEFAULT_LIGHT_STATUS_COLORS.success,
    "--status-warning": DEFAULT_LIGHT_STATUS_COLORS.warning,
    "--status-error": DEFAULT_LIGHT_STATUS_COLORS.error,
    "--status-info": DEFAULT_LIGHT_STATUS_COLORS.info,
    "--status-neutral": DEFAULT_LIGHT_STATUS_COLORS.neutral,
  }
}

/**
 * Adjust the brightness of a hex color.
 *
 * @param hex - The hex color to adjust
 * @param amount - Amount to adjust (-1 to 1, negative = darker, positive = lighter)
 * @returns Adjusted hex color
 */
function adjustColorBrightness(hex: string, amount: number): string {
  // Remove # if present
  const cleanHex = hex.replace("#", "")

  // Handle shorthand hex (e.g., #fff)
  const fullHex =
    cleanHex.length === 3 ?
      cleanHex
        .split("")
        .map(c => c + c)
        .join("")
    : cleanHex

  // Parse RGB values
  const r = parseInt(fullHex.substring(0, 2), 16)
  const g = parseInt(fullHex.substring(2, 4), 16)
  const b = parseInt(fullHex.substring(4, 6), 16)

  // Check for NaN (invalid hex)
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return hex
  }

  // Adjust brightness
  const adjust = (value: number): number => {
    const adjusted = Math.round(value + 255 * amount)
    return Math.max(0, Math.min(255, adjusted))
  }

  const newR = adjust(r)
  const newG = adjust(g)
  const newB = adjust(b)

  // Convert back to hex
  const toHex = (n: number): string => n.toString(16).padStart(2, "0")
  return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`
}

/**
 * Check if a string is a valid hex color.
 *
 * @param str - String to check
 * @returns true if valid hex color
 */
export function isValidHexColor(str: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(str)
}

/**
 * Normalize a color to 6-digit hex format.
 *
 * @param color - Color to normalize (3, 6, or 8 digit hex)
 * @returns 6-digit hex color or original if invalid
 */
export function normalizeHexColor(color: string): string {
  if (!isValidHexColor(color)) {
    return color
  }

  const hex = color.replace("#", "")

  // 3-digit hex
  if (hex.length === 3) {
    return (
      "#" +
      hex
        .split("")
        .map(c => c + c)
        .join("")
    )
  }

  // 8-digit hex (with alpha) - strip alpha
  if (hex.length === 8) {
    return "#" + hex.substring(0, 6)
  }

  return color
}
