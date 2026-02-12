import { SessionPersister, getDefaultStorageDir } from "@herbcaudill/ralph-shared/server"
import { getWorkspaceId } from "@herbcaudill/beads-sdk"

/**
 * Get the path to the most recent session log file.
 * Scopes to the current workspace (derived from cwd).
 * Returns undefined if no session logs exist.
 */
export const getLatestLogFile = (): string | undefined => {
  const persister = new SessionPersister(getDefaultStorageDir())
  const workspace = getWorkspaceId({ workspacePath: process.cwd() })
  const latestId = persister.getLatestSessionId("ralph", workspace)
  if (!latestId) return undefined
  return persister.getSessionPath(latestId, "ralph", workspace)
}
