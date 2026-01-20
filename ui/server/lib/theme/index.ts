// Re-export all theme types and constants
export type {
  VSCodeTheme,
  VSCodeTokenColor,
  VSCodeTokenSettings,
  VSCodeEditorColors,
  StatusColors,
  ThemeMeta,
  AppTheme,
} from "./types.js"

export {
  DEFAULT_STATUS_COLORS,
  DEFAULT_DARK_STATUS_COLORS,
  DEFAULT_LIGHT_STATUS_COLORS,
} from "./types.js"

// Re-export parser functions and types
export type { ParseResult, ValidationResult } from "./parser.js"
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
} from "./parser.js"

// Re-export mapper functions and types
export type { CSSVariables } from "./mapper.js"
export {
  extractStatusColors,
  mapThemeToCSSVariables,
  createAppTheme,
  generateThemeCSS,
  applyThemeToElement,
  isValidHexColor,
  normalizeHexColor,
} from "./mapper.js"
