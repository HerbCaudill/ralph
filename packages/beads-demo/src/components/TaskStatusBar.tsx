import { IconPlugConnected, IconPlugConnectedX, IconLoader2 } from "@tabler/icons-react"
import type { Workspace, Task, ClosedTasksTimeFilter } from "@herbcaudill/beads-view"
import { TaskProgressBar } from "@herbcaudill/beads-view"

/**
 * Status bar showing connection status, workspace path, and task progress.
 */
export function TaskStatusBar({
  workspace,
  isLoading,
  error,
  isRunning = false,
  tasks = [],
  initialTaskCount = null,
  accentColor = null,
  closedTimeFilter = "past_day",
}: TaskStatusBarProps) {
  return (
    <div className="flex w-full items-center justify-between gap-4">
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

      {/* Progress bar - center */}
      <TaskProgressBar
        className="min-w-25 max-w-50 flex-1 border-none px-2"
        isRunning={isRunning}
        tasks={tasks}
        initialTaskCount={initialTaskCount}
        accentColor={accentColor}
        closedTimeFilter={closedTimeFilter}
      />

      {/* Workspace path - right aligned */}
      {workspace?.path && (
        <div className="flex items-center pr-4">
          <span className="max-w-75 truncate font-mono text-[10px]">{workspace.path}</span>
        </div>
      )}
    </div>
  )
}

export type TaskStatusBarProps = {
  workspace: Workspace | null
  isLoading: boolean
  error: string | null
  /** Whether Ralph is running (controls progress bar visibility). */
  isRunning?: boolean
  /** All tasks to calculate progress from. */
  tasks?: Task[]
  /** Initial task count (progress is hidden when null). */
  initialTaskCount?: number | null
  /** Accent color for the progress bar. */
  accentColor?: string | null
  /** Time filter for closed tasks. */
  closedTimeFilter?: ClosedTasksTimeFilter
}
