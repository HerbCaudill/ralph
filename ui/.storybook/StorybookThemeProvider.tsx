/**
 * Storybook-specific theme provider that syncs the selected VS Code theme
 * with both the Zustand store and the Shiki highlighter.
 *
 * This ensures syntax highlighting uses the correct theme colors when
 * previewing components in Storybook.
 */

import { useEffect, type ReactNode } from "react"
import { useAppStore } from "../src/store"
import { loadTheme } from "../src/lib/theme/highlighter"
import type { StorybookTheme } from "./themeLoader"

/**
 * Syncs Storybook's selected theme with the application's theme systems.
 *
 * This provider:
 * 1. Updates the Zustand store's theme setting (light/dark) based on the VS Code theme
 * 2. Loads the VS Code theme into Shiki for syntax highlighting
 */
export function StorybookThemeProvider({
  theme,
  children,
}: {
  /** The currently selected Storybook theme */
  theme: StorybookTheme
  children: ReactNode
}) {
  // Sync Zustand store with Storybook theme
  useEffect(() => {
    useAppStore.getState().setTheme(theme.isDark ? "dark" : "light")
  }, [theme.isDark])

  // Load VS Code theme into Shiki for syntax highlighting
  useEffect(() => {
    loadTheme(theme.theme, theme.id)
  }, [theme])

  return <>{children}</>
}

type Props = {
  /** The currently selected Storybook theme */
  theme: StorybookTheme
  children: ReactNode
}
