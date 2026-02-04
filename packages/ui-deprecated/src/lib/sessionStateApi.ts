/**
 * Client-side API for session state management.
 * Used for saving and restoring session context across page reloads and reconnections.
 */

import { useAppStore } from "../store"

/** Saved session state from the server */
export interface SessionState {
  instanceId: string
  status: string
  currentTaskId: string | null
  savedAt: number
  conversationContext: {
    messages: Array<{ role: string; content: unknown }>
    sessionId?: string
  }
}

/** Response from GET /api/ralph/:instanceId/session-state */
interface GetSessionStateResponse {
  ok: boolean
  state?: SessionState
  error?: string
}

/** Response from POST /api/ralph/:instanceId/restore-state */
interface RestoreStateResponse {
  ok: boolean
  restored?: {
    instanceId: string
    status: string
    currentTaskId: string | null
    savedAt: number
    messageCount: number
  }
  error?: string
}

/** Response from DELETE /api/ralph/:instanceId/session-state */
interface DeleteSessionStateResponse {
  ok: boolean
  error?: string
}

/** Maximum age (in milliseconds) for a saved state to be considered recent */
const MAX_STATE_AGE_MS = 60 * 60 * 1000 // 1 hour

/**
 * Fetch saved session state for an instance.
 * Returns null if no state exists or it's too old.
 */
export async function getSessionState(instanceId: string): Promise<SessionState | null> {
  try {
    const response = await fetch(`/api/ralph/${encodeURIComponent(instanceId)}/session-state`)

    if (response.status === 404) {
      // No saved state - this is normal
      return null
    }

    if (!response.ok) {
      console.warn(`[sessionStateApi] Failed to fetch session state: ${response.status}`)
      return null
    }

    const data: GetSessionStateResponse = await response.json()

    if (!data.ok || !data.state) {
      return null
    }

    // Check if the state is recent enough to be useful
    const stateAge = Date.now() - data.state.savedAt
    if (stateAge > MAX_STATE_AGE_MS) {
      console.log(
        `[sessionStateApi] Saved state is too old (${Math.round(stateAge / 1000 / 60)} minutes), ignoring`,
      )
      return null
    }

    return data.state
  } catch (err) {
    console.error("[sessionStateApi] Error fetching session state:", err)
    return null
  }
}

/**
 * Restore session state on the server (updates current task tracking etc.)
 * This is called automatically on reconnection to resume the previous session.
 */
export async function restoreSessionState(
  instanceId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/ralph/${encodeURIComponent(instanceId)}/restore-state`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })

    const data: RestoreStateResponse = await response.json()

    if (!data.ok) {
      return { ok: false, error: data.error ?? "Failed to restore state" }
    }

    console.log(
      `[sessionStateApi] Restored state for ${instanceId}: ${data.restored?.messageCount} messages`,
    )
    return { ok: true }
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error restoring state"
    console.error("[sessionStateApi] Error restoring state:", err)
    return { ok: false, error }
  }
}

/**
 * Delete saved session state.
 * This can be called to clear saved state when starting a new session.
 */
export async function deleteSessionState(
  instanceId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/ralph/${encodeURIComponent(instanceId)}/session-state`, {
      method: "DELETE",
    })

    if (response.status === 404) {
      // No state to delete - this is fine
      return { ok: true }
    }

    const data: DeleteSessionStateResponse = await response.json()

    if (!data.ok) {
      return { ok: false, error: data.error ?? "Failed to delete state" }
    }

    console.log(`[sessionStateApi] Deleted saved state for ${instanceId}`)
    return { ok: true }
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error deleting state"
    console.error("[sessionStateApi] Error deleting state:", err)
    return { ok: false, error }
  }
}

/**
 * Check if there's a recent saved session state that can be restored.
 * This is called on reconnection to determine whether to auto-resume.
 *
 * The function checks the active instance by default, but can check a specific instance.
 */
export async function checkForSavedSessionState(instanceId?: string): Promise<SessionState | null> {
  const targetInstanceId = instanceId ?? useAppStore.getState().activeInstanceId
  return getSessionState(targetInstanceId)
}
