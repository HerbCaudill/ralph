import { createBrowserRouter, Navigate } from "react-router-dom"
import { AppLayout } from "./components/AppLayout"
import { WorkspaceView } from "./components/WorkspaceView"
import { WorkspaceRedirect } from "./components/WorkspaceRedirect"

/**
 * Application route configuration.
 *
 * Routes:
 * - `/` → Redirect to most recent workspace
 * - `/:owner/:repo` → Workspace view (no session)
 * - `/:owner/:repo/:sessionId` → Session view
 *
 * Hash-based task dialog routing (`#taskid=r-abc99`) is preserved.
 */
export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      {
        path: "/",
        element: <WorkspaceRedirect />,
      },
      {
        path: "/:owner/:repo",
        element: <WorkspaceView />,
      },
      {
        path: "/:owner/:repo/:sessionId",
        element: <WorkspaceView />,
      },
      {
        path: "*",
        element: <Navigate to="/" replace />,
      },
    ],
  },
])
