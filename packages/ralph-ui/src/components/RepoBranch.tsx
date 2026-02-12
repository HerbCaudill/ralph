import { IconGitBranch } from "@tabler/icons-react"
import { cn } from "@/lib/utils"

/**
 * Displays workspace name and git branch with icons.
 *
 * Shows "workspace / branch" format with a git branch icon.
 * Long names are truncated with ellipsis.
 */
export function RepoBranch({ workspaceName, branch, workspacePath, className }: RepoBranchProps) {
  if (!workspaceName && !branch) return null

  return (
    <div
      className={cn(
        "text-muted-foreground flex items-center gap-1 text-xs max-w-37.5 truncate",
        className,
      )}
      title={workspacePath ?? undefined}
      data-testid="repo-branch"
    >
      <IconGitBranch className="size-3 shrink-0" />
      <span className="truncate">
        {workspaceName}
        {workspaceName && branch && <span className="mx-1 opacity-50">/</span>}
        {branch}
      </span>
    </div>
  )
}

export type RepoBranchProps = {
  /** Workspace/repository name. */
  workspaceName?: string | null
  /** Git branch name. */
  branch?: string | null
  /** Full path to the workspace (shown in tooltip). */
  workspacePath?: string | null
  /** Additional CSS classes. */
  className?: string
}
