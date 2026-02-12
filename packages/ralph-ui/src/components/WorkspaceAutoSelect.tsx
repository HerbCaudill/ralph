import { useEffect, useState } from "react"
import { Navigate } from "react-router-dom"
import { apiFetch } from "@herbcaudill/beads-view"
import { getWorkspaceId } from "@herbcaudill/beads-sdk"

/**
 * Fetches available workspaces from beads-server and redirects to the first one.
 * Shows a loading state while fetching.
 */
export function WorkspaceAutoSelect() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchWorkspaces = async () => {
      try {
        const res = await apiFetch("/api/workspaces")
        if (!res.ok) {
          setError("Failed to fetch workspaces")
          return
        }
        const data = (await res.json()) as {
          ok: boolean
          workspaces: Array<{ path: string; name: string }>
        }
        if (data.workspaces?.length > 0) {
          const first = data.workspaces[0]
          const id = getWorkspaceId({ workspacePath: first.path })
          setWorkspaceId(id)
        } else {
          setError("No workspaces found")
        }
      } catch {
        setError("Failed to connect to server")
      }
    }
    void fetchWorkspaces()
  }, [])

  if (workspaceId) {
    return <Navigate to={`/${workspaceId}`} replace />
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">{error}</div>
    )
  }

  return (
    <div className="flex h-screen items-center justify-center text-muted-foreground">
      Loading...
    </div>
  )
}
