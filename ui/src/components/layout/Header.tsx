import { cn, getContrastingColor } from "@/lib/utils"
import { useAppStore, selectAccentColor } from "@/store"
import { useTheme } from "@/hooks"
import { WorkspacePicker } from "./WorkspacePicker"
import { ThemePicker } from "./ThemePicker"
import { Button } from "@/components/ui/button"
import { IconSun, IconMoon, IconDeviceDesktop } from "@tabler/icons-react"

// Constants

/** Default accent color (neutral dark) when peacock color is not set */
const DEFAULT_ACCENT_COLOR = "#374151"

// Types

export interface HeaderProps {
  className?: string
}

// Types

interface ThemeToggleProps {
  textColor: string
}

// ThemeToggle Component

function ThemeToggle({ textColor }: ThemeToggleProps) {
  const { theme, cycleTheme } = useTheme()

  const iconConfig = {
    system: { Icon: IconDeviceDesktop, label: "System theme" },
    light: { Icon: IconSun, label: "Light theme" },
    dark: { Icon: IconMoon, label: "Dark theme" },
  }

  const { Icon, label } = iconConfig[theme]

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={cycleTheme}
      title={`${label} (click to cycle)`}
      aria-label={label}
      data-testid="theme-toggle"
      className="hover:bg-white/20"
      style={{ color: textColor }}
    >
      <Icon className="size-4" />
    </Button>
  )
}

// Logo Component

interface LogoProps {
  textColor: string
}

function Logo({ textColor }: LogoProps) {
  return (
    <div className="flex items-center gap-2" style={{ color: textColor }}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 8V4H8" />
        <rect width="16" height="12" x="4" y="8" rx="2" />
        <path d="M2 14h2" />
        <path d="M20 14h2" />
        <path d="M15 13v2" />
        <path d="M9 13v2" />
      </svg>
      <span className="text-lg font-semibold">Ralph</span>
    </div>
  )
}

// Header Component

/**
 * Application header with logo, workspace picker, and theme toggle.
 * The entire header uses the accent color as background with contrasting text.
 */
export function Header({ className }: HeaderProps) {
  const accentColor = useAppStore(selectAccentColor)
  const backgroundColor = accentColor ?? DEFAULT_ACCENT_COLOR
  const textColor = getContrastingColor(backgroundColor)

  return (
    <header
      className={cn("flex h-14 shrink-0 items-center justify-between px-4", className)}
      style={{ backgroundColor }}
      data-testid="header"
    >
      <div className="flex items-center gap-4">
        <Logo textColor={textColor} />
        <WorkspacePicker variant="header" textColor={textColor} />
      </div>

      <div className="flex items-center gap-2">
        <ThemePicker variant="header" textColor={textColor} />
        <ThemeToggle textColor={textColor} />
      </div>
    </header>
  )
}
