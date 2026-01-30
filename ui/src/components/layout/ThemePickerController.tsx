import { useMemo } from "react"
import { useVSCodeTheme, useTheme } from "@/hooks"
import { ThemePicker } from "./ThemePicker"

/**
 * Controller component for ThemePicker.
 *
 * Connects to the useVSCodeTheme hook to get theme data,
 * then passes the data to the ThemePicker presentational component.
 * Filters themes to match the current display mode (dark/light).
 */
export function ThemePickerController(
  /** Props for ThemePickerController */
  { className, variant = "default", textColor }: ThemePickerControllerProps,
) {
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
    <ThemePicker
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

/**  Props for the ThemePickerController component */
export type ThemePickerControllerProps = {
  /** Optional CSS class name to apply to the picker */
  className?: string
  /** Display variant - "header" for colored header background */
  variant?: "default" | "header"
  /** Text color to use when variant is "header" */
  textColor?: string
}
