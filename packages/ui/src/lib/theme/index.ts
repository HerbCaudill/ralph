// Re-export all theme types and constants
export type {
  VSCodeTheme,
  VSCodeTokenColor,
  VSCodeTokenSettings,
  VSCodeEditorColors,
  StatusColors,
  ThemeMeta,
  AppTheme,
} from "@herbcaudill/agent-view-theme"

export {
  DEFAULT_STATUS_COLORS,
  DEFAULT_DARK_STATUS_COLORS,
  DEFAULT_LIGHT_STATUS_COLORS,
} from "@herbcaudill/agent-view-theme"

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
} from "@herbcaudill/agent-view-theme"

// Re-export parser functions and types
export type { ParseResult, ValidationResult } from "@herbcaudill/agent-view-theme"
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
} from "@herbcaudill/agent-view-theme"

// Re-export mapper functions and types
export type { CSSVariables } from "@herbcaudill/agent-view-theme"
export {
  extractStatusColors,
  mapThemeToCSSVariables,
  createAppTheme,
  generateThemeCSS,
  applyThemeToElement,
  isValidHexColor,
  normalizeHexColor,
} from "@herbcaudill/agent-view-theme"
