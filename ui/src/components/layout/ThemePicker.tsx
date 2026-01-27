import { useMemo } from "react"
import { useVSCodeTheme, useTheme } from "@/hooks"
import { ThemePickerView } from "./ThemePickerView"

/**
 * Controller component for ThemePicker.
 *
 * Connects to the useVSCodeTheme hook to get theme data,
 * then passes the data to the ThemePickerView presentational component.
 * Filters themes to match the current display mode (dark/light).
 */
export function ThemePicker({ className, variant = "default", textColor }: ThemePickerProps) {
  const { themes, activeThemeId, isLoadingList, isLoadingTheme, error, fetchThemes, applyTheme } =
    useVSCodeTheme()
  const { resolvedTheme } = useTheme()

  // Filter themes to match the current display mode and sort alphabetically
  const filteredThemes = useMemo(() => {
    return themes
      .filter(theme => {
        const isDarkTheme = theme.type === "dark" || theme.type === "hcDark"
        return resolvedTheme === "dark" ? isDarkTheme : !isDarkTheme
      })
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [themes, resolvedTheme])

  return (
    <ThemePickerView
      className={className}
      variant={variant}
      textColor={textColor}
      themes={filteredThemes}
      activeThemeId={activeThemeId}
      isLoading={isLoadingList || isLoadingTheme}
      error={error}
      onApplyTheme={applyTheme}
      onRefresh={fetchThemes}
    />
  )
}

/**  Props for the ThemePicker component */
export type ThemePickerProps = {
  className?: string
  /** Display variant - "header" for colored header background */
  variant?: "default" | "header"
  /** Text color to use when variant is "header" */
  textColor?: string
}

// Re-export the view for direct usage in stories
export { ThemePickerView } from "./ThemePickerView"
export type { ThemePickerViewProps } from "./ThemePickerView"
