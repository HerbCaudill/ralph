import { Navigate } from "react-router-dom"
import { getSavedWorkspacePath } from "@herbcaudill/beads-view"
import { getWorkspaceId } from "@herbcaudill/ralph-shared"

/**
 * Redirects from root `/` to the most recent workspace URL.
 * Falls back to showing a loading state if no workspace has been saved.
 */
export function WorkspaceRedirect() {
  const savedPath = getSavedWorkspacePath()
  if (savedPath) {
    const id = getWorkspaceId({ workspacePath: savedPath })
    return <Navigate to={`/${id}`} replace />
  }

  // No saved workspace: show a minimal loading state.
  // The workspace selector in the header will let the user pick one.
  return (
    <div className="flex h-screen items-center justify-center text-muted-foreground">
      No workspace selected
    </div>
  )
}
