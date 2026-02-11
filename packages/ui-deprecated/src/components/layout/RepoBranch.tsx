import { IconGitBranch } from "@tabler/icons-react"
import { useAppStore, selectWorkspace, selectBranch } from "@/store"
import { getRepoName } from "@/lib/getRepoName"

export function RepoBranch({}: Props) {
  const workspace = useAppStore(selectWorkspace)
  const branch = useAppStore(selectBranch)

  const repoName = getRepoName(workspace)

  if (!repoName && !branch) return null

  return (
    <div className="text-muted-foreground flex items-center gap-1 text-xs">
      <IconGitBranch className="size-3 shrink-0" />
      <span className="max-w-37.5 truncate">
        {repoName}
        {branch && (
          <>
            <span className="mx-1 opacity-50">/</span>
            {branch}
          </>
        )}
      </span>
    </div>
  )
}

type Props = {}
