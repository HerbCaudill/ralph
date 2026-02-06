import { Outlet } from "react-router-dom"
import {
  BeadsViewProvider,
  configureApiClient,
  getSavedWorkspacePath,
} from "@herbcaudill/beads-view"

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
