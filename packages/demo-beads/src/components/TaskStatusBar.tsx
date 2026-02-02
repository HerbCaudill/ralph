import {
  IconPlugConnected,
  IconPlugConnectedX,
  IconLoader2,
} from "@tabler/icons-react"
import type { Workspace } from "../hooks/useWorkspace"
import type { TaskCardTask } from "@herbcaudill/beads-view"

export type TaskStatusBarProps = {
  workspace: Workspace | null
  tasks: TaskCardTask[]
  isLoading: boolean
  error: string | null
}

/**
 * Status bar showing workspace info and task counts.
 */
export function TaskStatusBar({
  workspace,
  tasks,
  isLoading,
  error,
}: TaskStatusBarProps) {
  const openCount = tasks.filter(
    (t) => t.status === "open" || t.status === "in_progress"
  ).length
  const closedCount = tasks.filter((t) => t.status === "closed").length
  const totalCount = tasks.length

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {/* Connection status */}
        <span className="flex items-center gap-1">
          {error ? (
            <IconPlugConnectedX
              size={14}
              stroke={1.5}
              className="text-red-500"
            />
          ) : isLoading ? (
            <IconLoader2
              size={14}
              stroke={1.5}
              className="animate-spin text-amber-500"
            />
          ) : (
            <IconPlugConnected
              size={14}
              stroke={1.5}
              className="text-green-600"
            />
          )}
          {error ? (
            <span className="text-red-500">{error}</span>
          ) : isLoading ? (
            "Loading…"
          ) : (
            "Connected"
          )}
        </span>

        {/* Workspace path */}
        {workspace?.path && (
          <>
            <span className="text-muted-foreground/60">|</span>
            <span className="max-w-[300px] truncate font-mono text-[10px]">
              {workspace.path}
            </span>
          </>
        )}
      </div>

      {/* Task counts */}
      {totalCount > 0 && (
        <div className="flex items-center gap-2">
          <span>{openCount} open</span>
          <span className="text-muted-foreground/60">|</span>
          <span>{closedCount} closed</span>
          <span className="text-muted-foreground/60">|</span>
          <span>{totalCount} total</span>
        </div>
      )}
    </div>
  )
}
