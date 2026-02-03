import { useEffect } from "react"
import { DEFAULT_ACCENT_COLOR } from "@/constants"

/**
 * Injects the accent color as a CSS custom property (--accent-color).
 * This allows components to use var(--accent-color) for theming.
 */
export function useAccentColor(
  /** The accent color to inject, or null/undefined to use the default */
  accentColor: string | null | undefined,
) {
  useEffect(() => {
    const color = accentColor ?? DEFAULT_ACCENT_COLOR
    document.documentElement.style.setProperty("--accent-color", color)

    return () => {
      document.documentElement.style.removeProperty("--accent-color")
    }
  }, [accentColor])
}
