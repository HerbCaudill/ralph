import { getAvailableWorkspaces } from "./getAvailableWorkspaces.js"
import { isProcessRunning } from "./isProcessRunning.js"
import { type WorkspaceInfo } from "./types.js"

/**  Get available workspaces, filtering out those with dead daemon processes. */
export function getAliveWorkspaces(
  /** Optional current workspace path to mark as active */
  currentPath?: string,
): WorkspaceInfo[] {
  return getAvailableWorkspaces(currentPath).filter(ws => isProcessRunning(ws.pid))
}
