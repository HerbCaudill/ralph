import { useCallback, useEffect, useRef, useState } from "react"
import { apiFetch, configureApiClient, getApiClientConfig } from "../lib/apiClient"

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
  /** Callback fired immediately when a workspace switch starts. */
  onSwitchStart?: () => void
  /** localStorage key for persisting the selected workspace. */
  storageKey?: string
}

/** Default localStorage key for workspace persistence. */
const DEFAULT_STORAGE_KEY = "ralph-workspace-path"

/**
 * Read the saved workspace path from localStorage.
 * Exported so callers can eagerly configure the API client at module scope.
 */
export function getSavedWorkspacePath(
  /** The localStorage key to read from. */
  storageKey: string = DEFAULT_STORAGE_KEY,
): string | null {
  try {
    return localStorage.getItem(storageKey)
  } catch {
    return null
  }
}

/**
 * Hook that manages workspace selection entirely on the client side.
 * Fetches workspace list from the server, picks first (or localStorage-saved),
 * and configures the API client to include the workspace path on all requests.
 */
export function useWorkspace(options: UseWorkspaceOptions = {}) {
  const { onSwitchStart, storageKey = DEFAULT_STORAGE_KEY } = options
  const [current, setCurrent] = useState<Workspace | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Eagerly configure the API client with the saved workspace path from localStorage.
  // This runs synchronously during the first render, before any effects, so that
  // other hooks (e.g. useTaskDetails) can make API calls that include the workspace
  // parameter even when the store has hydrated cached tasks from a previous session.
  const eagerConfigApplied = useRef(false)
  if (!eagerConfigApplied.current) {
    eagerConfigApplied.current = true
    const savedPath = getSavedWorkspacePath(storageKey)
    if (savedPath) {
      const currentConfig = getApiClientConfig()
      if (!currentConfig.workspacePath) {
        configureApiClient({ ...currentConfig, workspacePath: savedPath })
      }
    }
  }

  /** Save workspace path to localStorage and update the API client config. */
  const saveWorkspacePath = useCallback(
    (path: string) => {
      try {
        localStorage.setItem(storageKey, path)
      } catch {
        // Ignore storage errors
      }
      // Update the API client so all subsequent requests include this workspace
      const currentConfig = getApiClientConfig()
      configureApiClient({ ...currentConfig, workspacePath: path })
    },
    [storageKey],
  )

  /** Fetch detailed workspace info for a given workspace path. */
  const fetchWorkspaceInfo = useCallback(
    async (workspacePath: string): Promise<Workspace | null> => {
      try {
        const res = await apiFetch(`/api/workspace`)
        if (!res.ok) return null
        const data = (await res.json()) as { ok: boolean; workspace?: Workspace }
        if (data.ok !== false && data.workspace) {
          return data.workspace
        }
        return null
      } catch {
        return null
      }
    },
    [],
  )

  /** Fetch the list of available workspaces from the server. */
  const fetchWorkspaces = useCallback(async (): Promise<Workspace[]> => {
    try {
      // /api/workspaces does not need a workspace param
      const res = await apiFetch("/api/workspaces")
      if (!res.ok) return []
      const data = (await res.json()) as {
        ok: boolean
        workspaces: Array<{
          path: string
          name: string
          accentColor?: string
          activeIssueCount?: number
        }>
      }
      if (data.ok !== false && data.workspaces) {
        return data.workspaces.map(ws => ({
          path: ws.path,
          name: ws.name,
          accentColor: ws.accentColor,
          issueCount: ws.activeIssueCount,
        }))
      }
      return []
    } catch {
      return []
    }
  }, [])

  /** Refresh the current workspace info. */
  const refresh = useCallback(async () => {
    if (!current) return
    const info = await fetchWorkspaceInfo(current.path)
    if (info) {
      setCurrent(info)
    }
  }, [current, fetchWorkspaceInfo])

  /** Switch to a different workspace. Client-side only -- no server call needed. */
  const switchWorkspace = useCallback(
    async (path: string) => {
      try {
        setIsLoading(true)
        onSwitchStart?.()

        // Update localStorage and apiClient config first
        saveWorkspacePath(path)

        // Fetch workspace info for the new workspace
        const info = await fetchWorkspaceInfo(path)
        if (info) {
          setCurrent(info)
        } else {
          // Even if we can't get full info, set minimal workspace data
          setCurrent({ path, name: path.split("/").pop() || path })
        }
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setIsLoading(false)
      }
    },
    [fetchWorkspaceInfo, onSwitchStart, saveWorkspacePath],
  )

  useEffect(() => {
    const init = async () => {
      setIsLoading(true)

      // Fetch available workspaces
      const availableWorkspaces = await fetchWorkspaces()
      setWorkspaces(availableWorkspaces)

      if (availableWorkspaces.length === 0) {
        setError("No workspaces found")
        setIsLoading(false)
        return
      }

      // Determine which workspace to use
      const savedPath = getSavedWorkspacePath(storageKey)
      const savedExists = savedPath && availableWorkspaces.some(ws => ws.path === savedPath)
      const targetPath = savedExists ? savedPath : availableWorkspaces[0].path

      // Configure apiClient with the workspace path
      saveWorkspacePath(targetPath)

      // Fetch detailed info for the selected workspace
      const info = await fetchWorkspaceInfo(targetPath)
      if (info) {
        setCurrent(info)
      } else {
        // Use minimal info from the workspace list
        const wsFromList = availableWorkspaces.find(ws => ws.path === targetPath)
        if (wsFromList) {
          setCurrent(wsFromList)
        }
      }

      setIsLoading(false)
    }
    void init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    state: { current, workspaces, isLoading, error },
    actions: { switchWorkspace, refresh },
  }
}
