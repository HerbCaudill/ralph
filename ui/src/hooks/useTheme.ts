import { useEffect, useCallback } from "react"
import { useAppStore, selectTheme, type Theme } from "@/store"

// Constants

/** localStorage key for persisting theme preference */
const THEME_STORAGE_KEY = "ralph-ui-theme"

// Types

export interface UseThemeReturn {
  /** Current theme setting ("system", "light", or "dark") */
  theme: Theme
  /** Resolved theme based on system preference when theme is "system" */
  resolvedTheme: "light" | "dark"
  /** Set the theme preference */
  setTheme: (theme: Theme) => void
  /** Toggle between light and dark (or system -> light -> dark -> system) */
  cycleTheme: () => void
}

// Helper Functions

/**
 * Gets the system color scheme preference
 */
function getSystemPreference(): "light" | "dark" {
  if (typeof window === "undefined") return "dark"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

/**
 * Applies the theme to the document
 */
function applyTheme(resolvedTheme: "light" | "dark") {
  const root = document.documentElement
  if (resolvedTheme === "dark") {
    root.classList.add("dark")
  } else {
    root.classList.remove("dark")
  }
}

/**
 * Gets the stored theme from localStorage
 */
export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system"
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored
  }
  return "system"
}

/**
 * Saves the theme to localStorage
 */
function saveTheme(theme: Theme) {
  localStorage.setItem(THEME_STORAGE_KEY, theme)
}

// Hook

/**
 * Hook for managing light/dark theme with system preference support.
 *
 * Features:
 * - Defaults to system preference
 * - Allows manual override to light or dark
 * - Persists preference to localStorage
 * - Listens for system preference changes
 * - Applies theme by adding/removing 'dark' class on document.documentElement
 */
export function useTheme(): UseThemeReturn {
  const theme = useAppStore(selectTheme)
  const storeSetTheme = useAppStore(state => state.setTheme)

  // Resolve the theme based on system preference when theme is "system"
  const resolvedTheme: "light" | "dark" = theme === "system" ? getSystemPreference() : theme

  // Set theme and persist to localStorage
  const setTheme = useCallback(
    (newTheme: Theme) => {
      storeSetTheme(newTheme)
      saveTheme(newTheme)
    },
    [storeSetTheme],
  )

  // Cycle through themes: system -> light -> dark -> system
  const cycleTheme = useCallback(() => {
    const nextTheme: Theme =
      theme === "system" ? "light"
      : theme === "light" ? "dark"
      : "system"
    setTheme(nextTheme)
  }, [theme, setTheme])

  // Initialize theme from localStorage on mount
  useEffect(() => {
    const stored = getStoredTheme()
    if (stored !== theme) {
      storeSetTheme(stored)
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Apply theme to document when resolvedTheme changes
  useEffect(() => {
    applyTheme(resolvedTheme)
  }, [resolvedTheme])

  // Listen for system preference changes when theme is "system"
  useEffect(() => {
    if (theme !== "system") return

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = () => {
      applyTheme(getSystemPreference())
    }

    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [theme])

  return {
    theme,
    resolvedTheme,
    setTheme,
    cycleTheme,
  }
}
