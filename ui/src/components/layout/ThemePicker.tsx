import { useVSCodeTheme } from "@/hooks"
import { ThemePickerView } from "./ThemePickerView"

/**
 * Controller component for ThemePicker.
 *
 * Connects to the useVSCodeTheme hook to get theme data,
 * then passes the data to the ThemePickerView presentational component.
 */
export function ThemePicker({ className, variant = "default", textColor }: ThemePickerProps) {
  const {
    themes,
    activeThemeId,
    isLoadingList,
    isLoadingTheme,
    error,
    fetchThemes,
    applyTheme,
    previewTheme,
    clearPreview,
  } = useVSCodeTheme()

  return (
    <ThemePickerView
      className={className}
      variant={variant}
      textColor={textColor}
      themes={themes}
      activeThemeId={activeThemeId}
      isLoading={isLoadingList || isLoadingTheme}
      error={error}
      onApplyTheme={applyTheme}
      onPreviewTheme={previewTheme}
      onClearPreview={clearPreview}
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
