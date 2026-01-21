import { useState, useCallback, useRef, useEffect } from "react"
import { useAppStore, selectWorkspace } from "@/store"
import type { WorkspaceListEntry } from "@/types"

export interface UseWorkspacesReturn {
  /** List of all available workspaces */
  workspaces: WorkspaceListEntry[]
  /** Whether the workspaces list is being loaded */
  isLoading: boolean
  /** Fetch the list of workspaces */
  refresh: () => Promise<void>
  /** Switch to the previous workspace in the list */
  goToPreviousWorkspace: () => Promise<void>
  /** Switch to the next workspace in the list */
  goToNextWorkspace: () => Promise<void>
}

/**
 * Hook for managing workspaces and workspace switching.
 * Provides functions for navigating between workspaces.
 */
export function useWorkspaces(): UseWorkspacesReturn {
  const [workspaces, setWorkspaces] = useState<WorkspaceListEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const currentWorkspace = useAppStore(selectWorkspace)
  const setWorkspace = useAppStore(state => state.setWorkspace)
  const setAccentColor = useAppStore(state => state.setAccentColor)
  const setBranch = useAppStore(state => state.setBranch)
  const setIssuePrefix = useAppStore(state => state.setIssuePrefix)
  const clearWorkspaceData = useAppStore(state => state.clearWorkspaceData)
  const refreshTasks = useAppStore(state => state.refreshTasks)

  // Track if we've fetched workspaces at least once
  const hasFetched = useRef(false)

  // Fetch all available workspaces
  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/workspaces")
      if (!response.ok) {
        throw new Error("Failed to fetch workspaces")
      }
      const data = await response.json()
      if (data.ok && data.workspaces) {
        setWorkspaces(data.workspaces)
      }
    } catch (err) {
      console.error("Failed to fetch workspaces:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch workspaces on mount
  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true
      refresh()
    }
  }, [refresh])

  // Switch to a specific workspace
  const switchToWorkspace = useCallback(
    async (workspacePath: string) => {
      try {
        const response = await fetch("/api/workspace/switch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: workspacePath }),
        })
        if (!response.ok) {
          throw new Error("Failed to switch workspace")
        }
        const data = await response.json()
        if (data.ok && data.workspace) {
          // Clear all workspace-specific data
          clearWorkspaceData()
          setWorkspace(data.workspace.path)
          setAccentColor(data.workspace.accentColor ?? null)
          setBranch(data.workspace.branch ?? null)
          setIssuePrefix(data.workspace.issuePrefix ?? null)
          // Update the list to reflect new active state
          setWorkspaces(prev =>
            prev.map(ws => ({
              ...ws,
              isActive: ws.path === workspacePath,
            })),
          )
          // Refresh tasks from the new workspace
          await refreshTasks()
        } else {
          throw new Error(data.error || "Unknown error")
        }
      } catch (err) {
        console.error("Failed to switch workspace:", err)
      }
    },
    [setWorkspace, setAccentColor, setBranch, setIssuePrefix, clearWorkspaceData, refreshTasks],
  )

  // Get the current workspace index
  const getCurrentIndex = useCallback(() => {
    if (workspaces.length === 0) return -1
    return workspaces.findIndex(ws => ws.isActive || ws.path === currentWorkspace)
  }, [workspaces, currentWorkspace])

  // Switch to the previous workspace
  const goToPreviousWorkspace = useCallback(async () => {
    // Refresh the list first to ensure we have the latest
    if (workspaces.length === 0) {
      await refresh()
    }

    const currentWorkspaces = workspaces.length > 0 ? workspaces : []
    if (currentWorkspaces.length <= 1) return

    const currentIndex = getCurrentIndex()
    if (currentIndex === -1) return

    // Wrap around to the end if at the beginning
    const newIndex = currentIndex === 0 ? currentWorkspaces.length - 1 : currentIndex - 1
    await switchToWorkspace(currentWorkspaces[newIndex].path)
  }, [workspaces, refresh, getCurrentIndex, switchToWorkspace])

  // Switch to the next workspace
  const goToNextWorkspace = useCallback(async () => {
    // Refresh the list first to ensure we have the latest
    if (workspaces.length === 0) {
      await refresh()
    }

    const currentWorkspaces = workspaces.length > 0 ? workspaces : []
    if (currentWorkspaces.length <= 1) return

    const currentIndex = getCurrentIndex()
    if (currentIndex === -1) return

    // Wrap around to the beginning if at the end
    const newIndex = currentIndex === currentWorkspaces.length - 1 ? 0 : currentIndex + 1
    await switchToWorkspace(currentWorkspaces[newIndex].path)
  }, [workspaces, refresh, getCurrentIndex, switchToWorkspace])

  return {
    workspaces,
    isLoading,
    refresh,
    goToPreviousWorkspace,
    goToNextWorkspace,
  }
}
