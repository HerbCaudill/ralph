import { useCallback, useEffect, useState } from "react"

export type Workspace = {
  path: string
  name: string
  issueCount?: number
  branch?: string
  accentColor?: string
  issuePrefix?: string
}

export type WorkspaceState = {
  current: Workspace | null
  workspaces: Workspace[]
  isLoading: boolean
  error: string | null
}

export type UseWorkspaceOptions = {
  /** Callback fired immediately when a workspace switch starts, before the API call. */
  onSwitchStart?: () => void
  /** localStorage key for persisting the selected workspace. */
  storageKey?: string
}

/** Default localStorage key for workspace persistence. */
const DEFAULT_STORAGE_KEY = "ralph-workspace-path"

/**
 * Hook that fetches workspace info and provides workspace switching.
 * Persists the selected workspace path to localStorage.
 */
export function useWorkspace(options: UseWorkspaceOptions = {}) {
  const { onSwitchStart, storageKey = DEFAULT_STORAGE_KEY } = options
  const [current, setCurrent] = useState<Workspace | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /** Get saved workspace path from localStorage. */
  const getSavedWorkspacePath = useCallback(() => {
    try {
      return localStorage.getItem(storageKey)
    } catch {
      return null
    }
  }, [storageKey])

  /** Save workspace path to localStorage. */
  const saveWorkspacePath = useCallback(
    (path: string) => {
      try {
        localStorage.setItem(storageKey, path)
      } catch {
        // Ignore storage errors
      }
    },
    [storageKey],
  )

  const fetchWorkspace = useCallback(async () => {
    try {
      const res = await fetch("/api/workspace")
      if (!res.ok) throw new Error("Failed to fetch workspace")
      const data = (await res.json()) as {
        ok: boolean
        workspace?: Workspace
      }
      if (data.ok !== false && data.workspace) {
        setCurrent(data.workspace)
        // Save current workspace path on successful fetch
        saveWorkspacePath(data.workspace.path)
      }
    } catch (e) {
      setError((e as Error).message)
    }
  }, [saveWorkspacePath])

  const fetchWorkspaces = useCallback(async () => {
    try {
      const res = await fetch("/api/workspaces")
      if (!res.ok) return
      const data = (await res.json()) as {
        ok: boolean
        workspaces: Workspace[]
      }
      if (data.ok !== false && data.workspaces) {
        setWorkspaces(data.workspaces)
      }
    } catch {
      // Ignore - workspaces list is optional
    }
  }, [])

  const switchWorkspace = useCallback(
    async (path: string) => {
      try {
        setIsLoading(true)
        onSwitchStart?.()
        const res = await fetch("/api/workspace/switch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path }),
        })
        if (!res.ok) throw new Error("Failed to switch workspace")
        await fetchWorkspace()
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setIsLoading(false)
      }
    },
    [fetchWorkspace, onSwitchStart],
  )

  useEffect(() => {
    const init = async () => {
      setIsLoading(true)

      // Get saved workspace path first
      const savedPath = getSavedWorkspacePath()

      // Fetch current workspace info
      let currentWorkspace: Workspace | null = null
      let fetchError: string | null = null
      try {
        const res = await fetch("/api/workspace")
        if (!res.ok) {
          fetchError = "Failed to fetch workspace"
        } else {
          const data = (await res.json()) as { ok: boolean; workspace?: Workspace }
          if (data.ok !== false && data.workspace) {
            currentWorkspace = data.workspace
          }
        }
      } catch (e) {
        fetchError = (e as Error).message
      }

      // If there was an error fetching workspace, set it and stop
      if (fetchError) {
        setError(fetchError)
        await fetchWorkspaces()
        setIsLoading(false)
        return
      }

      // If saved workspace differs from current, switch to it
      if (savedPath && currentWorkspace?.path !== savedPath) {
        try {
          const switchRes = await fetch("/api/workspace/switch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: savedPath }),
          })
          if (switchRes.ok) {
            // Re-fetch current workspace after switch
            const res = await fetch("/api/workspace")
            if (res.ok) {
              const data = (await res.json()) as { ok: boolean; workspace?: Workspace }
              if (data.ok !== false && data.workspace) {
                currentWorkspace = data.workspace
              }
            }
          }
        } catch {
          // If switch fails, continue with current workspace
        }
      }

      // Update state
      if (currentWorkspace) {
        setCurrent(currentWorkspace)
        saveWorkspacePath(currentWorkspace.path)
      }

      // Fetch available workspaces
      await fetchWorkspaces()

      setIsLoading(false)
    }
    void init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    state: { current, workspaces, isLoading, error },
    actions: { switchWorkspace, refresh: fetchWorkspace },
  }
}
