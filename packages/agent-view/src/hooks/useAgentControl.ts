import { useState, useCallback, useMemo } from "react"

/**
 * Control state for an agent loop.
 * - `idle`: No request in progress
 * - `running`: Actively processing a request
 */
export type ControlState = "idle" | "running"

/** Options for the useAgentControl hook. */
export interface UseAgentControlOptions {
  /** Whether the agent is currently streaming (processing a request). */
  isStreaming?: boolean
  /** Initial control state. */
  initialState?: ControlState
  /** Called when pause/interrupt is requested. */
  onPause?: () => void
  /** Called when new session is requested. */
  onNewSession?: () => void
}

/** Return value from useAgentControl. */
export interface UseAgentControlReturn {
  /** Current control state. */
  state: ControlState
  /** Whether a request is currently being processed. */
  isProcessing: boolean
  /** Whether controls should be disabled (e.g., during state transitions). */
  isDisabled: boolean
  /** Pause/interrupt the current operation. */
  pause: () => void
  /** Request a new session. */
  newSession: () => void
}

/**
 * Hook that manages agent loop control state.
 * Tracks running/idle states and provides control actions.
 *
 * This hook can be used standalone or integrated with useAgentChat
 * by passing the `isStreaming` flag from useAgentChat.
 */
export function useAgentControl(options: UseAgentControlOptions = {}): UseAgentControlReturn {
  const { isStreaming = false, onPause, onNewSession } = options

  /** Derive control state from isStreaming. */
  const state = useMemo<ControlState>(() => {
    return isStreaming ? "running" : "idle"
  }, [isStreaming])

  const isProcessing = state === "running"
  const isDisabled = false // Could be used for transition states

  const pause = useCallback(() => {
    onPause?.()
  }, [onPause])

  const newSession = useCallback(() => {
    onNewSession?.()
  }, [onNewSession])

  return {
    state,
    isProcessing,
    isDisabled,
    pause,
    newSession,
  }
}
