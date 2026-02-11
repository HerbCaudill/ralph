import { useCallback, useEffect, useRef, useState } from "react"
import { getWorkspaceId } from "@herbcaudill/ralph-shared"
import { apiFetch, configureApiClient, getApiClientConfig } from "../lib/apiClient"
import { beadsViewStore } from "../store/beadsViewStore"

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

/** LocalStorage key for cached workspace info (full Workspace object). */
const WORKSPACE_INFO_KEY = "ralph-workspace-info"

/** LocalStorage key for cached workspaces list. */
const WORKSPACES_LIST_KEY = "ralph-workspaces-list"

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
 * Read the cached workspace info from localStorage.
 * Returns null if not found or invalid JSON.
 */
function getCachedWorkspaceInfo(): Workspace | null {
  try {
    const cached = localStorage.getItem(WORKSPACE_INFO_KEY)
    if (cached) {
      return JSON.parse(cached) as Workspace
    }
  } catch {
    // Ignore parse errors
  }
  return null
}

/**
 * Save workspace info to localStorage cache.
 */
function setCachedWorkspaceInfo(workspace: Workspace): void {
  try {
    localStorage.setItem(WORKSPACE_INFO_KEY, JSON.stringify(workspace))
  } catch {
    // Ignore storage errors
  }
}

/**
 * Read the cached workspaces list from localStorage.
 */
function getCachedWorkspacesList(): Workspace[] {
  try {
    const cached = localStorage.getItem(WORKSPACES_LIST_KEY)
    if (cached) {
      return JSON.parse(cached) as Workspace[]
    }
  } catch {
    // Ignore parse errors
  }
  return []
}

/**
 * Save workspaces list to localStorage cache.
 */
function setCachedWorkspacesList(workspaces: Workspace[]): void {
  try {
    localStorage.setItem(WORKSPACES_LIST_KEY, JSON.stringify(workspaces))
  } catch {
    // Ignore storage errors
  }
}

/**
 * Hook that manages workspace selection entirely on the client side.
 * Fetches workspace list from the server, picks first (or localStorage-saved),
 * and configures the API client to include the workspace path on all requests.
 */
export function useWorkspace(options: UseWorkspaceOptions = {}) {
  const { onSwitchStart, storageKey = DEFAULT_STORAGE_KEY } = options

  // Initialize with cached data synchronously to avoid loading flash
  const [current, setCurrent] = useState<Workspace | null>(() => getCachedWorkspaceInfo())
  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => getCachedWorkspacesList())
  // If we have cached workspace info, start with isLoading: false
  const [isLoading, setIsLoading] = useState(() => getCachedWorkspaceInfo() === null)
  const [error, setError] = useState<string | null>(null)

  // Eagerly configure the API client with the saved workspace path from localStorage.
  // This runs synchronously during the first render, before any effects, so that
  // other hooks (e.g. useTaskDetails) can make API calls that include the workspace
  // parameter even when the store has hydrated cached tasks from a previous session.
  //
  // IMPORTANT: Always configure with the localStorage value if present, even if the
  // API client already has a workspace path configured. This handles the case where
  // the client was configured with a stale value from a previous session or by
  // another component. The localStorage value is authoritative. (Fix for r-0cqve)
  const eagerConfigApplied = useRef(false)
  if (!eagerConfigApplied.current) {
    eagerConfigApplied.current = true
    const savedPath = getSavedWorkspacePath(storageKey)
    if (savedPath) {
      const currentConfig = getApiClientConfig()
      configureApiClient({ ...currentConfig, workspacePath: savedPath })
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
      setCachedWorkspaceInfo(info)
    }
  }, [current, fetchWorkspaceInfo])

  /** Switch to a different workspace. Client-side only -- no server call needed. */
  const switchWorkspace = useCallback(
    async (path: string) => {
      onSwitchStart?.()

      // Update localStorage and apiClient config first
      saveWorkspacePath(path)
      beadsViewStore.getState().hydrateTasksForWorkspace(path)

      // Fetch fresh tasks for the new workspace
      beadsViewStore.getState().refreshTasks()

      // Use cached workspaces list for an instant UI update (name, accent color).
      // The path may be a workspaceId (e.g. "herbcaudill/ralph") or a filesystem path,
      // so match against both.
      const cached = getCachedWorkspacesList()
      const match = cached.find(
        ws => ws.path === path || getWorkspaceId({ workspacePath: ws.path }) === path,
      )
      const immediate: Workspace = match ?? { path, name: path.split("/").pop() || path }
      setCurrent(immediate)
      setCachedWorkspaceInfo(immediate)

      // Refresh full workspace info in the background
      fetchWorkspaceInfo(path).then(info => {
        if (info) {
          setCurrent(info)
          setCachedWorkspaceInfo(info)
        }
      })
    },
    [fetchWorkspaceInfo, onSwitchStart, saveWorkspacePath],
  )

  useEffect(() => {
    const init = async () => {
      const savedPath = getSavedWorkspacePath(storageKey)
      const cachedWorkspace = getCachedWorkspaceInfo()

      // Fast path: we have cached workspace data (already set synchronously in useState)
      // Just refresh in the background
      if (cachedWorkspace && savedPath) {
        // Ensure API client is configured
        saveWorkspacePath(savedPath)
        beadsViewStore.getState().hydrateTasksForWorkspace(savedPath)

        // Refresh workspace info in background (updates cache if data changed)
        fetchWorkspaceInfo(savedPath).then(freshWorkspace => {
          if (freshWorkspace) {
            setCurrent(freshWorkspace)
            setCachedWorkspaceInfo(freshWorkspace)
          }
        })

        // Refresh workspaces list in background
        fetchWorkspaces().then(availableWorkspaces => {
          setWorkspaces(availableWorkspaces)
          setCachedWorkspacesList(availableWorkspaces)
          if (availableWorkspaces.length === 0) {
            setError("No workspaces found")
          }
        })

        return
      }

      // Slow path: no cached data, need to load from server
      setIsLoading(true)

      // If we have a saved workspace path, fetch it
      if (savedPath) {
        // Configure apiClient with the saved workspace path
        saveWorkspacePath(savedPath)
        beadsViewStore.getState().hydrateTasksForWorkspace(savedPath)

        // Fetch saved workspace info
        const savedWorkspace = await fetchWorkspaceInfo(savedPath)

        if (savedWorkspace) {
          // Success! Set current workspace and cache it
          setCurrent(savedWorkspace)
          setCachedWorkspaceInfo(savedWorkspace)
          setIsLoading(false)

          // Load workspace list in background (for the selector)
          fetchWorkspaces().then(availableWorkspaces => {
            setWorkspaces(availableWorkspaces)
            setCachedWorkspacesList(availableWorkspaces)
            if (availableWorkspaces.length === 0) {
              setError("No workspaces found")
            }
          })
          return
        }

        // Saved workspace failed to load - fall through to slow path
      }

      // Slowest path: no saved workspace, or saved workspace failed to load
      // Fetch the full workspace list first
      const availableWorkspaces = await fetchWorkspaces()
      setWorkspaces(availableWorkspaces)
      setCachedWorkspacesList(availableWorkspaces)

      if (availableWorkspaces.length === 0) {
        setError("No workspaces found")
        setIsLoading(false)
        return
      }

      // Select the first workspace from the list
      const targetPath = availableWorkspaces[0].path

      // Configure apiClient with the workspace path
      saveWorkspacePath(targetPath)
      beadsViewStore.getState().hydrateTasksForWorkspace(targetPath)

      // Fetch detailed info for the selected workspace
      const info = await fetchWorkspaceInfo(targetPath)
      if (info) {
        setCurrent(info)
        setCachedWorkspaceInfo(info)
      } else {
        // Use minimal info from the workspace list
        setCurrent(availableWorkspaces[0])
        setCachedWorkspaceInfo(availableWorkspaces[0])
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
