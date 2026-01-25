import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import {
  IconSettings,
  IconCheck,
  IconRefresh,
  IconSun,
  IconMoon,
  IconDeviceDesktop,
  IconDownload,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { useThemeCoordinator } from "@/hooks"
import { groupThemesByType } from "@/lib/groupThemesByType"
import { downloadStateExport } from "@/lib/exportState"
import { Button } from "@/components/ui/button"

/**
 * Settings dropdown accessed via a cog icon.
 * Contains the VS Code theme picker and light/dark/system appearance mode selector.
 *
 * Features:
 * - When selecting a VS Code theme, automatically switches to matching light/dark mode
 * - When switching between light/dark modes, restores the last used theme for that mode
 */
export function SettingsDropdown({ className, textColor }: SettingsDropdownProps) {
  const {
    themes,
    activeThemeId,
    currentVSCodeTheme,
    error,
    fetchThemes,
    applyTheme,
    previewTheme,
    clearPreview,
    resetToDefault,
    theme: appearanceMode,
    setTheme: setAppearanceMode,
    setMode,
  } = useThemeCoordinator()

  const [isOpen, setIsOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const themeGroups = useMemo(() => groupThemesByType(themes), [themes])

  const displayName = useMemo(() => {
    if (activeThemeId) {
      const activeTheme = themes.find(t => t.id === activeThemeId)
      return activeTheme?.label ?? "Custom Theme"
    }
    return "Default"
  }, [activeThemeId, themes])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        clearPreview()
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen, clearPreview])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false)
        clearPreview()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, clearPreview])

  const handleThemeSelect = async (themeId: string) => {
    await applyTheme(themeId)
  }

  const handleResetToDefault = () => {
    resetToDefault()
  }

  const handleMouseEnter = (themeId: string) => {
    previewTheme(themeId)
  }

  const handleMouseLeave = () => {
    clearPreview()
  }

  const handleExportState = useCallback(async () => {
    setIsExporting(true)
    try {
      await downloadStateExport()
    } catch (err) {
      console.error("[SettingsDropdown] Failed to export state:", err)
    } finally {
      setIsExporting(false)
    }
  }, [])

  const appearanceModes = [
    { value: "system" as const, Icon: IconDeviceDesktop, label: "System" },
    { value: "light" as const, Icon: IconSun, label: "Light" },
    { value: "dark" as const, Icon: IconMoon, label: "Dark" },
  ]

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setIsOpen(!isOpen)}
        title="Settings"
        aria-label="Settings"
        aria-expanded={isOpen}
        aria-haspopup="true"
        data-testid="settings-dropdown-trigger"
        className={cn("hover:bg-white/20")}
        style={{ color: textColor }}
      >
        <IconSettings className="size-4" />
      </Button>

      {isOpen && (
        <div
          className={cn(
            "bg-popover border-border absolute top-full right-0 z-50 mt-1 w-72 rounded-md border shadow-lg",
          )}
          data-testid="settings-dropdown"
        >
          {/* Appearance Mode Section */}
          <div className="border-border border-b p-2">
            <div className="text-muted-foreground mb-2 px-1 text-xs font-medium">Appearance</div>
            <div className="flex gap-1">
              {appearanceModes.map(({ value, Icon, label }) => (
                <button
                  key={value}
                  onClick={() => {
                    // For light/dark, use setMode to trigger theme restoration
                    // For system, just set the appearance mode directly
                    if (value === "system") {
                      setAppearanceMode(value)
                    } else {
                      setMode(value)
                    }
                  }}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs",
                    "hover:bg-muted transition-colors",
                    appearanceMode === value && "bg-repo-accent text-accent-foreground",
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
          {error && (
            <div className="p-3">
              <div className="text-status-error flex items-center gap-2 text-sm">
                <span>{error}</span>
                <button
                  onClick={fetchThemes}
                  className="text-status-error/80 hover:text-status-error/60"
                  title="Retry"
                >
                  <IconRefresh className="size-3.5" />
                </button>
              </div>
            </div>
          )}

          {!error && (
            <div className="max-h-64 overflow-y-auto p-1">
              <div className="text-muted-foreground mb-1 px-2 pt-1 text-xs font-medium">
                Theme: {displayName}
              </div>

              <button
                onClick={handleResetToDefault}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs",
                  "hover:bg-muted",
                  !activeThemeId && "bg-repo-accent/50",
                )}
                onMouseEnter={handleMouseLeave}
                data-testid="settings-theme-default"
              >
                <span className="flex-1">Default</span>
                {!activeThemeId && <IconCheck className="text-primary size-3" />}
              </button>

              {currentVSCodeTheme && (
                <div className="text-muted-foreground px-2 py-1 text-xs">
                  VS Code: {currentVSCodeTheme}
                </div>
              )}

              {themeGroups.length === 0 && (
                <div className="text-muted-foreground px-2 py-2 text-xs">No themes found</div>
              )}

              {themeGroups.map(group => (
                <div key={group.type} className="mt-2">
                  <div className="text-muted-foreground px-2 py-1 text-xs font-medium">
                    {group.type === "dark" ? "Dark" : "Light"}
                  </div>
                  {group.themes.map(theme => (
                    <button
                      key={theme.id}
                      onClick={() => handleThemeSelect(theme.id)}
                      onMouseEnter={() => handleMouseEnter(theme.id)}
                      onMouseLeave={handleMouseLeave}
                      className={cn(
                        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs",
                        "hover:bg-muted",
                        activeThemeId === theme.id && "bg-repo-accent/50",
                      )}
                      data-testid={`settings-theme-item-${theme.id}`}
                    >
                      {theme.type === "dark" || theme.type === "hcDark" ?
                        <IconMoon className="text-muted-foreground size-3.5" />
                      : <IconSun className="text-muted-foreground size-3.5" />}
                      <span className="flex-1 truncate">{theme.label}</span>
                      {activeThemeId === theme.id && <IconCheck className="text-primary size-3" />}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          {!error && (
            <div className="border-border border-t p-1">
              <button
                onClick={fetchThemes}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs",
                  "hover:bg-muted",
                )}
              >
                <IconRefresh className="text-muted-foreground size-3.5" />
                <span>Refresh themes</span>
              </button>
              <button
                onClick={handleExportState}
                disabled={isExporting}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs",
                  "hover:bg-muted",
                  isExporting && "cursor-wait opacity-50",
                )}
                data-testid="settings-export-state"
              >
                <IconDownload className="text-muted-foreground size-3.5" />
                <span>{isExporting ? "Exporting..." : "Export state"}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export type SettingsDropdownProps = {
  className?: string
  /** Text color to use for the trigger icon */
  textColor?: string
}
