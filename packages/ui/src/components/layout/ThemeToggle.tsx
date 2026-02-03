import { IconSun, IconMoon, IconDeviceDesktop } from "@tabler/icons-react"
import { useTheme } from "@/hooks/useTheme"

/**
 * Theme toggle button that cycles through system -> light -> dark modes.
 * Displays an icon indicating the current theme preference.
 */
export function ThemeToggle({ textColor }: Props) {
  const { theme, cycleTheme } = useTheme()

  const iconConfig = {
    system: { Icon: IconDeviceDesktop, label: "System theme" },
    light: { Icon: IconSun, label: "Light theme" },
    dark: { Icon: IconMoon, label: "Dark theme" },
  }

  const { Icon, label } = iconConfig[theme]

  return (
    <button
      onClick={cycleTheme}
      title={`${label} (click to cycle)`}
      aria-label={label}
      data-testid="theme-toggle"
      className="rounded p-1.5 hover:bg-white/20"
      style={{ color: textColor }}
    >
      <Icon className="size-4" />
    </button>
  )
}

type Props = {
  /** Text color for the icon (should contrast with header background) */
  textColor?: string
}
