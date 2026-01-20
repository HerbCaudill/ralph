/**
 * Theme types for VS Code theme support in ralph-ui.
 *
 * These types are used for:
 * - Parsing VS Code theme files
 * - Storing processed theme data for the application
 * - Providing type-safe access to status colors
 */

/**
 * Raw VS Code theme file structure.
 * This matches the format of .json theme files in VS Code extensions.
 */
export interface VSCodeTheme {
  /** Schema URL, typically "vscode://schemas/color-theme" */
  $schema?: string

  /** Display name of the theme */
  name: string

  /** Theme type: dark, light, or high contrast variants */
  type: "dark" | "light" | "hcDark" | "hcLight"

  /** Whether semantic highlighting is enabled */
  semanticHighlighting?: boolean

  /** Token colors for syntax highlighting (TextMate scopes) */
  tokenColors: VSCodeTokenColor[]

  /** Editor and UI colors */
  colors: VSCodeEditorColors

  /** Semantic token colors */
  semanticTokenColors?: Record<string, VSCodeTokenSettings | string>
}

/**
 * Token color definition for syntax highlighting.
 */
export interface VSCodeTokenColor {
  /** Optional name describing what this token color is for */
  name?: string

  /** TextMate scope(s) this color applies to */
  scope?: string | string[]

  /** Color and style settings */
  settings: VSCodeTokenSettings
}

/**
 * Token styling settings.
 */
export interface VSCodeTokenSettings {
  /** Foreground color in hex format (e.g., "#ebdbb2") */
  foreground?: string

  /** Background color in hex format */
  background?: string

  /** Font style: italic, bold, underline, or combinations */
  fontStyle?: string
}

/**
 * Editor and UI color definitions from VS Code theme.
 * This is a subset of the full VS Code color reference.
 * @see https://code.visualstudio.com/api/references/theme-color
 */
export interface VSCodeEditorColors {
  // Base colors
  foreground?: string
  focusBorder?: string
  "selection.background"?: string
  "widget.shadow"?: string
  "widget.border"?: string
  errorForeground?: string
  "icon.foreground"?: string

  // Editor colors
  "editor.background"?: string
  "editor.foreground"?: string
  "editor.lineHighlightBackground"?: string
  "editor.selectionBackground"?: string
  "editor.selectionForeground"?: string
  "editor.inactiveSelectionBackground"?: string

  // Editor gutter
  "editorGutter.background"?: string
  "editorGutter.addedBackground"?: string
  "editorGutter.modifiedBackground"?: string
  "editorGutter.deletedBackground"?: string

  // Editor line numbers
  "editorLineNumber.foreground"?: string
  "editorLineNumber.activeForeground"?: string

  // Status colors (for our app's status indicators)
  "terminal.ansiGreen"?: string
  "terminal.ansiYellow"?: string
  "terminal.ansiRed"?: string
  "terminal.ansiBlue"?: string
  "terminal.ansiBrightGreen"?: string
  "terminal.ansiBrightYellow"?: string
  "terminal.ansiBrightRed"?: string
  "terminal.ansiBrightBlue"?: string

  // Git decoration colors
  "gitDecoration.addedResourceForeground"?: string
  "gitDecoration.modifiedResourceForeground"?: string
  "gitDecoration.deletedResourceForeground"?: string
  "gitDecoration.untrackedResourceForeground"?: string

  // Editor warnings/errors
  "editorWarning.foreground"?: string
  "editorError.foreground"?: string
  "editorInfo.foreground"?: string

  // Input validation
  "inputValidation.errorBackground"?: string
  "inputValidation.errorBorder"?: string
  "inputValidation.warningBackground"?: string
  "inputValidation.warningBorder"?: string
  "inputValidation.infoBackground"?: string
  "inputValidation.infoBorder"?: string

  // Activity bar
  "activityBar.background"?: string
  "activityBar.foreground"?: string

  // Sidebar
  "sideBar.background"?: string
  "sideBar.foreground"?: string
  "sideBarTitle.foreground"?: string
  "sideBarSectionHeader.background"?: string
  "sideBarSectionHeader.foreground"?: string

  // Buttons
  "button.background"?: string
  "button.foreground"?: string
  "button.hoverBackground"?: string

  // Inputs
  "input.background"?: string
  "input.foreground"?: string
  "input.border"?: string
  "input.placeholderForeground"?: string

  // Dropdown
  "dropdown.background"?: string
  "dropdown.foreground"?: string
  "dropdown.border"?: string

  // Lists
  "list.hoverBackground"?: string
  "list.activeSelectionBackground"?: string
  "list.activeSelectionForeground"?: string
  "list.inactiveSelectionBackground"?: string
  "list.inactiveSelectionForeground"?: string

  // Badge
  "badge.background"?: string
  "badge.foreground"?: string

  // Scrollbar
  "scrollbar.shadow"?: string
  "scrollbarSlider.background"?: string
  "scrollbarSlider.hoverBackground"?: string
  "scrollbarSlider.activeBackground"?: string

  // Tab colors
  "tab.activeBackground"?: string
  "tab.activeForeground"?: string
  "tab.inactiveBackground"?: string
  "tab.inactiveForeground"?: string
  "tab.border"?: string

  // Panel
  "panel.background"?: string
  "panel.border"?: string
  "panelTitle.activeBorder"?: string
  "panelTitle.activeForeground"?: string
  "panelTitle.inactiveForeground"?: string

  // Status bar
  "statusBar.background"?: string
  "statusBar.foreground"?: string
  "statusBar.debuggingBackground"?: string
  "statusBar.debuggingForeground"?: string
  "statusBar.noFolderBackground"?: string
  "statusBar.noFolderForeground"?: string

  // Title bar
  "titleBar.activeBackground"?: string
  "titleBar.activeForeground"?: string
  "titleBar.inactiveBackground"?: string
  "titleBar.inactiveForeground"?: string

  // Borders
  contrastBorder?: string
  contrastActiveBorder?: string

  // Allow additional colors not explicitly defined
  [key: string]: string | undefined
}

/**
 * Status colors extracted from a theme for use in the application.
 * These are the semantic colors used throughout the UI for status indicators.
 */
export interface StatusColors {
  /** Color for success states (e.g., completed tasks, passing tests) */
  success: string

  /** Color for warning states (e.g., pending review, caution needed) */
  warning: string

  /** Color for error states (e.g., failed tasks, errors) */
  error: string

  /** Color for informational states (e.g., in progress, notes) */
  info: string

  /** Color for neutral states (e.g., not started, deferred) */
  neutral: string
}

/**
 * Metadata about a theme, used for theme selection UI.
 */
export interface ThemeMeta {
  /** Unique identifier for the theme (extension id + theme path) */
  id: string

  /** Display name of the theme (e.g., "Gruvbox Dark Medium") */
  label: string

  /** Theme type for categorization */
  type: "dark" | "light" | "hcDark" | "hcLight"

  /** Path to the theme file */
  path: string

  /** VS Code extension ID that provides this theme */
  extensionId: string

  /** Extension display name */
  extensionName: string
}

/**
 * Processed theme ready for application use.
 * This is the result of parsing a VSCodeTheme and mapping its colors
 * to the application's theming system.
 */
export interface AppTheme {
  /** Theme metadata */
  meta: ThemeMeta

  /** Status colors extracted from the theme */
  statusColors: StatusColors

  /** Full VS Code theme for code highlighting with shiki */
  vscodeTheme: VSCodeTheme

  /** Primary colors extracted for the application UI */
  colors: {
    /** Main background color */
    background: string

    /** Main foreground/text color */
    foreground: string

    /** Accent/primary color for interactive elements */
    accent: string

    /** Muted text color */
    muted: string

    /** Border color */
    border: string

    /** Selection highlight color */
    selection: string
  }
}

/**
 * Default fallback status colors when a theme doesn't provide enough information.
 * These are neutral colors that work reasonably well in both light and dark modes.
 */
export const DEFAULT_STATUS_COLORS: StatusColors = {
  success: "#22c55e", // Green
  warning: "#f59e0b", // Amber
  error: "#ef4444", // Red
  info: "#3b82f6", // Blue
  neutral: "#6b7280", // Gray
}

/**
 * Default fallback colors for dark themes.
 */
export const DEFAULT_DARK_STATUS_COLORS: StatusColors = {
  success: "#4ade80", // Bright green
  warning: "#fbbf24", // Bright amber
  error: "#f87171", // Bright red
  info: "#60a5fa", // Bright blue
  neutral: "#9ca3af", // Light gray
}

/**
 * Default fallback colors for light themes.
 */
export const DEFAULT_LIGHT_STATUS_COLORS: StatusColors = {
  success: "#16a34a", // Dark green
  warning: "#d97706", // Dark amber
  error: "#dc2626", // Dark red
  info: "#2563eb", // Dark blue
  neutral: "#4b5563", // Dark gray
}
