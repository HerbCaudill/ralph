import { useState, useRef, useEffect } from "react"
import { IconSettings } from "@tabler/icons-react"
import { cn } from "@/lib/utils"

/**
 * Settings dropdown accessed via a cog icon.
 * Placeholder component - can be extended to include theme picker, appearance settings, etc.
 */
export function SettingsDropdown({ className, textColor }: SettingsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

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

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Settings"
        aria-label="Settings"
        aria-expanded={isOpen}
        aria-haspopup="true"
        data-testid="settings-dropdown"
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-white/20",
        )}
        style={{ color: textColor }}
      >
        <IconSettings className="size-5" />
      </button>

      {isOpen && (
        <div
          className={cn(
            "bg-popover border-border absolute top-full right-0 z-50 mt-1 w-48 rounded-md border shadow-lg",
          )}
        >
          <div className="p-2">
            <div className="text-muted-foreground px-2 py-1 text-xs">Settings coming soon...</div>
          </div>
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
