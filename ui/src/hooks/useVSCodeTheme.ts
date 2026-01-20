/**
 * Hook for managing VS Code themes in ralph-ui.
 *
 * This hook provides:
 * - Fetching available VS Code themes from the API
 * - Auto-applying the current VS Code theme on mount
 * - Theme switching with CSS variable application
 * - Preview on hover functionality for theme picker
 * - Loading a theme into Shiki for code highlighting
 */

import { useState, useEffect, useCallback, useRef } from "react"
import type { ThemeMeta, AppTheme } from "@/lib/theme"
import { loadTheme, applyThemeToElement } from "@/lib/theme"
import type { CSSVariables } from "@/lib/theme/mapper"

// localStorage key for persisting VS Code theme preference
const VSCODE_THEME_STORAGE_KEY = "ralph-ui-vscode-theme"

// Types

export interface ThemeListResponse {
  ok: boolean
  themes: ThemeMeta[]
  currentTheme: string | null
  variant: string | null
  error?: string
}

export interface ThemeDetailResponse {
  ok: boolean
  theme?: AppTheme
  cssVariables?: CSSVariables
  error?: string
}

export interface UseVSCodeThemeReturn {
  /** List of available VS Code themes */
  themes: ThemeMeta[]
  /** Currently active theme (null if using default) */
  activeTheme: AppTheme | null
  /** Theme ID of the currently active theme */
  activeThemeId: string | null
  /** The current VS Code theme name (from VS Code settings) */
  currentVSCodeTheme: string | null
  /** VS Code variant name (e.g., "VS Code", "VS Code Insiders", "Cursor") */
  variant: string | null
  /** Loading state for theme list */
  isLoadingList: boolean
  /** Loading state for theme details */
  isLoadingTheme: boolean
  /** Error message if any operation failed */
  error: string | null
  /** Fetch the list of available themes */
  fetchThemes: () => Promise<void>
  /** Apply a theme by ID */
  applyTheme: (themeId: string) => Promise<void>
  /** Preview a theme (temporary application without saving) */
  previewTheme: (themeId: string) => Promise<void>
  /** Clear the preview and restore the active theme */
  clearPreview: () => void
  /** Reset to the default theme (clear VS Code theme) */
  resetToDefault: () => void
}

// Helper Functions

/**
 * Get the stored VS Code theme ID from localStorage
 */
function getStoredThemeId(): string | null {
  try {
    return localStorage.getItem(VSCODE_THEME_STORAGE_KEY)
  } catch {
    return null
  }
}

/**
 * Save the VS Code theme ID to localStorage
 */
function saveThemeId(themeId: string | null): void {
  try {
    if (themeId) {
      localStorage.setItem(VSCODE_THEME_STORAGE_KEY, themeId)
    } else {
      localStorage.removeItem(VSCODE_THEME_STORAGE_KEY)
    }
  } catch {
    // localStorage may not be available
  }
}

/**
 * Apply CSS variables to the document root element
 */
function applyCSSVariables(cssVariables: CSSVariables): void {
  applyThemeToElement(document.documentElement, {
    name: "applied-theme",
    type: "dark",
    colors: {},
    tokenColors: [],
  })
  // Apply the pre-computed CSS variables directly
  for (const [name, value] of Object.entries(cssVariables)) {
    document.documentElement.style.setProperty(name, value)
  }
}

/**
 * Clear all custom CSS variables from the document root
 */
function clearCSSVariables(): void {
  const root = document.documentElement
  const style = root.style

  // Remove all our custom CSS variables
  const cssVarNames = [
    "--background",
    "--foreground",
    "--card",
    "--card-foreground",
    "--popover",
    "--popover-foreground",
    "--primary",
    "--primary-foreground",
    "--secondary",
    "--secondary-foreground",
    "--muted",
    "--muted-foreground",
    "--accent",
    "--accent-foreground",
    "--destructive",
    "--border",
    "--input",
    "--ring",
    "--sidebar",
    "--sidebar-foreground",
    "--sidebar-primary",
    "--sidebar-primary-foreground",
    "--sidebar-accent",
    "--sidebar-accent-foreground",
    "--sidebar-border",
    "--sidebar-ring",
    "--status-success",
    "--status-warning",
    "--status-error",
    "--status-info",
    "--status-neutral",
  ]

  for (const name of cssVarNames) {
    style.removeProperty(name)
  }
}

// Hook

/**
 * Hook for managing VS Code themes.
 *
 * Features:
 * - Fetches available themes from the server API
 * - Auto-applies the stored or current VS Code theme on mount
 * - Supports theme switching and preview on hover
 * - Loads themes into Shiki for code highlighting
 * - Persists theme preference to localStorage
 */
export function useVSCodeTheme(): UseVSCodeThemeReturn {
  // State
  const [themes, setThemes] = useState<ThemeMeta[]>([])
  const [activeTheme, setActiveTheme] = useState<AppTheme | null>(null)
  const [activeThemeId, setActiveThemeId] = useState<string | null>(null)
  const [currentVSCodeTheme, setCurrentVSCodeTheme] = useState<string | null>(null)
  const [variant, setVariant] = useState<string | null>(null)
  const [isLoadingList, setIsLoadingList] = useState(false)
  const [isLoadingTheme, setIsLoadingTheme] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Refs for preview state
  const previewThemeIdRef = useRef<string | null>(null)
  const savedCSSRef = useRef<Map<string, string> | null>(null)

  // Fetch theme details by ID
  const fetchThemeDetails = useCallback(async (themeId: string): Promise<ThemeDetailResponse> => {
    const encodedId = encodeURIComponent(themeId)
    const response = await fetch(`/api/themes/${encodedId}`)
    return response.json()
  }, [])

  // Fetch the list of available themes
  const fetchThemes = useCallback(async () => {
    setIsLoadingList(true)
    setError(null)

    try {
      const response = await fetch("/api/themes")
      const data: ThemeListResponse = await response.json()

      if (!data.ok) {
        throw new Error(data.error || "Failed to fetch themes")
      }

      setThemes(data.themes)
      setCurrentVSCodeTheme(data.currentTheme)
      setVariant(data.variant)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch themes"
      setError(message)
    } finally {
      setIsLoadingList(false)
    }
  }, [])

  // Apply a theme by ID (saves to localStorage)
  const applyTheme = useCallback(
    async (themeId: string) => {
      // Clear any preview state
      previewThemeIdRef.current = null
      savedCSSRef.current = null

      setIsLoadingTheme(true)
      setError(null)

      try {
        const data = await fetchThemeDetails(themeId)

        if (!data.ok || !data.theme || !data.cssVariables) {
          throw new Error(data.error || "Failed to load theme")
        }

        // Apply CSS variables to the document
        applyCSSVariables(data.cssVariables)

        // Load the theme into Shiki for code highlighting
        await loadTheme(data.theme.vscodeTheme, themeId)

        // Update state
        setActiveTheme(data.theme)
        setActiveThemeId(themeId)

        // Persist to localStorage
        saveThemeId(themeId)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to apply theme"
        setError(message)
      } finally {
        setIsLoadingTheme(false)
      }
    },
    [fetchThemeDetails],
  )

  // Preview a theme (temporary application without saving)
  const previewTheme = useCallback(
    async (themeId: string) => {
      // Don't preview if it's already the active theme
      if (themeId === activeThemeId) return

      // Save current CSS values if this is the first preview
      if (!savedCSSRef.current) {
        savedCSSRef.current = new Map()
        const style = document.documentElement.style
        const cssVarNames = [
          "--background",
          "--foreground",
          "--card",
          "--card-foreground",
          "--popover",
          "--popover-foreground",
          "--primary",
          "--primary-foreground",
          "--secondary",
          "--secondary-foreground",
          "--muted",
          "--muted-foreground",
          "--accent",
          "--accent-foreground",
          "--destructive",
          "--border",
          "--input",
          "--ring",
          "--sidebar",
          "--sidebar-foreground",
          "--sidebar-primary",
          "--sidebar-primary-foreground",
          "--sidebar-accent",
          "--sidebar-accent-foreground",
          "--sidebar-border",
          "--sidebar-ring",
          "--status-success",
          "--status-warning",
          "--status-error",
          "--status-info",
          "--status-neutral",
        ]
        for (const name of cssVarNames) {
          const value = style.getPropertyValue(name)
          if (value) {
            savedCSSRef.current.set(name, value)
          }
        }
      }

      previewThemeIdRef.current = themeId

      try {
        const data = await fetchThemeDetails(themeId)

        // Check if we're still previewing the same theme (user might have moved)
        if (previewThemeIdRef.current !== themeId) return

        if (!data.ok || !data.cssVariables) {
          return
        }

        // Apply CSS variables temporarily
        applyCSSVariables(data.cssVariables)
      } catch {
        // Silently fail preview errors
      }
    },
    [activeThemeId, fetchThemeDetails],
  )

  // Clear the preview and restore the active theme
  const clearPreview = useCallback(() => {
    previewThemeIdRef.current = null

    // Restore saved CSS values
    if (savedCSSRef.current) {
      // First clear all custom properties
      clearCSSVariables()

      // Then restore the saved values
      const style = document.documentElement.style
      for (const [name, value] of savedCSSRef.current) {
        style.setProperty(name, value)
      }
      savedCSSRef.current = null
    }
  }, [])

  // Reset to the default theme (clear VS Code theme)
  const resetToDefault = useCallback(() => {
    // Clear any preview
    previewThemeIdRef.current = null
    savedCSSRef.current = null

    // Clear CSS variables
    clearCSSVariables()

    // Clear state
    setActiveTheme(null)
    setActiveThemeId(null)

    // Remove from localStorage
    saveThemeId(null)
  }, [])

  // Initialize: fetch themes and apply stored/current theme on mount
  useEffect(() => {
    let mounted = true

    const initialize = async () => {
      // Fetch themes first
      await fetchThemes()

      if (!mounted) return

      // Try to apply stored theme first
      const storedId = getStoredThemeId()
      if (storedId) {
        await applyTheme(storedId)
        return
      }

      // If no stored theme, try to find and apply the current VS Code theme
      // This will be handled after fetchThemes completes via currentVSCodeTheme state
    }

    initialize()

    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-apply current VS Code theme if no stored theme is present
  useEffect(() => {
    // Skip if we already have an active theme or are loading
    if (activeThemeId || isLoadingTheme || isLoadingList) return
    // Skip if no current theme from VS Code
    if (!currentVSCodeTheme) return

    // Find the theme by label matching the currentVSCodeTheme
    const matchingTheme = themes.find(t => t.label === currentVSCodeTheme)
    if (matchingTheme) {
      applyTheme(matchingTheme.id)
    }
  }, [currentVSCodeTheme, themes, activeThemeId, isLoadingTheme, isLoadingList, applyTheme])

  return {
    themes,
    activeTheme,
    activeThemeId,
    currentVSCodeTheme,
    variant,
    isLoadingList,
    isLoadingTheme,
    error,
    fetchThemes,
    applyTheme,
    previewTheme,
    clearPreview,
    resetToDefault,
  }
}
