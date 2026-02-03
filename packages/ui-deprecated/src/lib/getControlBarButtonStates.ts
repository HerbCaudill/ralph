import type { RalphStatus } from "@/types"

export function getControlBarButtonStates(status: RalphStatus, isConnected: boolean) {
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
