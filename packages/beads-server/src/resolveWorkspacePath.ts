import { getWorkspaceId } from "@herbcaudill/beads-sdk"
import { getAliveWorkspaces } from "@herbcaudill/beads-sdk/node"
import { findSiblingBeadsWorkspaces } from "./findSiblingBeadsWorkspaces.js"

/**
 * Resolve a workspace identifier to a filesystem path.
 *
 * Accepts either:
 * - A full filesystem path (e.g., `/Users/herbcaudill/Code/HerbCaudill/ralph`) — returned as-is
 * - A workspace ID (`owner/repo` format, e.g., `herbcaudill/ralph`) — resolved via the registry
 *   or the `WORKSPACE_PATH` environment variable
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

  // Try to resolve as a workspace ID (owner/repo) from the daemon registry
  const aliveWorkspaces = getAliveWorkspaces()
  for (const ws of aliveWorkspaces) {
    const id = getWorkspaceId({ workspacePath: ws.path })
    if (id === workspace.toLowerCase()) {
      return ws.path
    }
  }

  // Fallback: check local Beads workspaces near WORKSPACE_PATH
  for (const workspacePath of findSiblingBeadsWorkspaces(process.env.WORKSPACE_PATH)) {
    const id = getWorkspaceId({ workspacePath })
    if (id === workspace.toLowerCase()) {
      return workspacePath
    }
  }

  return null
}
