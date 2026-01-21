import type { ThemeMeta } from "@/lib/theme"
import type { ThemeGroup } from "@/types"

export function groupThemesByType(themes: ThemeMeta[]): ThemeGroup[] {
  const darkThemes: ThemeMeta[] = []
  const lightThemes: ThemeMeta[] = []

  for (const theme of themes) {
    if (theme.type === "dark" || theme.type === "hcDark") {
      darkThemes.push(theme)
    } else {
      lightThemes.push(theme)
    }
  }

  darkThemes.sort((a, b) => a.label.localeCompare(b.label))
  lightThemes.sort((a, b) => a.label.localeCompare(b.label))

  const groups: ThemeGroup[] = []
  if (darkThemes.length > 0) {
    groups.push({ type: "dark", themes: darkThemes })
  }
  if (lightThemes.length > 0) {
    groups.push({ type: "light", themes: lightThemes })
  }

  return groups
}
