import { getAliveWorkspaces } from "@herbcaudill/beads-sdk"
import { getWorkspaceId } from "@herbcaudill/ralph-shared"

/**
 * Resolve a workspace identifier to a filesystem path.
 *
 * Accepts either:
 * - A full filesystem path (e.g., `/Users/herbcaudill/Code/HerbCaudill/ralph`) — returned as-is
 * - A workspace ID (`owner/repo` format, e.g., `herbcaudill/ralph`) — resolved via the registry
 *
 * Returns the filesystem path, or null if the workspace ID couldn't be resolved.
 */
export function resolveWorkspacePath(
  /** Workspace identifier — either a full path or `owner/repo` format */
  workspace: string,
): string | null {
  // If it looks like an absolute path, return as-is
  if (workspace.startsWith("/")) {
    return workspace
  }

  // Otherwise, try to resolve as a workspace ID (owner/repo)
  const aliveWorkspaces = getAliveWorkspaces()
  for (const ws of aliveWorkspaces) {
    const id = getWorkspaceId({ workspacePath: ws.path })
    if (id === workspace.toLowerCase()) {
      return ws.path
    }
  }

  return null
}
