// Re-export all theme types and constants
export type {
  VSCodeTheme,
  VSCodeTokenColor,
  VSCodeTokenSettings,
  VSCodeEditorColors,
  StatusColors,
  ThemeMeta,
  AppTheme,
} from "./types"

export {
  DEFAULT_STATUS_COLORS,
  DEFAULT_DARK_STATUS_COLORS,
  DEFAULT_LIGHT_STATUS_COLORS,
} from "./types"

// Re-export highlighter functions
export {
  getHighlighter,
  loadTheme,
  getCurrentCustomThemeName,
  getDefaultThemeName,
  highlight,
  isLanguageSupported,
  getSupportedLanguages,
  normalizeLanguage,
} from "./highlighter"

// Re-export parser functions and types
export type { ParseResult, ValidationResult } from "./parser"
export {
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

// Re-export mapper functions and types
export type { CSSVariables } from "./mapper"
export {
  extractStatusColors,
  mapThemeToCSSVariables,
  createAppTheme,
  generateThemeCSS,
  applyThemeToElement,
  isValidHexColor,
  normalizeHexColor,
} from "./mapper"
