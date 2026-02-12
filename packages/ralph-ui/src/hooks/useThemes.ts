import { useState, useEffect, useCallback, useRef } from "react"

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

/**
 * Hook to fetch available VS Code themes from the beads server.
 *
 * Features:
 * - Fetches themes from /api/themes on mount
 * - Provides loading and error states
 * - Includes a refresh function for manual reload
 */
export function useThemes(): UseThemesResult {
  const [themes, setThemes] = useState<ThemeMeta[]>([])
  const [variant, setVariant] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Use ref for stable reference to avoid recreation on every render
  const themesRef = useRef<ThemeMeta[]>([])

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/themes")

      if (!response.ok) {
        setError("Failed to fetch themes")
        setIsLoading(false)
        return
      }

      const data = (await response.json()) as { themes: ThemeMeta[]; variant: string | null }
      themesRef.current = data.themes
      setThemes(data.themes)
      setVariant(data.variant)
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch themes"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return {
    themes,
    variant,
    isLoading,
    error,
    refresh,
  }
}

export interface UseThemesResult {
  /** List of available themes */
  themes: ThemeMeta[]
  /** Name of the detected VS Code variant (e.g., "VS Code", "Cursor") */
  variant: string | null
  /** Whether themes are currently loading */
  isLoading: boolean
  /** Error message if fetch failed */
  error: string | null
  /** Manually refresh themes */
  refresh: () => Promise<void>
}
