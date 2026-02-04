import { useCallback, useRef, useEffect } from "react"
import { useTheme, type UseThemeReturn } from "./useTheme"
import { useVSCodeTheme, getLastThemeIdForMode, type UseVSCodeThemeReturn } from "./useVSCodeTheme"

/**
 * Hook that coordinates light/dark mode toggling with VS Code theme selection.
 *
 * Features:
 * - When a VS Code theme is selected, automatically switches to matching light/dark mode
 * - When light/dark mode is toggled, restores the last used VS Code theme for that mode
 * - Provides unified access to both theme and VS Code theme functionality
 */
export function useThemeCoordinator(): UseThemeCoordinatorReturn {
  // Use refs to break circular dependency between hooks
  const vscodeThemeRef = useRef<UseVSCodeThemeReturn | null>(null)
  const themeRef = useRef<UseThemeReturn | null>(null)

  // Handler for when user switches mode (light/dark)
  // This restores the last used VS Code theme for that mode
  const handleModeSwitch = useCallback((mode: "dark" | "light") => {
    const vscodeTheme = vscodeThemeRef.current
    if (!vscodeTheme) return

    const lastThemeId = getLastThemeIdForMode(mode)
    if (lastThemeId && vscodeTheme.themes.length > 0) {
      // Check if the theme exists in our list before applying
      const themeExists = vscodeTheme.themes.some(t => t.id === lastThemeId)
      if (themeExists) {
        // Use setTimeout to avoid calling applyTheme during render
        setTimeout(() => {
          vscodeTheme.applyTheme(lastThemeId)
        }, 0)
      }
    }
  }, [])

  // Handler for when VS Code theme changes the mode
  // This syncs the light/dark mode with the theme type
  const handleThemeModeChange = useCallback((mode: "dark" | "light") => {
    const theme = themeRef.current
    if (!theme) return
    // Set the mode directly without triggering mode switch callback
    theme.setTheme(mode)
  }, [])

  // Initialize hooks with their respective callbacks
  const themeHook = useTheme(handleModeSwitch)
  const vscodeTheme = useVSCodeTheme(handleThemeModeChange)

  // Update refs after hooks are initialized
  useEffect(() => {
    vscodeThemeRef.current = vscodeTheme
  }, [vscodeTheme])

  useEffect(() => {
    themeRef.current = themeHook
  }, [themeHook])

  return {
    // Light/dark mode
    theme: themeHook.theme,
    resolvedTheme: themeHook.resolvedTheme,
    setTheme: themeHook.setTheme,
    setMode: themeHook.setMode,
    cycleTheme: themeHook.cycleTheme,

    // VS Code themes
    themes: vscodeTheme.themes,
    activeTheme: vscodeTheme.activeTheme,
    activeThemeId: vscodeTheme.activeThemeId,
    currentVSCodeTheme: vscodeTheme.currentVSCodeTheme,
    variant: vscodeTheme.variant,
    isLoadingList: vscodeTheme.isLoadingList,
    isLoadingTheme: vscodeTheme.isLoadingTheme,
    error: vscodeTheme.error,
    fetchThemes: vscodeTheme.fetchThemes,
    applyTheme: vscodeTheme.applyTheme,
    previewTheme: vscodeTheme.previewTheme,
    clearPreview: vscodeTheme.clearPreview,
    resetToDefault: vscodeTheme.resetToDefault,
  }
}

export interface UseThemeCoordinatorReturn extends UseThemeReturn, UseVSCodeThemeReturn {}
