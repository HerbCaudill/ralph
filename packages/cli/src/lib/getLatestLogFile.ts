import { SessionPersister, getDefaultStorageDir } from "@herbcaudill/ralph-shared/server"

/**
 * Get the path to the most recent session log file.
 * Returns undefined if no session logs exist.
 */
export const getLatestLogFile = (): string | undefined => {
  const persister = new SessionPersister(getDefaultStorageDir())
  const latestId = persister.getLatestSessionId("ralph")
  if (!latestId) return undefined
  return persister.getSessionPath(latestId, "ralph")
}
