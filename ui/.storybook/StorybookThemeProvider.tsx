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

/**
 * Syncs Storybook's selected theme with the application's theme systems.
 *
 * This provider:
 * 1. Updates the Zustand store's theme setting (light/dark) based on the VS Code theme
 * 2. Loads the VS Code theme into Shiki for syntax highlighting
 *
 * The store sync happens synchronously during render (before children render)
 * to prevent children from seeing the wrong theme on initial load.
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

  // Sync Zustand store synchronously during render, before children render
  // This is safe because it's idempotent and only updates external state (Zustand)
  if (syncedThemeRef.current !== targetTheme) {
    syncedThemeRef.current = targetTheme
    useAppStore.getState().setTheme(targetTheme)
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
