import { useState, useRef, useEffect, useMemo } from "react"
import { IconPalette, IconChevronDown, IconCheck, IconRefresh } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import type { ThemeMeta } from "@/lib/theme"

/**
 * Presentational component for the theme picker dropdown.
 * Displays VS Code themes filtered by the current display mode.
 *
 * All data is passed via props - no store or API access.
 * Use ThemePicker (controller) for the connected version.
 */
export function ThemePickerView({
  className,
  variant = "default",
  textColor,
  themes,
  activeThemeId,
  isLoading = false,
  error,
  onApplyTheme,
  onRefresh,
}: ThemePickerViewProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

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
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen])

  const handleThemeSelect = async (themeId: string) => {
    await onApplyTheme(themeId)
    setIsOpen(false)
  }

  const isHeaderVariant = variant === "header"

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
                  onClick={onRefresh}
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
              {themes.length === 0 && (
                <div className="text-muted-foreground px-2 py-2 text-xs">No themes found</div>
              )}

              {themes.map(theme => (
                <button
                  key={theme.id}
                  onClick={() => handleThemeSelect(theme.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs",
                    "hover:bg-muted",
                    activeThemeId === theme.id && "bg-repo-accent/50",
                  )}
                  data-testid={`theme-picker-item-${theme.id}`}
                >
                  <span className="flex-1 truncate">{theme.label}</span>
                  {activeThemeId === theme.id && <IconCheck className="text-primary size-3" />}
                </button>
              ))}
            </div>
          )}

          {!error && (
            <div className="border-border border-t p-1">
              <button
                onClick={onRefresh}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs",
                  "hover:bg-muted",
                )}
                data-testid="theme-picker-refresh"
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
 * Props for the ThemePickerView presentational component.
 * All data is passed as props - no store or API access.
 */
export type ThemePickerViewProps = {
  /** Optional CSS class name */
  className?: string
  /** Display variant - "header" for colored header background */
  variant?: "default" | "header"
  /** Text color to use when variant is "header" */
  textColor?: string
  /** List of available themes */
  themes: ThemeMeta[]
  /** ID of the currently active theme, or null for default */
  activeThemeId: string | null
  /** Whether themes are being loaded */
  isLoading?: boolean
  /** Error message to display, if any */
  error?: string | null
  /** Callback to apply a theme */
  onApplyTheme: (themeId: string) => void | Promise<void>
  /** Callback to refresh the theme list */
  onRefresh: () => void
}
