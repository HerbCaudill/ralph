import { cn } from "@/lib/utils"
import { getContrastingColor } from "@/lib/getContrastingColor"
import { DEFAULT_ACCENT_COLOR } from "@/constants"
import { WorkspaceSelector, type Workspace } from "@herbcaudill/beads-view"
import { Logo } from "./Logo"
import { SettingsDropdown } from "./SettingsDropdown"

/**
 * Presentational component for the application header.
 *
 * Displays logo, workspace selector, and settings controls with the accent color
 * as background and contrasting text. All data is passed via props - no store access.
 */
export function Header({
  className,
  accentColor,
  workspace,
  workspaces,
  isWorkspaceLoading,
  onWorkspaceSwitch,
}: HeaderProps) {
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
        <WorkspaceSelector
          current={workspace}
          workspaces={workspaces}
          isLoading={isWorkspaceLoading}
          onSwitch={onWorkspaceSwitch}
        />
      </div>

      <div className="flex items-center gap-2">
        <SettingsDropdown textColor={textColor} />
      </div>
    </header>
  )
}

/**
 * Props for the Header presentational component.
 * All data is passed as props - no store access.
 */
export type HeaderProps = {
  /** Optional CSS class to apply to the header */
  className?: string
  /** Accent color for the header background (hex string, e.g., "#007ACC") */
  accentColor: string | null
  /** Current workspace info */
  workspace: Workspace | null
  /** All available workspaces */
  workspaces: Workspace[]
  /** Whether workspaces are being loaded */
  isWorkspaceLoading: boolean
  /** Callback when user switches workspace */
  onWorkspaceSwitch: (path: string) => void
}
