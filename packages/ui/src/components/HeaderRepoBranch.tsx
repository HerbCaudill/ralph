import { IconGitBranch } from "@tabler/icons-react"

/**
 * Displays repository name and git branch in the header.
 *
 * Shows "workspace / branch" format with a git branch icon.
 * Used in the app header alongside the workspace selector.
 */
export function HeaderRepoBranch({
  workspaceName,
  branch,
  workspacePath,
  textColor,
}: HeaderRepoBranchProps) {
  if (!workspaceName && !branch) return null

  return (
    <div
      className="flex items-center gap-1.5 text-xs opacity-80"
      style={{ color: textColor }}
      title={workspacePath ?? undefined}
      data-testid="header-repo-branch"
    >
      <IconGitBranch size={16} stroke={1.5} className="shrink-0" />
      <span className="max-w-50 truncate">
        {workspaceName}
        {workspaceName && branch && <span className="mx-1 opacity-50">/</span>}
        {branch}
      </span>
    </div>
  )
}

export type HeaderRepoBranchProps = {
  /** Workspace/repository name. */
  workspaceName: string | null
  /** Git branch name. */
  branch: string | null
  /** Full path to the workspace (shown in tooltip). */
  workspacePath: string | null
  /** Text color for contrast with header background. */
  textColor: string
}
