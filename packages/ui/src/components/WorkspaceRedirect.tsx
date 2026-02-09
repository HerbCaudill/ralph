import { Navigate } from "react-router-dom"
import { getSavedWorkspacePath } from "@herbcaudill/beads-view"
import { getWorkspaceId } from "@herbcaudill/ralph-shared"
import { WorkspaceAutoSelect } from "./WorkspaceAutoSelect"

/**
 * Redirects from root `/` to the most recent workspace URL.
 * If no workspace is saved in localStorage, fetches the workspace list
 * from beads-server and redirects to the first available workspace.
 */
export function WorkspaceRedirect() {
  const savedPath = getSavedWorkspacePath()
  if (savedPath) {
    const id = getWorkspaceId({ workspacePath: savedPath })
    return <Navigate to={`/${id}`} replace />
  }

  return <WorkspaceAutoSelect />
}
