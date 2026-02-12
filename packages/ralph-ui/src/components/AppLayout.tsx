import { Outlet } from "react-router-dom"
import {
  BeadsViewProvider,
  configureApiClient,
  getSavedWorkspacePath,
  migrateWorkspaceStorage,
} from "@herbcaudill/beads-view"

// Migrate stored filesystem paths to workspace IDs (one-time, idempotent).
migrateWorkspaceStorage()

// Configure API client for beads-view.
configureApiClient({ baseUrl: "", workspacePath: getSavedWorkspacePath() ?? undefined })

/**
 * Root layout providing BeadsViewProvider context to all routes.
 */
export function AppLayout() {
  return (
    <BeadsViewProvider>
      <Outlet />
    </BeadsViewProvider>
  )
}
