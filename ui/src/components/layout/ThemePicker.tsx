import { cn } from "@/lib/utils"
import { useVSCodeTheme } from "@/hooks"
import type { ThemeMeta } from "@/lib/theme"
import { useState, useRef, useEffect, useMemo } from "react"
import {
  IconPalette,
  IconChevronDown,
  IconCheck,
  IconRefresh,
  IconSun,
  IconMoon,
} from "@tabler/icons-react"

// Types

export interface ThemePickerProps {
  className?: string
  /** Display variant - "header" for colored header background */
  variant?: "default" | "header"
  /** Text color to use when variant is "header" */
  textColor?: string
}

interface ThemeGroup {
  type: "dark" | "light"
  themes: ThemeMeta[]
}

// Helper functions

/**
 * Group themes by type (dark/light), combining hcDark with dark and hcLight with light
 */
function groupThemesByType(themes: ThemeMeta[]): ThemeGroup[] {
  const darkThemes: ThemeMeta[] = []
  const lightThemes: ThemeMeta[] = []

  for (const theme of themes) {
    if (theme.type === "dark" || theme.type === "hcDark") {
      darkThemes.push(theme)
    } else {
      lightThemes.push(theme)
    }
  }

  // Sort each group alphabetically by label
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

// ThemePicker Component

/**
 * Dropdown component to display and switch between VS Code themes.
 * Shows all installed VS Code themes grouped by dark/light with hover preview.
 */
export function ThemePicker({ className, variant = "default", textColor }: ThemePickerProps) {
  const {
    themes,
    activeThemeId,
    currentVSCodeTheme,
    isLoadingList,
    isLoadingTheme,
    error,
    fetchThemes,
    applyTheme,
    previewTheme,
    clearPreview,
    resetToDefault,
  } = useVSCodeTheme()

  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Group themes by type
  const themeGroups = useMemo(() => groupThemesByType(themes), [themes])

  // Get display name for the button
  const displayName = useMemo(() => {
    if (activeThemeId) {
      const activeTheme = themes.find(t => t.id === activeThemeId)
      return activeTheme?.label ?? "Custom Theme"
    }
    return "Default"
  }, [activeThemeId, themes])

  // Close dropdown when clicking outside
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

  // Close on escape key
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
    setIsOpen(false)
  }

  const handleResetToDefault = () => {
    resetToDefault()
    setIsOpen(false)
  }

  const handleMouseEnter = (themeId: string) => {
    previewTheme(themeId)
  }

  const handleMouseLeave = () => {
    clearPreview()
  }

  const isHeaderVariant = variant === "header"
  const isLoading = isLoadingList || isLoadingTheme

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 rounded-md px-3 py-1.5",
          "transition-colors",
          "text-sm font-medium",
          isLoading && "opacity-70",
          isHeaderVariant ? "hover:bg-white/20" : "bg-secondary hover:bg-secondary/80",
        )}
        style={isHeaderVariant ? { color: textColor } : undefined}
        aria-expanded={isOpen}
        aria-haspopup="true"
        disabled={isLoading}
        data-testid="theme-picker-trigger"
      >
        <IconPalette
          className="size-4"
          style={isHeaderVariant ? { color: textColor } : undefined}
        />
        <span className="max-w-[150px] truncate">{displayName}</span>
        <IconChevronDown className={cn("size-3 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div
          className={cn(
            "bg-popover border-border absolute top-full right-0 z-50 mt-1 w-72 rounded-md border shadow-lg",
          )}
          data-testid="theme-picker-dropdown"
        >
          {/* Error state */}
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

          {/* Theme list */}
          {!error && (
            <div className="max-h-80 overflow-y-auto p-1">
              {/* Default theme option */}
              <button
                onClick={handleResetToDefault}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-3 py-2 text-left",
                  "hover:bg-accent transition-colors",
                  !activeThemeId && "bg-accent/50",
                )}
                data-testid="theme-picker-default"
              >
                <IconPalette className="text-muted-foreground size-3.5" />
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate text-sm font-medium">Default</span>
                  {!activeThemeId && <IconCheck className="text-primary size-3.5 shrink-0" />}
                </div>
              </button>

              {/* VS Code current theme indicator */}
              {currentVSCodeTheme && (
                <div className="text-muted-foreground px-3 py-1.5 text-xs">
                  VS Code: {currentVSCodeTheme}
                </div>
              )}

              {/* Loading state */}
              {isLoadingList && themes.length === 0 && (
                <div className="text-muted-foreground px-3 py-2 text-sm">Loading themes...</div>
              )}

              {/* Empty state */}
              {!isLoadingList && themes.length === 0 && (
                <div className="text-muted-foreground px-3 py-2 text-sm">No themes found</div>
              )}

              {/* Theme groups */}
              {themeGroups.map(group => (
                <div key={group.type}>
                  {/* Group header */}
                  <div className="text-muted-foreground flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium tracking-wider uppercase">
                    {group.type === "dark" ?
                      <IconMoon className="size-3" />
                    : <IconSun className="size-3" />}
                    {group.type === "dark" ? "Dark" : "Light"}
                  </div>

                  {/* Theme items */}
                  {group.themes.map(theme => (
                    <button
                      key={theme.id}
                      onClick={() => handleThemeSelect(theme.id)}
                      onMouseEnter={() => handleMouseEnter(theme.id)}
                      onMouseLeave={handleMouseLeave}
                      className={cn(
                        "flex w-full items-center gap-2 rounded px-3 py-2 text-left",
                        "hover:bg-accent transition-colors",
                        activeThemeId === theme.id && "bg-accent/50",
                      )}
                      data-testid={`theme-picker-item-${theme.id}`}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="truncate text-sm">{theme.label}</span>
                        {activeThemeId === theme.id && (
                          <IconCheck className="text-primary size-3.5 shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Actions section */}
          <div className="border-border border-t p-1">
            <button
              onClick={() => fetchThemes()}
              className={cn(
                "flex w-full items-center gap-2 rounded px-3 py-2 text-sm",
                "hover:bg-accent transition-colors",
              )}
            >
              <IconRefresh className="text-muted-foreground size-3.5" />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
