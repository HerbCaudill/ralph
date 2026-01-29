import { useState, useRef, useEffect, useCallback } from "react"
import { IconFolderFilled, IconChevronDown, IconCheck, IconRefresh } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import {
  useAppStore,
  selectWorkspace,
  selectAccentColor,
  selectBranch,
  selectIssuePrefix,
} from "@/store"
import {
  clearEventTimestamps,
  pauseMessageProcessing,
  resumeMessageProcessing,
} from "@/lib/ralphConnection"
import type { WorkspaceInfo, WorkspaceListEntry } from "@/types"

/**
 * Dropdown component to select and switch between workspaces.
 * Fetches available workspaces from the server and displays workspace info.
 */
export function WorkspacePicker({
  /** Optional CSS class name */
  className,
  /** Display variant - "header" for colored header background */
  variant = "default",
  /** Text color to use when variant is "header" */
  textColor,
}: WorkspacePickerProps) {
  const workspace = useAppStore(selectWorkspace)
  const accentColor = useAppStore(selectAccentColor)
  const branch = useAppStore(selectBranch)
  const issuePrefix = useAppStore(selectIssuePrefix)
  const setWorkspace = useAppStore(state => state.setWorkspace)
  const setAccentColor = useAppStore(state => state.setAccentColor)
  const setBranch = useAppStore(state => state.setBranch)
  const setIssuePrefix = useAppStore(state => state.setIssuePrefix)
  const clearWorkspaceData = useAppStore(state => state.clearWorkspaceData)
  const refreshTasks = useAppStore(state => state.refreshTasks)
  const [isOpen, setIsOpen] = useState(false)
  const [workspaceInfo, setWorkspaceInfo] = useState<WorkspaceInfo | null>(null)
  const [allWorkspaces, setAllWorkspaces] = useState<WorkspaceListEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingList, setIsLoadingList] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  /**
   * Fetch workspace info from the server and update store state
   */
  const fetchWorkspaceInfo = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/workspace")
      if (!response.ok) {
        throw new Error("Failed to fetch workspace info")
      }
      const data = await response.json()
      if (data.ok && data.workspace) {
        setWorkspaceInfo(data.workspace)
        // Update the store with the workspace path
        if (data.workspace.path !== workspace) {
          setWorkspace(data.workspace.path)
        }
        // Update the store with the accent color from peacock
        if (data.workspace.accentColor !== accentColor) {
          setAccentColor(data.workspace.accentColor ?? null)
        }
        // Update the store with the git branch
        if (data.workspace.branch !== branch) {
          setBranch(data.workspace.branch ?? null)
        }
        // Update the store with the issue prefix
        if (data.workspace.issuePrefix !== issuePrefix) {
          setIssuePrefix(data.workspace.issuePrefix ?? null)
        }
      } else {
        throw new Error(data.error || "Unknown error")
      }
    } catch (err) {
      // Detect connection refused (server not running)
      const message = err instanceof Error ? err.message : "Failed to fetch workspace"
      const isConnectionError =
        message.includes("fetch") || message.includes("ECONNREFUSED") || message.includes("network")
      setError(isConnectionError ? "Server not running" : message)
    } finally {
      setIsLoading(false)
    }
  }, [
    workspace,
    accentColor,
    branch,
    issuePrefix,
    setWorkspace,
    setAccentColor,
    setBranch,
    setIssuePrefix,
  ])

  /**
   * Fetch all available workspaces from the registry
   */
  const fetchAllWorkspaces = useCallback(async () => {
    setIsLoadingList(true)
    try {
      const response = await fetch("/api/workspaces")
      if (!response.ok) {
        throw new Error("Failed to fetch workspaces")
      }
      const data = await response.json()
      if (data.ok && data.workspaces) {
        // Filter out test workspaces unless running in automation (Playwright)
        const isAutomated = navigator.webdriver === true
        const workspaces =
          isAutomated ?
            data.workspaces
          : data.workspaces.filter(
              (ws: WorkspaceListEntry) => !ws.path.includes("/e2e/test-workspace"),
            )
        setAllWorkspaces(workspaces)
      }
    } catch (err) {
      console.error("Failed to fetch workspaces:", err)
    } finally {
      setIsLoadingList(false)
    }
  }, [])

  /**
   * Switch to a different workspace, clear workspace data, and refresh tasks
   */
  const switchToWorkspace = useCallback(
    async (workspacePath: string) => {
      setIsLoading(true)
      setError(null)
      // Pause WebSocket message processing to prevent stale events from being
      // routed to cleared state during the switch (fixes r-7r110.3)
      pauseMessageProcessing()
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
          // Clear all workspace-specific data (events, tasks, token usage, etc.)
          clearWorkspaceData()
          // Clear event tracking state in ralphConnection to start fresh
          clearEventTimestamps()
          setWorkspaceInfo(data.workspace)
          setWorkspace(data.workspace.path)
          setAccentColor(data.workspace.accentColor ?? null)
          setBranch(data.workspace.branch ?? null)
          setIssuePrefix(data.workspace.issuePrefix ?? null)
          // Update the list to reflect new active state
          setAllWorkspaces(prev =>
            prev.map(ws => ({
              ...ws,
              isActive: ws.path === workspacePath,
            })),
          )
          // Refresh tasks from the new workspace (debounced)
          refreshTasks()
        } else {
          throw new Error(data.error || "Unknown error")
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to switch workspace"
        setError(message)
      } finally {
        // Resume processing — any messages that arrived during the switch
        // will now be replayed against the new workspace state
        resumeMessageProcessing()
        setIsLoading(false)
        setIsOpen(false)
      }
    },
    [setWorkspace, setAccentColor, setBranch, setIssuePrefix, clearWorkspaceData, refreshTasks],
  )

  // Fetch workspace info on mount (only once)
  const hasFetchedRef = useRef(false)
  useEffect(() => {
    if (hasFetchedRef.current) return
    hasFetchedRef.current = true
    fetchWorkspaceInfo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch all workspaces when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchAllWorkspaces()
    }
  }, [isOpen, fetchAllWorkspaces])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Check if server is not running
  const isServerDown = error === "Server not running"

  // Display name: use workspaceInfo name, or derive from workspace path, or fallback
  const displayName =
    isServerDown ? "Server not running" : (
      workspaceInfo?.name || (workspace ? workspace.split("/").pop() : null) || "No workspace"
    )

  // Issue count badge
  const issueCount = workspaceInfo?.issueCount

  const isHeaderVariant = variant === "header"

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 rounded-md px-3 py-1.5",
          "transition-colors",
          "text-sm font-medium",
          isLoading && "opacity-70",
          isHeaderVariant ?
            cn("hover:bg-white/20", isServerDown && "bg-status-error/30 hover:bg-status-error/40")
          : cn(
              "bg-secondary hover:bg-secondary/80",
              isServerDown && "bg-status-error/10 text-status-error hover:bg-status-error/20",
            ),
        )}
        style={
          isHeaderVariant ? { color: isServerDown ? "var(--status-error)" : textColor } : undefined
        }
        aria-expanded={isOpen}
        aria-haspopup="true"
        disabled={isLoading}
      >
        <IconFolderFilled
          className={cn(
            "size-4",
            isServerDown && "text-status-error",
            !isHeaderVariant && !accentColor && "text-muted-foreground",
          )}
          style={{
            color:
              isServerDown ? undefined
              : isHeaderVariant ? textColor
              : (accentColor ?? undefined),
          }}
        />
        <span className="max-w-[200px] truncate">{displayName}</span>
        {issueCount !== undefined && (
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-xs",
              isHeaderVariant ? "bg-white/20" : "bg-muted text-muted-foreground",
            )}
          >
            {issueCount}
          </span>
        )}
        <IconChevronDown className={cn("size-3 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div
          className={cn(
            "bg-popover text-popover-foreground border-border absolute top-full left-0 z-50 mt-1 w-80 rounded-md border shadow-lg",
          )}
        >
          {/* Error state */}
          {error && (
            <div className="p-3">
              <div className="text-status-error flex items-center gap-2 text-sm">
                <span>{error}</span>
                <button
                  onClick={fetchWorkspaceInfo}
                  className="text-status-error/80 hover:text-status-error/60"
                  title="Retry"
                >
                  <IconRefresh className="size-3.5" />
                </button>
              </div>
              {isServerDown && (
                <p className="text-muted-foreground mt-2 text-xs">
                  Run <code className="bg-muted rounded px-1">pnpm dev</code> to start both servers
                </p>
              )}
            </div>
          )}

          {/* Workspaces list */}
          {!error && (
            <div className="max-h-80 overflow-y-auto p-1">
              <div className="text-muted-foreground px-3 py-1.5 text-xs font-medium tracking-wider uppercase">
                Workspaces
              </div>
              {isLoadingList && allWorkspaces.length === 0 ?
                <div className="text-muted-foreground px-3 py-2 text-sm">Loading...</div>
              : allWorkspaces.length === 0 ?
                <div className="text-muted-foreground px-3 py-2 text-sm">No workspaces found</div>
              : allWorkspaces.map(ws => (
                  <button
                    key={ws.path}
                    onClick={() => {
                      if (!ws.isActive) {
                        switchToWorkspace(ws.path)
                      } else {
                        setIsOpen(false)
                      }
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded px-3 py-2 text-left",
                      "hover:bg-repo-accent transition-colors",
                      ws.isActive && "bg-repo-accent/50",
                    )}
                  >
                    {/* Accent color folder icon */}
                    <IconFolderFilled
                      className={cn("size-3.5", !ws.accentColor && "text-muted-foreground")}
                      style={{ color: ws.accentColor ?? undefined }}
                    />
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="truncate text-sm font-medium">{ws.name}</span>
                      {ws.activeIssueCount !== undefined && (
                        <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-xs">
                          {ws.activeIssueCount}
                        </span>
                      )}
                      {ws.isActive && <IconCheck className="text-primary size-3.5 shrink-0" />}
                    </div>
                  </button>
                ))
              }
            </div>
          )}

          {/* Actions section */}
          <div className="border-border border-t p-1">
            <button
              onClick={() => {
                fetchWorkspaceInfo()
                fetchAllWorkspaces()
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded px-3 py-2 text-sm",
                "hover:bg-repo-accent transition-colors",
              )}
            >
              <IconRefresh className="text-muted-foreground size-3.5" />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/**  Props for the WorkspacePicker component */
export type WorkspacePickerProps = {
  className?: string
  variant?: "default" | "header"
  textColor?: string
}
