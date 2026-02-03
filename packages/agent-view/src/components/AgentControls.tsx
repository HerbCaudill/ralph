import { IconPlayerPause, IconPlayerPlay, IconPlayerStop, IconPlus } from "@tabler/icons-react"
import { cx } from "../lib/utils"
import type { ControlState } from "../hooks/useAgentControl"

/** Props for the AgentControls component. */
export interface AgentControlsProps {
  /** Current control state. */
  state: ControlState
  /** Whether controls should be disabled. */
  disabled?: boolean
  /** Called when pause button is clicked. */
  onPause?: () => void
  /** Called when resume button is clicked. */
  onResume?: () => void
  /** Called when stop button is clicked. */
  onStop?: () => void
  /** Called when new session button is clicked. */
  onNewSession?: () => void
  /** Whether to show the new session button. */
  showNewSession?: boolean
  /** Whether to show the pause/resume button. */
  showPauseResume?: boolean
  /** Whether to show the stop button. */
  showStop?: boolean
  /** Additional CSS classes for the container. */
  className?: string
  /** Button size (icon size in pixels). */
  size?: "sm" | "md" | "lg"
}

const SIZES = {
  sm: { icon: 14, padding: "p-1" },
  md: { icon: 16, padding: "p-1.5" },
  lg: { icon: 18, padding: "p-2" },
}

/**
 * Control buttons for managing an agent loop.
 * Shows play/pause, stop, and new session buttons based on current state.
 */
export function AgentControls({
  state,
  disabled = false,
  onPause,
  onResume,
  onStop,
  onNewSession,
  showNewSession = true,
  showPauseResume = true,
  showStop = true,
  className,
  size = "md",
}: AgentControlsProps) {
  const isRunning = state === "running"
  const isPaused = state === "paused"
  const isIdle = state === "idle"
  const { icon: iconSize, padding } = SIZES[size]

  const buttonBase = cx(
    "flex items-center justify-center rounded-md border border-border transition-colors",
    "hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed",
    padding,
  )

  return (
    <div className={cx("flex items-center gap-1", className)}>
      {/* New session button */}
      {showNewSession && (
        <button
          onClick={onNewSession}
          disabled={disabled || isRunning}
          title="New session"
          className={buttonBase}
        >
          <IconPlus size={iconSize} stroke={1.5} />
        </button>
      )}

      {/* Pause/Resume button */}
      {showPauseResume && (
        <>
          {isPaused ?
            <button
              onClick={onResume}
              disabled={disabled}
              title="Resume"
              className={cx(buttonBase, "text-green-600")}
            >
              <IconPlayerPlay size={iconSize} stroke={1.5} />
            </button>
          : <button
              onClick={onPause}
              disabled={disabled || isIdle}
              title="Pause"
              className={buttonBase}
            >
              <IconPlayerPause size={iconSize} stroke={1.5} />
            </button>
          }
        </>
      )}

      {/* Stop button */}
      {showStop && (
        <button
          onClick={onStop}
          disabled={disabled || isIdle}
          title="Stop"
          className={cx(buttonBase, "hover:text-red-600")}
        >
          <IconPlayerStop size={iconSize} stroke={1.5} />
        </button>
      )}
    </div>
  )
}
