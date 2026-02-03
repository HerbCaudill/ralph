import { useEffect, useCallback } from "react"
import { useUiStore, selectTheme } from "@/stores/uiStore"

/** Theme preference type. */
type Theme = "system" | "light" | "dark"

/** Gets the system color scheme preference. */
function getSystemPreference(): "light" | "dark" {
  if (typeof window === "undefined") return "dark"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

/** Applies the theme to the document. */
function applyTheme(resolvedTheme: "light" | "dark") {
  const root = document.documentElement
  if (resolvedTheme === "dark") {
    root.classList.add("dark")
  } else {
    root.classList.remove("dark")
  }
}

/**
 * Hook for managing light/dark theme with system preference support.
 *
 * Features:
 * - Defaults to system preference
 * - Allows manual override to light or dark
 * - Persists preference via zustand store
 * - Listens for system preference changes
 * - Applies theme by adding/removing 'dark' class on document.documentElement
 */
export function useTheme(
  /** Optional callback when user manually switches between light/dark. */
  onModeSwitch?: (mode: "dark" | "light") => void,
): UseThemeReturn {
  const theme = useUiStore(selectTheme)
  const storeSetTheme = useUiStore(state => state.setTheme)

  // Resolve the theme based on system preference when theme is "system"
  const resolvedTheme: "light" | "dark" = theme === "system" ? getSystemPreference() : theme

  // Set theme (automatically persisted via zustand persist middleware)
  const setTheme = useCallback(
    (newTheme: Theme) => {
      storeSetTheme(newTheme)
    },
    [storeSetTheme],
  )

  // Set mode directly (light or dark) and optionally trigger VS Code theme restoration
  const setMode = useCallback(
    (mode: "dark" | "light") => {
      setTheme(mode)
      if (onModeSwitch) {
        onModeSwitch(mode)
      }
    },
    [setTheme, onModeSwitch],
  )

  // Cycle through themes: system -> light -> dark -> system
  const cycleTheme = useCallback(() => {
    const nextTheme: Theme =
      theme === "system" ? "light"
      : theme === "light" ? "dark"
      : "system"
    setTheme(nextTheme)
    // Trigger mode switch callback when going to light or dark (not system)
    if (nextTheme !== "system" && onModeSwitch) {
      onModeSwitch(nextTheme)
    }
  }, [theme, setTheme, onModeSwitch])

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
    setMode,
    cycleTheme,
  }
}

export interface UseThemeReturn {
  /** Current theme setting ("system", "light", or "dark") */
  theme: Theme
  /** Resolved theme based on system preference when theme is "system" */
  resolvedTheme: "light" | "dark"
  /** Set the theme preference */
  setTheme: (theme: Theme) => void
  /** Set light or dark mode directly */
  setMode: (mode: "dark" | "light") => void
  /** Cycle between system -> light -> dark -> system */
  cycleTheme: () => void
}
