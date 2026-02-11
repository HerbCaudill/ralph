import { useState, useRef, useEffect, useMemo } from "react"
import {
  IconSettings,
  IconSun,
  IconMoon,
  IconDeviceDesktop,
  IconCheck,
  IconRefresh,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { useThemes } from "@/hooks/useThemes"
import { useApplyTheme } from "@/hooks/useApplyTheme"
import { useUiStore, selectTheme, selectVscodeThemeId } from "@/stores/uiStore"

/**
 * Settings dropdown with appearance mode selector.
 * Accessed via a cog icon in the header.
 *
 * Features:
 * - Filters themes by current mode (only shows light themes in light mode, etc.)
 * - Remembers last used theme for each mode (dark/light)
 * - When switching modes, restores the last used theme for that mode
 * - Applies VS Code theme CSS variables to the document on selection
 */
export function SettingsDropdown({ className, textColor }: SettingsDropdownProps) {
  const appearanceMode = useUiStore(selectTheme)
  const vscodeThemeId = useUiStore(selectVscodeThemeId)
  const { themes, error: themesError, refresh: refreshThemes } = useThemes()
  const { applyTheme, changeMode, resolvedTheme } = useApplyTheme()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Filter themes to match the current display mode (dark/light)
  const filteredThemes = useMemo(() => {
    return themes.filter(theme => {
      const isDarkTheme = theme.type === "dark" || theme.type === "hcDark"
      return resolvedTheme === "dark" ? isDarkTheme : !isDarkTheme
    })
  }, [themes, resolvedTheme])

  // Sort filtered themes alphabetically
  const sortedThemes = useMemo(() => {
    return [...filteredThemes].sort((a, b) => a.label.localeCompare(b.label))
  }, [filteredThemes])

  // Handle theme selection - fetches and applies CSS variables
  const handleThemeSelect = async (themeId: string) => {
    await applyTheme(themeId)
  }

  // Handle mode change - restore last used theme for that mode
  const handleModeChange = (mode: "system" | "light" | "dark") => {
    changeMode(mode)
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
          <div className="border-b border-border p-2">
            <div className="mb-2 px-1 text-xs font-medium text-muted-foreground">Appearance</div>
            <div className="flex gap-1">
              {appearanceModes.map(({ value, Icon, label }) => (
                <button
                  key={value}
                  onClick={() => handleModeChange(value)}
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

          {/* Theme Section */}
          {themesError && (
            <div className="p-3">
              <div className="flex items-center gap-2 text-sm text-red-500">
                <span>{themesError}</span>
                <button onClick={refreshThemes} className="hover:opacity-60" title="Retry">
                  <IconRefresh className="size-3.5" />
                </button>
              </div>
            </div>
          )}

          {!themesError && (
            <div className="max-h-64 overflow-y-auto p-1">
              {sortedThemes.length === 0 && (
                <div className="px-2 py-2 text-xs text-muted-foreground">No themes found</div>
              )}

              {sortedThemes.map(theme => (
                <button
                  key={theme.id}
                  onClick={() => handleThemeSelect(theme.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs",
                    "hover:bg-muted",
                    vscodeThemeId === theme.id && "bg-accent/50",
                  )}
                  data-testid={`settings-theme-item-${theme.id}`}
                >
                  <span className="flex-1 truncate">{theme.label}</span>
                  {vscodeThemeId === theme.id && <IconCheck className="size-3 text-primary" />}
                </button>
              ))}
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
