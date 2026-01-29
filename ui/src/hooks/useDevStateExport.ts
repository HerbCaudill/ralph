/**
 * Hook that exports server-side state to .ralph/state.latest.json on session transitions.
 *
 * In dev mode, triggers a POST to /api/state/export whenever a new session starts
 * or a session ends. The server writes its current state (instance registry) to
 * .ralph/state.latest.json for debugging purposes.
 *
 * The server endpoint returns 403 if not in dev mode, so this hook is safe to
 * call in any environment — it will silently no-op in production.
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
 * as `useSessionPersistence`. When a new session boundary is detected (or the
 * event count changes significantly after a boundary), it fires the export.
 */
export function useDevStateExport(options: UseDevStateExportOptions): void {
  const { events, enabled = true } = options

  // Track the last session boundary count and event count we exported for
  const lastExportRef = useRef<{
    boundaryCount: number
    exported: boolean
  }>({ boundaryCount: 0, exported: false })

  useEffect(() => {
    if (!enabled) return

    const boundaries = getSessionBoundaries(events)
    if (boundaries.length === 0) return

    const currentBoundaryCount = boundaries.length
    const last = lastExportRef.current

    // Export when a new session boundary appears (session start)
    if (currentBoundaryCount !== last.boundaryCount) {
      lastExportRef.current = { boundaryCount: currentBoundaryCount, exported: true }
      postStateExport()
    }
  }, [enabled, events])
}

/**
 * Fire-and-forget POST to the server state export endpoint.
 * Logs success/failure but does not throw.
 */
function postStateExport(): void {
  fetch("/api/state/export", { method: "POST" })
    .then(async res => {
      if (res.ok) {
        const data = (await res.json()) as { ok: boolean; savedAt?: number }
        console.debug(
          `[useDevStateExport] State exported to .ralph/state.latest.json (savedAt: ${data.savedAt})`,
        )
      } else if (res.status === 403) {
        // Not in dev mode — expected, silently ignore
        console.debug("[useDevStateExport] Skipped: not in dev mode")
      } else {
        const data = (await res.json()) as { error?: string }
        console.warn(`[useDevStateExport] Export failed: ${data.error ?? res.statusText}`)
      }
    })
    .catch(err => {
      console.warn("[useDevStateExport] Export request failed:", err)
    })
}
