import { useEffect } from "react"
import { DEFAULT_ACCENT_COLOR } from "@/constants"
import { getContrastingColor } from "@/lib/getContrastingColor"

/**
 * Injects the accent color as CSS custom properties (--repo-accent, --repo-accent-foreground).
 * This allows components to use var(--repo-accent) for theming with proper contrast.
 */
export function useAccentColor(
  /** The accent color to inject, or null/undefined to use the default */
  accentColor: string | null | undefined,
) {
  useEffect(() => {
    const color = accentColor ?? DEFAULT_ACCENT_COLOR
    const foreground = getContrastingColor(color)

    document.documentElement.style.setProperty("--repo-accent", color)
    document.documentElement.style.setProperty("--repo-accent-foreground", foreground)

    return () => {
      document.documentElement.style.removeProperty("--repo-accent")
      document.documentElement.style.removeProperty("--repo-accent-foreground")
    }
  }, [accentColor])
}
