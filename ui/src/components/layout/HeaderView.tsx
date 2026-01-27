import { cn, getContrastingColor } from "@/lib/utils"
import { DEFAULT_ACCENT_COLOR } from "@/constants"
import { WorkspacePicker } from "./WorkspacePicker"
import { Logo } from "./Logo"
import { SettingsDropdown } from "./SettingsDropdown"
import { HelpButton } from "./HelpButton"
import { InstanceCountBadge } from "./InstanceCountBadge"
import { MergeConflictNotification } from "./MergeConflictNotification"
import { ConnectionStatusIndicator } from "./ConnectionStatusIndicator"

/**
 * Presentational component for the application header.
 *
 * Displays logo, workspace picker, and settings controls with the accent color
 * as background and contrasting text. All data is passed via props - no store access.
 *
 * Use the Header component (which uses store hooks) for the connected version.
 */
export function HeaderView({ className, accentColor, instanceCount }: HeaderViewProps) {
  const backgroundColor = accentColor ?? DEFAULT_ACCENT_COLOR
  const textColor = getContrastingColor(backgroundColor)

  return (
    <header
      className={cn("flex h-14 shrink-0 items-center justify-between px-4", className)}
      style={{ backgroundColor }}
      data-testid="header"
    >
      <div className="flex items-center gap-4" style={{ color: textColor }}>
        <Logo />
        <WorkspacePicker variant="header" textColor={textColor} />
        {instanceCount > 1 && <InstanceCountBadge count={instanceCount} />}
        <MergeConflictNotification textColor={textColor} />
      </div>

      <div className="flex items-center gap-2">
        <ConnectionStatusIndicator textColor={textColor} />
        <HelpButton textColor={textColor} />
        <SettingsDropdown textColor={textColor} />
      </div>
    </header>
  )
}

/**
 * Props for the HeaderView presentational component.
 * All data is passed as props - no store access.
 */
export type HeaderViewProps = {
  /** Optional CSS class to apply to the header */
  className?: string
  /** Accent color for the header background (hex string, e.g., "#007ACC") */
  accentColor: string | null
  /** Number of active Ralph instances */
  instanceCount: number
}
