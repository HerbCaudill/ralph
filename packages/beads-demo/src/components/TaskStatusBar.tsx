import { IconPlugConnected, IconPlugConnectedX, IconLoader2 } from "@tabler/icons-react"
import type { Workspace } from "@herbcaudill/beads-view"

/**
 * Status bar showing connection status and workspace path.
 */
export function TaskStatusBar({ workspace, isLoading, error }: TaskStatusBarProps) {
  return (
    <div className="flex w-full items-center justify-between">
      <div className="flex items-center gap-3 pl-4">
        {/* Connection status */}
        <span className="flex items-center gap-1">
          {error ?
            <IconPlugConnectedX size={14} stroke={1.5} className="text-red-500" />
          : isLoading ?
            <IconLoader2 size={14} stroke={1.5} className="animate-spin text-amber-500" />
          : <IconPlugConnected size={14} stroke={1.5} className="text-green-600" />}
          {error ?
            <span className="text-red-500">{error}</span>
          : isLoading ?
            "Loading…"
          : "Connected"}
        </span>
      </div>

      {/* Workspace path - right aligned */}
      {workspace?.path && (
        <div className="flex items-center pr-4">
          <span className="max-w-[300px] truncate font-mono text-[10px]">{workspace.path}</span>
        </div>
      )}
    </div>
  )
}

export type TaskStatusBarProps = {
  workspace: Workspace | null
  isLoading: boolean
  error: string | null
}
