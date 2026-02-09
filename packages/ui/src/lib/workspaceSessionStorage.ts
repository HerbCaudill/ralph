import type { ControlState } from "@herbcaudill/agent-view"

/** localStorage key prefix for workspace session IDs. */
const STORAGE_KEY_PREFIX = "ralph-workspace-session:"

/** localStorage key prefix for workspace control state. */
const STATE_KEY_PREFIX = "ralph-workspace-state:"

/** Build the localStorage key for a workspace's session ID. */
export function getSessionStorageKey(
  /** Workspace identifier in `owner/repo` format. */
  workspaceId: string,
): string {
  return `${STORAGE_KEY_PREFIX}${workspaceId}`
}

/** Build the localStorage key for a workspace's control state. */
export function getStateStorageKey(
  /** Workspace identifier in `owner/repo` format. */
  workspaceId: string,
): string {
  return `${STATE_KEY_PREFIX}${workspaceId}`
}

/** Save the most recent session ID for a workspace to localStorage. */
export function saveWorkspaceSession(
  /** Workspace identifier in `owner/repo` format. */
  workspaceId: string,
  /** The session ID to persist. */
  sessionId: string,
): void {
  try {
    localStorage.setItem(getSessionStorageKey(workspaceId), sessionId)
  } catch {
    // localStorage may be unavailable (e.g., in SharedWorker)
  }
}

/** Load the most recent session ID for a workspace from localStorage. */
export function loadWorkspaceSession(
  /** Workspace identifier in `owner/repo` format. */
  workspaceId: string,
): string | null {
  try {
    return localStorage.getItem(getSessionStorageKey(workspaceId))
  } catch {
    // localStorage may be unavailable (e.g., in SharedWorker)
    return null
  }
}

/** Clear the stored session ID for a workspace. */
export function clearWorkspaceSession(
  /** Workspace identifier in `owner/repo` format. */
  workspaceId: string,
): void {
  try {
    localStorage.removeItem(getSessionStorageKey(workspaceId))
  } catch {
    // localStorage may be unavailable
  }
}

/** Save the control state for a workspace to localStorage. */
export function saveWorkspaceState(
  /** Workspace identifier in `owner/repo` format. */
  workspaceId: string,
  /** The control state to persist. */
  state: ControlState,
): void {
  try {
    // Only persist non-idle states; clear on idle to avoid stale state
    if (state === "idle") {
      localStorage.removeItem(getStateStorageKey(workspaceId))
    } else {
      localStorage.setItem(getStateStorageKey(workspaceId), state)
    }
  } catch {
    // localStorage may be unavailable (e.g., in SharedWorker)
  }
}

/** Load the control state for a workspace from localStorage. */
export function loadWorkspaceState(
  /** Workspace identifier in `owner/repo` format. */
  workspaceId: string,
): "running" | "paused" | null {
  try {
    const state = localStorage.getItem(getStateStorageKey(workspaceId))
    if (state === "running" || state === "paused") {
      return state
    }
    return null
  } catch {
    // localStorage may be unavailable (e.g., in SharedWorker)
    return null
  }
}

/** Clear the stored control state for a workspace. */
export function clearWorkspaceState(
  /** Workspace identifier in `owner/repo` format. */
  workspaceId: string,
): void {
  try {
    localStorage.removeItem(getStateStorageKey(workspaceId))
  } catch {
    // localStorage may be unavailable
  }
}
