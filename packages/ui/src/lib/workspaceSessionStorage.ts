/** localStorage key prefix for workspace session IDs. */
const STORAGE_KEY_PREFIX = "ralph-workspace-session:"

/** Build the localStorage key for a workspace's session ID. */
export function getSessionStorageKey(
  /** Workspace identifier in `owner/repo` format. */
  workspaceId: string,
): string {
  return `${STORAGE_KEY_PREFIX}${workspaceId}`
}

/** Save the most recent session ID for a workspace to localStorage. */
export function saveWorkspaceSession(
  /** Workspace identifier in `owner/repo` format. */
  workspaceId: string,
  /** The session ID to persist. */
  sessionId: string,
): void {
  try {
    localStorage.setItem(getSessionStorageKey(workspaceId), sessionId)
  } catch {
    // localStorage may be unavailable (e.g., in SharedWorker)
  }
}

/** Load the most recent session ID for a workspace from localStorage. */
export function loadWorkspaceSession(
  /** Workspace identifier in `owner/repo` format. */
  workspaceId: string,
): string | null {
  try {
    return localStorage.getItem(getSessionStorageKey(workspaceId))
  } catch {
    // localStorage may be unavailable (e.g., in SharedWorker)
    return null
  }
}

/** Clear the stored session ID for a workspace. */
export function clearWorkspaceSession(
  /** Workspace identifier in `owner/repo` format. */
  workspaceId: string,
): void {
  try {
    localStorage.removeItem(getSessionStorageKey(workspaceId))
  } catch {
    // localStorage may be unavailable
  }
}
