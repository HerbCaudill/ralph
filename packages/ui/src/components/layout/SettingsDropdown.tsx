import { useState, useRef, useEffect } from "react"
import { IconSettings, IconSun, IconMoon, IconDeviceDesktop } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { useTheme } from "@/hooks/useTheme"

/**
 * Settings dropdown with appearance mode selector.
 * Accessed via a cog icon in the header.
 */
export function SettingsDropdown({ className, textColor }: SettingsDropdownProps) {
  const { theme: appearanceMode, setTheme: setAppearanceMode } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

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
