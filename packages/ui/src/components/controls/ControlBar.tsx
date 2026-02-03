import { useState, useCallback } from "react"
import {
  IconPlayerPlayFilled,
  IconPlayerPauseFilled,
  IconPlayerStopFilled,
  IconPlayerStop,
} from "@tabler/icons-react"
import { cn } from "@herbcaudill/agent-view"
import {
  getControlBarButtonStates,
  controlStateToRalphStatus,
  type RalphStatus,
} from "@/lib/getControlBarButtonStates"
import type { ControlState } from "@/hooks/useRalphLoop"

/**
 * Props for the ControlBar component.
 */
export interface ControlBarProps {
  /** Current control state. */
  controlState: ControlState
  /** Whether connected to the server. */
  isConnected: boolean
  /** Whether currently stopping after the current task. */
  isStoppingAfterCurrent?: boolean
  /** Called when start button is clicked. */
  onStart?: () => void
  /** Called when pause button is clicked. */
  onPause?: () => void
  /** Called when resume button is clicked. */
  onResume?: () => void
  /** Called when stop button is clicked. */
  onStop?: () => void
  /** Called when stop-after-current button is clicked. */
  onStopAfterCurrent?: () => void
  /** Called when cancel-stop-after-current button is clicked. */
  onCancelStopAfterCurrent?: () => void
  /** Optional CSS class to apply to the container. */
  className?: string
}

/** Base styles for control buttons. */
const buttonBase = cn(
  "flex items-center justify-center rounded-md border border-border p-1 transition-colors",
  "hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed",
)

/**
 * Control bar with buttons for Start, Pause, Stop, and Stop-after-current.
 * Button states are disabled based on Ralph status.
 */
export function ControlBar({
  controlState,
  isConnected,
  isStoppingAfterCurrent = false,
  onStart,
  onPause,
  onResume,
  onStop,
  onStopAfterCurrent,
  onCancelStopAfterCurrent,
  className,
}: ControlBarProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Derive Ralph status from control state
  const status: RalphStatus = controlStateToRalphStatus(controlState, isStoppingAfterCurrent)
  const buttonStates = getControlBarButtonStates(status, isConnected)
  const isPaused = status === "paused"

  /**
   * Start a new Ralph session.
   */
  const handleStart = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      onStart?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start")
    } finally {
      setIsLoading(false)
    }
  }, [onStart])

  /**
   * Pause the current Ralph session or resume if paused.
   */
  const handlePause = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      if (status === "paused" || status === "pausing") {
        onResume?.()
      } else {
        onPause?.()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to pause")
    } finally {
      setIsLoading(false)
    }
  }, [status, onPause, onResume])

  /**
   * Stop the current Ralph session immediately.
   */
  const handleStop = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      onStop?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stop")
    } finally {
      setIsLoading(false)
    }
  }, [onStop])

  /**
   * Stop Ralph after completing the current task, or cancel if already stopping after current.
   */
  const handleStopAfterCurrent = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      if (status === "stopping_after_current") {
        onCancelStopAfterCurrent?.()
      } else {
        onStopAfterCurrent?.()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stop after current")
    } finally {
      setIsLoading(false)
    }
  }, [status, onStopAfterCurrent, onCancelStopAfterCurrent])

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {/* Start button */}
      <button
        onClick={handleStart}
        disabled={!buttonStates.start || isLoading}
        title="Start"
        aria-label="Start"
        className={cn(buttonBase, "text-green-600")}
      >
        <IconPlayerPlayFilled size={14} stroke={1.5} />
      </button>

      {/* Pause/Resume button */}
      <button
        onClick={handlePause}
        disabled={!buttonStates.pause || isLoading}
        title={isPaused ? "Resume" : "Pause"}
        aria-label={isPaused ? "Resume" : "Pause"}
        className={buttonBase}
      >
        <IconPlayerPauseFilled size={14} stroke={1.5} />
      </button>

      {/* Stop button */}
      <button
        onClick={handleStop}
        disabled={!buttonStates.stop || isLoading}
        title="Stop"
        aria-label="Stop"
        className={cn(buttonBase, "hover:text-red-600")}
      >
        <IconPlayerStopFilled size={14} stroke={1.5} />
      </button>

      {/* Stop after current button */}
      <button
        onClick={handleStopAfterCurrent}
        disabled={!buttonStates.stopAfterCurrent || isLoading}
        title={
          status === "stopping_after_current" ? "Cancel stop after current" : "Stop after current"
        }
        aria-label={
          status === "stopping_after_current" ?
            "Cancel stop after current"
          : "Stop after current action"
        }
        className={cn(
          buttonBase,
          status === "stopping_after_current" && "bg-amber-500/20 text-amber-600",
        )}
      >
        <IconPlayerStop size={14} stroke={1.5} />
      </button>

      {/* Error display */}
      {error && <span className="text-red-500 text-xs">{error}</span>}
    </div>
  )
}
