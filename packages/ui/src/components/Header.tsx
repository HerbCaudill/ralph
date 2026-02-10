import { cn } from "@/lib/utils"
import { getContrastingColor } from "@/lib/getContrastingColor"
import { DEFAULT_ACCENT_COLOR } from "@/constants"
import { WorkspaceSelector, type Workspace } from "@herbcaudill/beads-view"
import { Logo } from "./Logo"
import { HelpButton } from "./HelpButton"
import { SettingsDropdown } from "./SettingsDropdown"
import { HeaderAgentInfo } from "./HeaderAgentInfo"
import { HeaderRepoBranch } from "./HeaderRepoBranch"

/**
 * Presentational component for the application header.
 *
 * Displays logo, workspace selector, agent info, repo/branch, and settings controls
 * with the accent color as background and contrasting text. All data is passed via props.
 */
export function Header({
  className,
  accentColor,
  workspace,
  workspaces,
  isWorkspaceLoading,
  agentDisplayName,
  modelName,
  workspaceName,
  branch,
  workspacePath,
  onWorkspaceSwitch,
  onHelpClick,
}: HeaderProps) {
  const backgroundColor = accentColor ?? DEFAULT_ACCENT_COLOR
  const textColor = getContrastingColor(backgroundColor)

  const showAgentInfo = agentDisplayName != null
  const showRepoBranch = workspaceName != null || branch != null

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

        {/* Separator and agent/repo info */}
        {(showAgentInfo || showRepoBranch) && (
          <>
            <div className="flex items-center gap-4">
              {showAgentInfo && (
                <HeaderAgentInfo
                  agentDisplayName={agentDisplayName}
                  modelName={modelName ?? null}
                  textColor={textColor}
                />
              )}
              {showRepoBranch && (
                <HeaderRepoBranch
                  workspaceName={workspaceName ?? null}
                  branch={branch ?? null}
                  workspacePath={workspacePath ?? null}
                  textColor={textColor}
                />
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <HelpButton textColor={textColor} onClick={onHelpClick} />
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
  /** Capitalized adapter display name (e.g., "Claude", "Codex"). */
  agentDisplayName?: string | null
  /** Formatted model name (e.g., "Sonnet 4", "o3"). */
  modelName?: string | null
  /** Workspace/repository name for the repo/branch display. */
  workspaceName?: string | null
  /** Git branch name. */
  branch?: string | null
  /** Full path to the workspace (shown in tooltip). */
  workspacePath?: string | null
  /** Callback when user switches workspace */
  onWorkspaceSwitch: (path: string) => void
  /** Callback when help button is clicked (opens hotkeys dialog) */
  onHelpClick: () => void
}
