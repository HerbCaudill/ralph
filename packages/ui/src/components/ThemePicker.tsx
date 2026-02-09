import { useState, useMemo } from "react"
import { IconPalette, IconChevronDown, IconCheck, IconRefresh } from "@tabler/icons-react"
import { Button, Popover, PopoverContent, PopoverTrigger } from "@herbcaudill/components"
import { cn } from "@/lib/utils"

/** Theme metadata for display. */
interface ThemeMeta {
  id: string
  label: string
  type: "dark" | "light" | "hcDark" | "hcLight"
}

/**
 * Theme picker dropdown for selecting VS Code themes.
 * Displays available themes filtered by current mode (light/dark).
 */
export function ThemePicker({
  className,
  variant = "default",
  textColor,
  themes,
  activeThemeId,
  isLoading = false,
  error,
  onApplyTheme,
  onRefresh,
}: ThemePickerProps) {
  const [open, setOpen] = useState(false)

  const displayName = useMemo(() => {
    if (activeThemeId) {
      const activeTheme = themes.find(t => t.id === activeThemeId)
      return activeTheme?.label ?? "Custom Theme"
    }
    return "Default"
  }, [activeThemeId, themes])

  const handleThemeSelect = async (themeId: string) => {
    await onApplyTheme(themeId)
    setOpen(false)
  }

  const isHeaderVariant = variant === "header"

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={className}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5",
              "transition-colors text-sm font-medium",
              isLoading && "opacity-70",
              isHeaderVariant ? "hover:bg-white/20" : "bg-secondary hover:bg-secondary/80",
            )}
            style={isHeaderVariant ? { color: textColor } : undefined}
            disabled={isLoading}
            data-testid="theme-picker-trigger"
          >
            <IconPalette className="size-4" />
            <span className="max-w-[150px] truncate">{displayName}</span>
            <IconChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
          </button>
        </PopoverTrigger>
      </div>
      <PopoverContent className="w-72 p-0" align="end" data-testid="theme-picker-dropdown">
        {error && themes.length > 0 && (
          <div className="p-3">
            <div className="flex items-center gap-2 text-sm text-red-500">
              <span>{error}</span>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onRefresh}
                title="Retry"
                className="hover:opacity-60"
              >
                <IconRefresh className="size-3.5" />
              </Button>
            </div>
          </div>
        )}

        {!(error && themes.length > 0) && (
          <div className="max-h-80 overflow-y-auto p-1">
            {themes.length === 0 && (
              <div className="px-2 py-2 text-xs text-muted-foreground">No themes found</div>
            )}
            {themes.map(theme => (
              <button
                key={theme.id}
                onClick={() => handleThemeSelect(theme.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs",
                  "hover:bg-muted",
                  activeThemeId === theme.id && "bg-accent/50",
                )}
                data-testid={`theme-picker-item-${theme.id}`}
              >
                <span className="flex-1 truncate">{theme.label}</span>
                {activeThemeId === theme.id && <IconCheck className="size-3 text-primary" />}
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

export type ThemePickerProps = {
  className?: string
  variant?: "default" | "header"
  textColor?: string
  themes: ThemeMeta[]
  activeThemeId: string | null
  isLoading?: boolean
  error?: string | null
  onApplyTheme: (themeId: string) => void | Promise<void>
  onRefresh: () => void
}
