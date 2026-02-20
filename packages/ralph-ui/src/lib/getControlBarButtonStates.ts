import type { ControlState } from "@herbcaudill/agent-view"

/**
 * Extended control state for the Ralph loop.
 * Includes transitional states and stop-after-current functionality.
 */
export type RalphStatus =
  | "stopped"
  | "starting"
  | "running"
  | "pausing"
  | "paused"
  | "stopping"
  | "stopping_after_current"

/** Button states for the control bar. */
interface ControlBarButtonStates {
  start: boolean
  pause: boolean
  stop: boolean
  stopAfterCurrent: boolean
}

/**
 * Maps the simple ControlState to the extended RalphStatus.
 * Since the current architecture doesn't have all the transitional states,
 * we map the basic states and can be extended later.
 */
export function controlStateToRalphStatus(
  controlState: ControlState,
  isStoppingAfterCurrent: boolean = false,
): RalphStatus {
  if (isStoppingAfterCurrent) return "stopping_after_current"

  switch (controlState) {
    case "idle":
      return "stopped"
    case "running":
      return "running"
    case "paused":
      return "paused"
    default:
      return "stopped"
  }
}

/**
 * Returns which buttons should be enabled based on Ralph status and connection state.
 */
export function getControlBarButtonStates(
  status: RalphStatus,
  isConnected: boolean,
): ControlBarButtonStates {
  if (!isConnected) {
    return {
      start: false,
      pause: false,
      stop: false,
      stopAfterCurrent: false,
    }
  }

  switch (status) {
    case "stopped":
      return {
        start: true,
        pause: false,
        stop: false,
        stopAfterCurrent: false,
      }
    case "starting":
      return {
        start: false,
        pause: false,
        stop: false,
        stopAfterCurrent: false,
      }
    case "running":
      return {
        start: false,
        pause: true,
        stop: true,
        stopAfterCurrent: true,
      }
    case "pausing":
      return {
        start: false,
        pause: false,
        stop: true,
        stopAfterCurrent: true,
      }
    case "paused":
      return {
        start: false,
        pause: true,
        stop: true,
        stopAfterCurrent: true,
      }
    case "stopping":
      return {
        start: false,
        pause: false,
        stop: false,
        stopAfterCurrent: false,
      }
    case "stopping_after_current":
      return {
        start: false,
        pause: false,
        stop: true,
        stopAfterCurrent: true,
      }
    default:
      return {
        start: false,
        pause: false,
        stop: false,
        stopAfterCurrent: false,
      }
  }
}
