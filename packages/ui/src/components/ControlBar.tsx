import { useState, useCallback } from "react"
import {
  IconPlayerPlayFilled,
  IconPlayerPauseFilled,
  IconPlayerStopFilled,
  IconX,
} from "@tabler/icons-react"
import { cn } from "@herbcaudill/agent-view"
import { Button } from "@herbcaudill/components"
import type { ControlState } from "@/hooks/useRalphLoop"

/**
 * Props for the ControlBar component.
 */
export interface ControlBarProps {
  /** Current control state. */
  controlState: ControlState
  /** Whether connected to the server. */
  isConnected: boolean
  /** Whether currently stopping after the current session. */
  isStoppingAfterCurrent?: boolean
  /** Called when start button is clicked. */
  onStart?: () => void
  /** Called when pause button is clicked. */
  onPause?: () => void
  /** Called when stop-after-current button is clicked. */
  onStopAfterCurrent?: () => void
  /** Called when cancel-stop-after-current button is clicked. */
  onCancelStopAfterCurrent?: () => void
  /** Optional CSS class to apply to the container. */
  className?: string
}

/**
 * Control bar with Start, Pause, and Stop-after-current buttons.
 * Button states are disabled based on control state.
 */
export function ControlBar({
  controlState,
  isConnected,
  isStoppingAfterCurrent = false,
  onStart,
  onPause,
  onStopAfterCurrent,
  onCancelStopAfterCurrent,
  className,
}: ControlBarProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isRunning = controlState === "running"
  const canStart = !isRunning && isConnected
  const canPause = isRunning && !isStoppingAfterCurrent
  const canStopAfterCurrent = isRunning && !isStoppingAfterCurrent

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
   * Pause/interrupt the current Ralph session immediately.
   */
  const handlePause = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      onPause?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to pause")
    } finally {
      setIsLoading(false)
    }
  }, [onPause])

  /**
   * Stop after the current session completes.
   */
  const handleStopAfterCurrent = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      onStopAfterCurrent?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set stop after current")
    } finally {
      setIsLoading(false)
    }
  }, [onStopAfterCurrent])

  /**
   * Cancel the pending stop-after-current.
   */
  const handleCancelStopAfterCurrent = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      onCancelStopAfterCurrent?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel")
    } finally {
      setIsLoading(false)
    }
  }, [onCancelStopAfterCurrent])

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {/* Start button */}
      <Button
        variant="outline"
        size="icon-xs"
        onClick={handleStart}
        disabled={!canStart || isLoading}
        title="Start"
        aria-label="Start"
      >
        <IconPlayerPlayFilled size={14} stroke={1.5} />
      </Button>

      {/* Pause button */}
      <Button
        variant="outline"
        size="icon-xs"
        onClick={handlePause}
        disabled={!canPause || isLoading}
        title="Pause"
        aria-label="Pause"
      >
        <IconPlayerPauseFilled size={14} stroke={1.5} />
      </Button>

      {/* Stop after current button or Cancel button */}
      {isStoppingAfterCurrent ?
        <Button
          variant="outline"
          size="icon-xs"
          onClick={handleCancelStopAfterCurrent}
          disabled={isLoading}
          title="Cancel stop after current"
          aria-label="Cancel stop after current"
        >
          <IconX size={14} stroke={1.5} />
        </Button>
      : <Button
          variant="outline"
          size="icon-xs"
          onClick={handleStopAfterCurrent}
          disabled={!canStopAfterCurrent || isLoading}
          title="Stop after current"
          aria-label="Stop after current"
        >
          <IconPlayerStopFilled size={14} stroke={1.5} />
        </Button>
      }

      {/* Error display */}
      {error && <span className="text-red-500 text-xs">{error}</span>}
    </div>
  )
}
