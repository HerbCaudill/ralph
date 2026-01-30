import { IconSun, IconMoon, IconDeviceDesktop } from "@tabler/icons-react"
import { useTheme } from "@/hooks"
import { Button } from "@/components/ui/button"

export function ThemeToggle({ textColor }: Props) {
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

type Props = {
  textColor: string
}
