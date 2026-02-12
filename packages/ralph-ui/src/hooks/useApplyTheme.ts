import { useEffect, useCallback, useRef } from "react"
import {
  useUiStore,
  selectVscodeThemeId,
  selectLastDarkThemeId,
  selectLastLightThemeId,
} from "@/stores/uiStore"
import { useTheme } from "./useTheme"
import { useThemes } from "./useThemes"
import { fetchThemeDetails } from "@/lib/fetchThemeDetails"
import { applyThemeCSSVariables } from "@/lib/applyThemeCSSVariables"
import { clearThemeCSSVariables } from "@/lib/clearThemeCSSVariables"

/**
 * Hook that manages VS Code theme application lifecycle.
 *
 * Handles:
 * - Fetching theme CSS variables from the server on selection
 * - Applying CSS variables to document.documentElement
 * - Restoring the last used theme for the current mode on mode switch
 * - Clearing CSS variables when no theme is selected
 * - Auto-applying the stored theme on mount
 */
export function useApplyTheme(): UseApplyThemeReturn {
  const vscodeThemeId = useUiStore(selectVscodeThemeId)
  const lastDarkThemeId = useUiStore(selectLastDarkThemeId)
  const lastLightThemeId = useUiStore(selectLastLightThemeId)
  const setVscodeThemeId = useUiStore(state => state.setVscodeThemeId)
  const setLastDarkThemeId = useUiStore(state => state.setLastDarkThemeId)
  const setLastLightThemeId = useUiStore(state => state.setLastLightThemeId)

  const { themes } = useThemes()

  const handleModeSwitch = useCallback(
    (mode: "dark" | "light") => {
      const lastThemeId = mode === "dark" ? lastDarkThemeId : lastLightThemeId
      if (lastThemeId && themes.some(t => t.id === lastThemeId)) {
        setVscodeThemeId(lastThemeId)
      } else {
        // No saved theme for this mode — clear custom theme
        setVscodeThemeId(null)
        clearThemeCSSVariables(document.documentElement)
      }
    },
    [lastDarkThemeId, lastLightThemeId, themes, setVscodeThemeId],
  )

  const { resolvedTheme, setTheme: setAppearanceMode } = useTheme(handleModeSwitch)

  // Track previous theme ID to avoid re-fetching on every render
  const appliedThemeIdRef = useRef<string | null>(null)

  /** Apply a theme by ID: fetch CSS variables from the server and apply them to the DOM. */
  const applyTheme = useCallback(
    async (themeId: string) => {
      setVscodeThemeId(themeId)

      // Remember which mode this theme belongs to
      const theme = themes.find(t => t.id === themeId)
      if (theme) {
        const isDark = theme.type === "dark" || theme.type === "hcDark"
        if (isDark) {
          setLastDarkThemeId(themeId)
        } else {
          setLastLightThemeId(themeId)
        }
      }

      const details = await fetchThemeDetails(themeId)
      if (details) {
        applyThemeCSSVariables(document.documentElement, details.cssVariables)
        appliedThemeIdRef.current = themeId
      }
    },
    [themes, setVscodeThemeId, setLastDarkThemeId, setLastLightThemeId],
  )

  /** Change appearance mode and restore the last theme for that mode. */
  const changeMode = useCallback(
    (mode: "system" | "light" | "dark") => {
      setAppearanceMode(mode)
    },
    [setAppearanceMode],
  )

  // Auto-apply the stored theme on mount and when vscodeThemeId changes
  useEffect(() => {
    if (vscodeThemeId && vscodeThemeId !== appliedThemeIdRef.current) {
      fetchThemeDetails(vscodeThemeId).then(details => {
        if (details) {
          applyThemeCSSVariables(document.documentElement, details.cssVariables)
          appliedThemeIdRef.current = vscodeThemeId
        }
      })
    } else if (!vscodeThemeId && appliedThemeIdRef.current) {
      clearThemeCSSVariables(document.documentElement)
      appliedThemeIdRef.current = null
    }
  }, [vscodeThemeId])

  return {
    applyTheme,
    changeMode,
    resolvedTheme,
  }
}

export interface UseApplyThemeReturn {
  /** Apply a VS Code theme by ID (fetches and applies CSS variables). */
  applyTheme: (themeId: string) => Promise<void>
  /** Change appearance mode (system/light/dark), restoring the last theme for that mode. */
  changeMode: (mode: "system" | "light" | "dark") => void
  /** The current resolved theme ("light" or "dark"). */
  resolvedTheme: "light" | "dark"
}
