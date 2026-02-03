/** Metadata about a theme, used for theme selection UI. */
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
