import { useState, useRef, useEffect, useMemo } from "react"
import { IconSettings, IconSun, IconMoon, IconDeviceDesktop } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { useTheme } from "@/hooks/useTheme"
import { useThemes } from "@/hooks/useThemes"
import { ThemePicker } from "./ThemePicker"
import { useUiStore, selectVscodeThemeId } from "@/stores/uiStore"

/**
 * Settings dropdown with appearance mode selector.
 * Accessed via a cog icon in the header.
 */
export function SettingsDropdown({ className, textColor }: SettingsDropdownProps) {
  const { theme: appearanceMode, setTheme: setAppearanceMode, resolvedTheme } = useTheme()
  const {
    themes,
    isLoading: isLoadingThemes,
    error: themesError,
    refresh: refreshThemes,
  } = useThemes()
  const vscodeThemeId = useUiStore(selectVscodeThemeId)
  const setVscodeThemeId = useUiStore(state => state.setVscodeThemeId)
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Filter themes to match the current display mode (dark/light)
  const filteredThemes = useMemo(() => {
    return themes
      .filter(theme => {
        const isDarkTheme = theme.type === "dark" || theme.type === "hcDark"
        return resolvedTheme === "dark" ? isDarkTheme : !isDarkTheme
      })
      .map(theme => ({
        id: theme.id,
        label: theme.label,
        type: theme.type,
      }))
  }, [themes, resolvedTheme])

  // Handle theme selection
  const handleApplyTheme = (themeId: string) => {
    setVscodeThemeId(themeId)
    // Note: Full theme application (CSS variables, code highlighting) would require
    // additional implementation. This stores the preference for now.
  }

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen])

  const appearanceModes = [
    { value: "system" as const, Icon: IconDeviceDesktop, label: "System" },
    { value: "light" as const, Icon: IconSun, label: "Light" },
    { value: "dark" as const, Icon: IconMoon, label: "Dark" },
  ]

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Settings"
        aria-label="Settings"
        aria-expanded={isOpen}
        aria-haspopup="true"
        data-testid="settings-dropdown-trigger"
        className={cn("rounded p-1.5 hover:bg-white/20")}
        style={{ color: textColor }}
      >
        <IconSettings className="size-5" />
      </button>

      {isOpen && (
        <div
          className={cn(
            "absolute right-0 top-full z-50 mt-1 w-56 rounded-md border shadow-lg",
            "bg-popover border-border",
          )}
          data-testid="settings-dropdown"
        >
          {/* Appearance Mode Section */}
          <div className="p-2">
            <div className="mb-2 px-1 text-xs font-medium text-muted-foreground">Appearance</div>
            <div className="flex gap-1">
              {appearanceModes.map(({ value, Icon, label }) => (
                <button
                  key={value}
                  onClick={() => setAppearanceMode(value)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs",
                    "transition-colors hover:bg-muted",
                    appearanceMode === value && "bg-accent text-accent-foreground",
                  )}
                  data-testid={`settings-appearance-${value}`}
                >
                  <Icon className="size-3.5" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Theme Picker Section */}
          {filteredThemes.length > 0 && (
            <div className="border-t border-border p-2">
              <div className="mb-2 px-1 text-xs font-medium text-muted-foreground">
                VS Code Theme
              </div>
              <ThemePicker
                themes={filteredThemes}
                activeThemeId={vscodeThemeId}
                isLoading={isLoadingThemes}
                error={themesError}
                onApplyTheme={handleApplyTheme}
                onRefresh={refreshThemes}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export type SettingsDropdownProps = {
  /** Optional CSS class name */
  className?: string
  /** Text color for the trigger icon (should contrast with header background) */
  textColor?: string
}
