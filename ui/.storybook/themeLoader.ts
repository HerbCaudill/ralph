/**
 * Theme loader for Storybook.
 *
 * Loads vendored VS Code theme JSON files and provides them as parsed
 * VSCodeTheme objects for use in Storybook decorators.
 */

import { parseThemeObject, type VSCodeTheme } from "../src/lib/theme"

import lightPlusJson from "./themes/light-plus.json"
import darkPlusJson from "./themes/dark-plus.json"
import solarizedLightJson from "./themes/solarized-light.json"
import solarizedDarkJson from "./themes/solarized-dark.json"

/** Theme definition with parsed theme and metadata */
export interface StorybookTheme {
  /** Display name shown in Storybook toolbar */
  name: string
  /** Unique identifier for the theme */
  id: string
  /** Whether this is a dark theme */
  isDark: boolean
  /** The parsed VS Code theme object */
  theme: VSCodeTheme
}

/**
 * Parse a theme JSON object, throwing an error if parsing fails.
 *
 * @param json - The raw theme JSON object
 * @param name - The theme name (for error messages)
 * @returns The parsed VSCodeTheme
 */
function parseTheme(json: unknown, name: string): VSCodeTheme {
  const result = parseThemeObject(json)
  if (!result.success) {
    throw new Error(`Failed to parse theme "${name}": ${result.error}`)
  }
  return result.theme
}

/** Available themes for Storybook */
export const storybookThemes: StorybookTheme[] = [
  {
    name: "Light+",
    id: "light-plus",
    isDark: false,
    theme: parseTheme(lightPlusJson, "Light+"),
  },
  {
    name: "Dark+",
    id: "dark-plus",
    isDark: true,
    theme: parseTheme(darkPlusJson, "Dark+"),
  },
  {
    name: "Solarized Light",
    id: "solarized-light",
    isDark: false,
    theme: parseTheme(solarizedLightJson, "Solarized Light"),
  },
  {
    name: "Solarized Dark",
    id: "solarized-dark",
    isDark: true,
    theme: parseTheme(solarizedDarkJson, "Solarized Dark"),
  },
]

/** Map of theme IDs to parsed themes for quick lookup */
export const themeMap = new Map<string, StorybookTheme>(storybookThemes.map(t => [t.id, t]))

/**
 * Get a theme by ID.
 *
 * @param id - The theme ID
 * @returns The theme or undefined if not found
 */
export function getTheme(id: string): StorybookTheme | undefined {
  return themeMap.get(id)
}

/** Default theme ID to use on initial load */
export const defaultThemeId = "light-plus"
