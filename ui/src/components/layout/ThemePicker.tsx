import { useState, useRef, useEffect, useMemo } from "react"
import {
  IconPalette,
  IconChevronDown,
  IconCheck,
  IconRefresh,
  IconSun,
  IconMoon,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { useVSCodeTheme } from "@/hooks"
import { groupThemesByType } from "@/lib/groupThemesByType"

/**
 * Dropdown component to display and switch between VS Code themes.
 * Shows all installed VS Code themes grouped by dark/light with hover preview.
 */
export function ThemePicker({
  /** Optional CSS class name */
  className,
  /** Display variant - "header" for colored header background */
  variant = "default",
  /** Text color to use when variant is "header" */
  textColor,
}: ThemePickerProps) {
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
            <div className="max-h-80 overflow-y-auto p-1">
              <button
                onClick={handleResetToDefault}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs",
                  "hover:bg-muted",
                  !activeThemeId && "bg-accent/50",
                )}
                onMouseEnter={handleMouseLeave}
                data-testid="theme-picker-default"
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
                        activeThemeId === theme.id && "bg-accent/50",
                      )}
                      data-testid={`theme-picker-item-${theme.id}`}
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
                <span>Refresh</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Props for the ThemePicker component
 */
export type ThemePickerProps = {
  className?: string
  /** Display variant - "header" for colored header background */
  variant?: "default" | "header"
  /** Text color to use when variant is "header" */
  textColor?: string
}
