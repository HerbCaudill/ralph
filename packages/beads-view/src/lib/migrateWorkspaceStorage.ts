import { getWorkspaceId } from "@herbcaudill/ralph-shared"

/** Default localStorage key for workspace persistence. */
const DEFAULT_STORAGE_KEY = "ralph-workspace-path"

/** Key used to track whether migration has already run. */
const MIGRATION_KEY = "ralph-workspace-migrated"

/**
 * Migrate stored workspace paths to workspace IDs (owner/repo format).
 *
 * On first load, checks if the stored value looks like a filesystem path
 * (starts with `/`). If so, converts it to an `owner/repo` workspace ID
 * using `getWorkspaceId` and updates localStorage.
 *
 * This is idempotent — once migrated, subsequent calls are no-ops.
 */
export function migrateWorkspaceStorage(
  /** The localStorage key used for workspace persistence. */
  storageKey: string = DEFAULT_STORAGE_KEY,
): void {
  try {
    // Skip if already migrated
    if (localStorage.getItem(MIGRATION_KEY)) return

    const stored = localStorage.getItem(storageKey)
    if (!stored) {
      localStorage.setItem(MIGRATION_KEY, "1")
      return
    }

    // Only migrate values that look like filesystem paths
    if (stored.startsWith("/")) {
      const workspaceId = getWorkspaceId({ workspacePath: stored })
      localStorage.setItem(storageKey, workspaceId)
    }

    localStorage.setItem(MIGRATION_KEY, "1")
  } catch {
    // Silently ignore storage errors
  }
}
