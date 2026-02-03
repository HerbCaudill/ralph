import { useState, useCallback, useMemo } from "react"

/**
 * Control state for an agent loop.
 * - `idle`: No request in progress
 * - `running`: Actively processing a request
 * - `paused`: Loop is paused (can be resumed)
 */
export type ControlState = "idle" | "running" | "paused"

/** Options for the useAgentControl hook. */
export interface UseAgentControlOptions {
  /** Whether the agent is currently streaming (processing a request). */
  isStreaming?: boolean
  /** Initial control state. */
  initialState?: ControlState
  /** Called when pause is requested. */
  onPause?: () => void
  /** Called when resume is requested. */
  onResume?: () => void
  /** Called when stop/cancel is requested. */
  onStop?: () => void
  /** Called when new session is requested. */
  onNewSession?: () => void
}

/** Return value from useAgentControl. */
export interface UseAgentControlReturn {
  /** Current control state. */
  state: ControlState
  /** Whether a request is currently being processed. */
  isProcessing: boolean
  /** Whether the loop is paused. */
  isPaused: boolean
  /** Whether controls should be disabled (e.g., during state transitions). */
  isDisabled: boolean
  /** Pause the current operation. */
  pause: () => void
  /** Resume a paused operation. */
  resume: () => void
  /** Stop/cancel the current operation. */
  stop: () => void
  /** Request a new session. */
  newSession: () => void
}

/**
 * Hook that manages agent loop control state.
 * Tracks running/paused/idle states and provides control actions.
 *
 * This hook can be used standalone or integrated with useAgentChat
 * by passing the `isStreaming` flag from useAgentChat.
 */
export function useAgentControl(options: UseAgentControlOptions = {}): UseAgentControlReturn {
  const {
    isStreaming = false,
    initialState = "idle",
    onPause,
    onResume,
    onStop,
    onNewSession,
  } = options

  const [isPaused, setIsPaused] = useState(initialState === "paused")

  /** Derive control state from isStreaming and isPaused. */
  const state = useMemo<ControlState>(() => {
    if (isPaused) return "paused"
    if (isStreaming) return "running"
    return "idle"
  }, [isStreaming, isPaused])

  const isProcessing = state === "running"
  const isDisabled = false // Could be used for transition states

  const pause = useCallback(() => {
    setIsPaused(true)
    onPause?.()
  }, [onPause])

  const resume = useCallback(() => {
    setIsPaused(false)
    onResume?.()
  }, [onResume])

  const stop = useCallback(() => {
    setIsPaused(false)
    onStop?.()
  }, [onStop])

  const newSession = useCallback(() => {
    setIsPaused(false)
    onNewSession?.()
  }, [onNewSession])

  return {
    state,
    isProcessing,
    isPaused,
    isDisabled,
    pause,
    resume,
    stop,
    newSession,
  }
}
