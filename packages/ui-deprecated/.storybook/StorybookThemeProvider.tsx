/**
 * Storybook-specific theme provider that syncs the selected VS Code theme
 * with both the Zustand store and the Shiki highlighter.
 *
 * This ensures syntax highlighting uses the correct theme colors when
 * previewing components in Storybook.
 */

import { useEffect, useRef, type ReactNode } from "react"
import { useAppStore } from "../src/store"
import { loadTheme } from "../src/lib/theme/highlighter"
import type { StorybookTheme } from "./themeLoader"

/** localStorage key used by useTheme hook */
const THEME_STORAGE_KEY = "ralph-ui-theme"

/**
 * Syncs Storybook's selected theme with the application's theme systems.
 *
 * This provider:
 * 1. Updates the Zustand store's theme setting (light/dark) based on the VS Code theme
 * 2. Updates localStorage to prevent useTheme's mount effect from overriding the store
 * 3. Loads the VS Code theme into Shiki for syntax highlighting
 *
 * The store and localStorage sync happens synchronously during render (before
 * children render) to prevent children from seeing the wrong theme on initial load.
 */
export function StorybookThemeProvider({
  theme,
  children,
}: {
  /** The currently selected Storybook theme */
  theme: StorybookTheme
  children: ReactNode
}) {
  // Track what theme we've synced to avoid unnecessary updates
  const syncedThemeRef = useRef<string | null>(null)
  const targetTheme = theme.isDark ? "dark" : "light"

  // Sync Zustand store and localStorage synchronously during render, before children render
  // This is safe because it's idempotent and only updates external state
  // We also set localStorage to prevent useTheme's mount effect from overriding the store
  if (syncedThemeRef.current !== targetTheme) {
    syncedThemeRef.current = targetTheme
    useAppStore.getState().setTheme(targetTheme)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, targetTheme)
    } catch {
      // localStorage may not be available
    }
  }

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
