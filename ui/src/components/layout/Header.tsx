import { cn, getContrastingColor } from "@/lib/utils"
import { useAppStore, selectAccentColor, selectInstanceCount } from "@/store"
import { DEFAULT_ACCENT_COLOR } from "@/constants"
import { WorkspacePicker } from "./WorkspacePicker"
import { Logo } from "./Logo"
import { SettingsDropdown } from "./SettingsDropdown"
import { HelpButton } from "./HelpButton"
import { InstanceCountBadge } from "./InstanceCountBadge"
import { MergeConflictNotification } from "./MergeConflictNotification"

/**
 * Application header with logo, workspace picker, and theme toggle.
 * The entire header uses the accent color as background with contrasting text.
 */
export function Header({ className }: HeaderProps) {
  const accentColor = useAppStore(selectAccentColor)
  const instanceCount = useAppStore(selectInstanceCount)
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
        {instanceCount > 1 && <InstanceCountBadge count={instanceCount} />}
        <MergeConflictNotification textColor={textColor} />
      </div>

      <div className="flex items-center gap-2">
        <HelpButton textColor={textColor} />
        <SettingsDropdown textColor={textColor} />
      </div>
    </header>
  )
}

export type HeaderProps = {
  className?: string
}
