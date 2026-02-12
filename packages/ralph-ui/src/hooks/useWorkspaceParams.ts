import { useParams } from "react-router-dom"

/**
 * Extract workspace route parameters from the current URL.
 * Returns owner, repo, optional sessionId, and a combined workspaceId (`owner/repo`).
 */
export function useWorkspaceParams(): WorkspaceParams {
  const { owner, repo, sessionId } = useParams<{
    owner: string
    repo: string
    sessionId: string
  }>()

  const workspaceId = owner && repo ? `${owner}/${repo}` : undefined

  return { owner, repo, sessionId, workspaceId }
}

/** Route parameters for workspace URLs. */
export interface WorkspaceParams {
  /** Repository owner (e.g. `herbcaudill`) */
  owner?: string
  /** Repository name (e.g. `ralph`) */
  repo?: string
  /** Optional session ID */
  sessionId?: string
  /** Combined workspace identifier (`owner/repo`) */
  workspaceId?: string
}
