import { useCallback } from "react"
import {
  IconPlayerPlayFilled,
  IconPlayerPauseFilled,
  IconPlayerStopFilled,
} from "@tabler/icons-react"
import { cn } from "@herbcaudill/agent-view"
import { Button } from "@herbcaudill/components"

/**
 * State of an individual worker.
 */
export type WorkerState = "idle" | "running" | "paused"

/**
 * Information about a worker's current state.
 */
export interface WorkerInfo {
  workerName: string
  state: WorkerState
  currentWorkId: string | null
}

/**
 * Props for the WorkerControlBar component.
 */
export interface WorkerControlBarProps {
  /** List of active workers and their states. */
  workers: WorkerInfo[]
  /** Whether the orchestrator is stopping (stop-after-current was triggered). */
  isStoppingAfterCurrent?: boolean
  /** Whether connected to the server. */
  isConnected: boolean
  /** Called when pause button is clicked for a specific worker. */
  onPauseWorker?: (workerName: string) => void
  /** Called when resume button is clicked for a specific worker. */
  onResumeWorker?: (workerName: string) => void
  /** Called when stop button is clicked for a specific worker. */
  onStopWorker?: (workerName: string) => void
  /** Called when stop-after-current button is clicked (global). */
  onStopAfterCurrent?: () => void
  /** Called when cancel-stop-after-current button is clicked (global). */
  onCancelStopAfterCurrent?: () => void
  /** Optional CSS class to apply to the container. */
  className?: string
}

/**
 * Control bar showing per-worker controls and global stop-after-current.
 * Each worker can be paused, resumed, or stopped independently.
 */
export function WorkerControlBar({
  workers,
  isStoppingAfterCurrent = false,
  isConnected,
  onPauseWorker,
  onResumeWorker,
  onStopWorker,
  onStopAfterCurrent,
  onCancelStopAfterCurrent,
  className,
}: WorkerControlBarProps) {
  const handleStopAfterCurrent = useCallback(() => {
    onStopAfterCurrent?.()
  }, [onStopAfterCurrent])

  const handleCancelStopAfterCurrent = useCallback(() => {
    onCancelStopAfterCurrent?.()
  }, [onCancelStopAfterCurrent])

  if (workers.length === 0) {
    return null
  }

  return (
    <div className={cn("flex flex-col gap-2 p-2", className)}>
      {/* Global controls */}
      <div className="flex items-center justify-between border-b border-border pb-2">
        <span className="text-sm font-medium text-muted-foreground">Workers</span>
        <Button
          variant="outline"
          size="sm"
          onClick={isStoppingAfterCurrent ? handleCancelStopAfterCurrent : handleStopAfterCurrent}
          disabled={!isConnected}
          title={
            isStoppingAfterCurrent ? "Cancel stop after current" : "Stop all after current task"
          }
        >
          {isStoppingAfterCurrent ? "Cancel Stop" : "Stop All"}
        </Button>
      </div>

      {/* Per-worker controls */}
      <div className="flex flex-col gap-1">
        {workers.map(worker => (
          <WorkerRow
            key={worker.workerName}
            worker={worker}
            isConnected={isConnected}
            onPause={() => onPauseWorker?.(worker.workerName)}
            onResume={() => onResumeWorker?.(worker.workerName)}
            onStop={() => onStopWorker?.(worker.workerName)}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Props for the WorkerRow component.
 */
interface WorkerRowProps {
  worker: WorkerInfo
  isConnected: boolean
  onPause: () => void
  onResume: () => void
  onStop: () => void
}

/**
 * A single row showing worker name, task, and control buttons.
 */
function WorkerRow({ worker, isConnected, onPause, onResume, onStop }: WorkerRowProps) {
  const isRunning = worker.state === "running"
  const isPaused = worker.state === "paused"
  const canPause = isRunning && isConnected
  const canResume = isPaused && isConnected
  const canStop = (isRunning || isPaused) && isConnected

  return (
    <div className="flex items-center justify-between gap-2 rounded bg-muted/50 px-2 py-1.5">
      <div className="flex min-w-0 flex-col">
        <span className="text-sm font-medium capitalize">{worker.workerName}</span>
        {worker.currentWorkId && (
          <span className="truncate text-xs text-muted-foreground">{worker.currentWorkId}</span>
        )}
      </div>

      <div className="flex items-center gap-1">
        {/* State indicator */}
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-xs font-medium",
            isRunning && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
            isPaused && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
            worker.state === "idle" &&
              "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
          )}
        >
          {worker.state}
        </span>

        {/* Play/Pause button */}
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={isPaused ? onResume : onPause}
          disabled={!(canPause || canResume)}
          title={isPaused ? "Resume" : "Pause"}
          aria-label={isPaused ? `Resume ${worker.workerName}` : `Pause ${worker.workerName}`}
        >
          {isPaused ?
            <IconPlayerPlayFilled size={12} stroke={1.5} />
          : <IconPlayerPauseFilled size={12} stroke={1.5} />}
        </Button>

        {/* Stop button */}
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onStop}
          disabled={!canStop}
          title="Stop worker"
          aria-label={`Stop ${worker.workerName}`}
        >
          <IconPlayerStopFilled size={12} stroke={1.5} />
        </Button>
      </div>
    </div>
  )
}
