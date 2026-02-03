/**
 * Hook that exports server-side state to .ralph/state.latest.json on session transitions.
 *
 * In dev mode, triggers a POST to /api/state/export whenever a new session starts
 * or a session ends. The server writes its current state (instance registry) to
 * .ralph/state.latest.json for debugging purposes.
 *
 * The server endpoint returns 403 if not in dev mode, so this hook is safe to
 * call in any environment — it will silently no-op in production.
 *
 * Includes retry logic: if the export fails (e.g., server not ready during startup),
 * subsequent effect runs will re-attempt the export until it succeeds.
 */

import { useEffect, useRef } from "react"
import type { ChatEvent } from "@/types"
import { getSessionBoundaries } from "@/store"

export interface UseDevStateExportOptions {
  /** All events from the active instance */
  events: ChatEvent[]
  /** Whether the hook is enabled (default: true) */
  enabled?: boolean
}

/**
 * Triggers a POST to /api/state/export on session transitions.
 *
 * Detects session boundaries using the same `getSessionBoundaries()` utility
 * as `useSessionPersistence`. When a new session boundary is detected (or a
 * previous export attempt failed), it fires the export.
 */
export function useDevStateExport(options: UseDevStateExportOptions): void {
  const { events, enabled = true } = options

  // Track the last successfully exported boundary count.
  // `succeeded` is false until the POST returns a successful response,
  // so the hook will retry on subsequent renders if the export fails.
  // `inFlight` prevents duplicate concurrent requests.
  const lastExportRef = useRef<{
    boundaryCount: number
    succeeded: boolean
    inFlight: boolean
  }>({ boundaryCount: 0, succeeded: false, inFlight: false })

  // Track the retry timer so we can clean it up
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled) return

    const boundaries = getSessionBoundaries(events)
    if (boundaries.length === 0) return

    const currentBoundaryCount = boundaries.length
    const last = lastExportRef.current

    // Export when:
    // 1. A new session boundary appears, OR
    // 2. A previous export for the current boundary count failed (and no request in flight)
    const needsExport =
      currentBoundaryCount !== last.boundaryCount ||
      (currentBoundaryCount > 0 && !last.succeeded && !last.inFlight)

    if (needsExport) {
      // Update boundary count immediately and mark as in-flight to avoid
      // duplicate concurrent requests.
      lastExportRef.current = {
        boundaryCount: currentBoundaryCount,
        succeeded: false,
        inFlight: true,
      }

      // Clear any pending retry timer
      if (retryTimerRef.current !== null) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }

      postStateExport(
        () => {
          // On success: mark as succeeded so we don't retry
          lastExportRef.current = {
            boundaryCount: currentBoundaryCount,
            succeeded: true,
            inFlight: false,
          }
        },
        () => {
          // On failure: clear inFlight and schedule a retry after a short delay.
          // The retry re-invokes postStateExport rather than waiting for a React
          // re-render, which may not happen if the events array is stable.
          lastExportRef.current = {
            boundaryCount: currentBoundaryCount,
            succeeded: false,
            inFlight: false,
          }
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null
            lastExportRef.current = {
              boundaryCount: currentBoundaryCount,
              succeeded: false,
              inFlight: true,
            }
            postStateExport(
              () => {
                lastExportRef.current = {
                  boundaryCount: currentBoundaryCount,
                  succeeded: true,
                  inFlight: false,
                }
              },
              () => {
                // Still failed after retry — leave succeeded=false so the next
                // effect run (e.g., when events change) will try again.
                lastExportRef.current = {
                  boundaryCount: currentBoundaryCount,
                  succeeded: false,
                  inFlight: false,
                }
                console.debug(
                  "[useDevStateExport] Retry failed, will try again on next event change",
                )
              },
            )
          }, 3000)
        },
      )
    }

    return () => {
      // Cleanup retry timer on unmount or before next effect run
      if (retryTimerRef.current !== null) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
    }
  }, [enabled, events])
}

/**
 * POST to the server state export endpoint with success/failure callbacks.
 * Logs the result but does not throw.
 */
function postStateExport(onSuccess: () => void, onFailure: () => void): void {
  fetch("/api/state/export", { method: "POST" })
    .then(async res => {
      if (res.ok) {
        const data = (await res.json()) as { ok: boolean; savedAt?: number }
        console.debug(
          `[useDevStateExport] State exported to .ralph/state.latest.json (savedAt: ${data.savedAt})`,
        )
        onSuccess()
      } else if (res.status === 403) {
        // Not in dev mode — expected, silently ignore.
        // Treat as "success" so we don't keep retrying against a prod server.
        console.debug("[useDevStateExport] Skipped: not in dev mode")
        onSuccess()
      } else {
        const data = (await res.json()) as { error?: string }
        console.warn(`[useDevStateExport] Export failed: ${data.error ?? res.statusText}`)
        onFailure()
      }
    })
    .catch(err => {
      console.warn("[useDevStateExport] Export request failed:", err)
      onFailure()
    })
}
