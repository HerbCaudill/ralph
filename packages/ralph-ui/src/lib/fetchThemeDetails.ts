import type { CSSVariables } from "@herbcaudill/agent-view-theme"

/**
 * Fetch theme details including CSS variables from the beads server.
 * Returns null if the theme cannot be loaded.
 */
export async function fetchThemeDetails(
  /** The theme ID to fetch (will be URI-encoded) */
  themeId: string,
): Promise<ThemeDetailsResponse | null> {
  try {
    const response = await fetch(`/api/themes/${encodeURIComponent(themeId)}`)
    if (!response.ok) return null

    const data = (await response.json()) as ThemeDetailsApiResponse
    if (!data.ok) return null

    return {
      cssVariables: data.cssVariables,
      themeType: data.theme.meta.type,
    }
  } catch {
    return null
  }
}

/** The relevant fields from a theme detail response. */
export interface ThemeDetailsResponse {
  /** CSS variables to apply to the document */
  cssVariables: CSSVariables
  /** Theme type for dark/light detection */
  themeType: "dark" | "light" | "hcDark" | "hcLight"
}

/** Shape of the raw API response from /api/themes/:id. */
interface ThemeDetailsApiResponse {
  ok: boolean
  theme: {
    meta: {
      type: "dark" | "light" | "hcDark" | "hcLight"
    }
  }
  cssVariables: CSSVariables
}
