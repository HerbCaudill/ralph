import { IconPlayerPause, IconPlayerPlay, IconPlayerStop, IconPlus } from "@tabler/icons-react"
import { Button } from "@herbcaudill/components"
import { cx } from "../lib/utils"
import type { ControlState } from "../hooks/useAgentControl"

/** Maps the AgentControls size prop to Button component icon sizes. */
const BUTTON_SIZE_MAP = {
  sm: "icon-xs",
  md: "icon-sm",
  lg: "icon",
} as const

/** Maps the AgentControls size prop to Tabler icon pixel sizes. */
const ICON_SIZE_MAP = {
  sm: 14,
  md: 16,
  lg: 18,
} as const

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
  const buttonSize = BUTTON_SIZE_MAP[size]
  const iconSize = ICON_SIZE_MAP[size]

  return (
    <div className={cx("flex items-center gap-1", className)}>
      {/* New session button */}
      {showNewSession && (
        <Button
          variant="ghost"
          size={buttonSize}
          onClick={onNewSession}
          disabled={disabled || isRunning}
          title="New session"
        >
          <IconPlus size={iconSize} stroke={1.5} />
        </Button>
      )}

      {/* Pause/Resume button */}
      {showPauseResume && (
        <>
          {isPaused ?
            <Button
              variant="ghost"
              size={buttonSize}
              onClick={onResume}
              disabled={disabled}
              title="Resume"
              className="text-green-600"
            >
              <IconPlayerPlay size={iconSize} stroke={1.5} />
            </Button>
          : <Button
              variant="ghost"
              size={buttonSize}
              onClick={onPause}
              disabled={disabled || isIdle}
              title="Pause"
            >
              <IconPlayerPause size={iconSize} stroke={1.5} />
            </Button>
          }
        </>
      )}

      {/* Stop button */}
      {showStop && (
        <Button
          variant="ghost"
          size={buttonSize}
          onClick={onStop}
          disabled={disabled || isIdle}
          title="Stop"
          className="hover:text-red-600"
        >
          <IconPlayerStop size={iconSize} stroke={1.5} />
        </Button>
      )}
    </div>
  )
}

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
