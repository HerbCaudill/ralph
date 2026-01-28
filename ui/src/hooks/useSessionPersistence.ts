/**
 * Hook for persisting session metadata to IndexedDB.
 *
 * Auto-saves session metadata at:
 * - Session boundary (ralph_session_start event) - saves previous session as complete
 * - Session end (ralph_task_completed or COMPLETE signal)
 *
 * Note: This hook only persists session metadata (v3+ schema). Events are
 * persisted separately in ralphConnection.ts as they arrive.
 *
 * Session IDs are preferably extracted from the server-generated sessionId in
 * ralph_session_start events, ensuring stable UUIDs for reliable storage.
 */

import { useEffect, useRef, useCallback, useState } from "react"
import { eventDatabase } from "@/lib/persistence"
import type { PersistedSession } from "@/lib/persistence"
import type { ChatEvent, TokenUsage, ContextWindow, SessionInfo } from "@/types"
import { getSessionBoundaries, getTaskFromSessionEvents } from "@/store"
import { setCurrentSessionId as setRalphConnectionSessionId } from "@/lib/ralphConnection"

/**
 * Extracts the session ID from a session boundary event.
 *
 * Prefers the server-generated sessionId field (added in ralph_session_start events).
 * Falls back to generating a deterministic ID from instanceId + timestamp for
 * backward compatibility with events that don't have a sessionId.
 */
function getSessionIdFromEvent(
  event: ChatEvent,
  instanceId: string,
): { sessionId: string; startedAt: number } {
  const startedAt = event.timestamp || Date.now()

  // Prefer server-generated sessionId if available (from ralph_session_start events)
  const serverSessionId = (event as { sessionId?: string }).sessionId
  if (serverSessionId && typeof serverSessionId === "string") {
    return { sessionId: serverSessionId, startedAt }
  }

  // Fall back to generating a deterministic ID for backward compatibility
  // Format: "{instanceId}-{timestamp}"
  return { sessionId: `${instanceId}-${startedAt}`, startedAt }
}

/**
 * Checks if an event signals session completion.
 * Returns true for ralph_task_completed events or COMPLETE promise signals.
 */
function isSessionEndEvent(event: ChatEvent): boolean {
  // ralph_task_completed event
  if (event.type === "ralph_task_completed") {
    return true
  }

  // COMPLETE promise signal in assistant text
  if (event.type === "assistant") {
    const content = (event as any).message?.content
    if (Array.isArray(content)) {
      for (const block of content) {
        if (
          block.type === "text" &&
          typeof block.text === "string" &&
          block.text.includes("<promise>COMPLETE</promise>")
        ) {
          return true
        }
      }
    }
  }

  return false
}

/**
 * Checks if a session ended with the COMPLETE signal (no work available).
 * This is distinct from ralph_task_completed which means work was done.
 */
function sessionEndedWithComplete(events: ChatEvent[]): boolean {
  // Look for COMPLETE promise signal in the last few events
  // (checking last 3 events should be sufficient)
  const lastEvents = events.slice(-3)
  for (const event of lastEvents) {
    if (event.type === "assistant") {
      const content = (event as any).message?.content
      if (Array.isArray(content)) {
        for (const block of content) {
          if (
            block.type === "text" &&
            typeof block.text === "string" &&
            block.text.includes("<promise>COMPLETE</promise>")
          ) {
            return true
          }
        }
      }
    }
  }
  return false
}

/**
 * Determines if a session should be filtered out (not persisted).
 * Sessions are filtered if they:
 * 1. End with COMPLETE signal (no work available) AND have no task, OR
 * 2. Have very few events (< 3) - likely startup/shutdown cycles
 */
function shouldFilterSession(events: ChatEvent[]): boolean {
  // Filter sessions with very few events (startup/shutdown cycles)
  if (events.length < 3) {
    return true
  }

  // Filter sessions that ended with COMPLETE signal and have no task
  const taskId = getTaskFromSessionEvents(events)

  if (sessionEndedWithComplete(events) && !taskId) {
    return true
  }

  return false
}

/**  Extracts the events for a specific session from the full events array. */
function getEventsForSessionIndex(events: ChatEvent[], sessionIndex: number): ChatEvent[] {
  const boundaries = getSessionBoundaries(events)
  if (boundaries.length === 0 || sessionIndex < 0 || sessionIndex >= boundaries.length) {
    return []
  }

  const startIndex = boundaries[sessionIndex]
  const endIndex = boundaries[sessionIndex + 1] ?? events.length
  return events.slice(startIndex, endIndex)
}

export interface UseSessionPersistenceOptions {
  /** ID of the Ralph instance */
  instanceId: string
  /** All events from the instance */
  events: ChatEvent[]
  /** Current token usage */
  tokenUsage: TokenUsage
  /** Current context window */
  contextWindow: ContextWindow
  /** Current session info */
  session: SessionInfo
  /** ID of the workspace (for cross-workspace queries) */
  workspaceId?: string | null
  /** Whether persistence is enabled (default: true) */
  enabled?: boolean
}

export interface UseSessionPersistenceResult {
  /** Manually save the current session */
  saveCurrentSession: () => Promise<void>
  /** Get the current session ID (null if no session started) */
  currentSessionId: string | null
}

/**
 * Hook to persist sessions to IndexedDB.
 *
 * Automatically saves sessions when:
 * 1. A new session starts (system init event detected)
 * 2. An session ends (ralph_task_completed or COMPLETE signal)
 *
 * The hook tracks the current session and maintains a stable ID for it.
 */
export function useSessionPersistence(
  options: UseSessionPersistenceOptions,
): UseSessionPersistenceResult {
  const {
    instanceId,
    events,
    tokenUsage,
    contextWindow,
    session,
    workspaceId = null,
    enabled = true,
  } = options

  // Track current session ID in state (for reactivity)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)

  // Track the current session state in ref (for effect processing)
  const currentSessionRef = useRef<{
    id: string
    startedAt: number
    sessionIndex: number
    eventCount: number
    saved: boolean
  } | null>(null)

  // Track last processed event count to detect new events
  const lastProcessedEventCountRef = useRef(0)

  /**
   * Build a PersistedSession from the current state.
   * Note: Events are persisted separately in ralphConnection.ts in v3+ schema.
   */
  const buildSessionData = useCallback(
    (
      sessionId: string,
      startedAt: number,
      sessionEvents: ChatEvent[],
      completed: boolean,
    ): PersistedSession => {
      const taskId = getTaskFromSessionEvents(sessionEvents)

      // Find the last event sequence number (using event index as proxy since we don't have server sequence numbers yet)
      const lastEventSequence = sessionEvents.length - 1

      return {
        id: sessionId,
        instanceId,
        workspaceId,
        startedAt,
        completedAt: completed ? Date.now() : null,
        taskId,
        tokenUsage,
        contextWindow,
        session,
        eventCount: sessionEvents.length,
        lastEventSequence,
        // Note: events are NOT included here - they're stored separately in v3+ schema
      }
    },
    [instanceId, workspaceId, tokenUsage, contextWindow, session],
  )

  /**
   * Save an session to IndexedDB.
   */
  const saveSession = useCallback(async (sessionData: PersistedSession): Promise<void> => {
    try {
      await eventDatabase.saveSession(sessionData)
    } catch (error) {
      console.error("[useSessionPersistence] Failed to save session:", error)
    }
  }, [])

  /**
   * Manually save the current session.
   */
  const saveCurrentSession = useCallback(async (): Promise<void> => {
    if (!enabled) return

    const current = currentSessionRef.current
    if (!current) return

    const sessionEvents = getEventsForSessionIndex(events, current.sessionIndex)
    if (sessionEvents.length === 0) return

    const sessionData = buildSessionData(
      current.id,
      current.startedAt,
      sessionEvents,
      false, // Not marking as complete on manual save
    )

    await saveSession(sessionData)
    currentSessionRef.current = { ...current, saved: true, eventCount: sessionEvents.length }
  }, [enabled, events, buildSessionData, saveSession])

  /**
   * Process events and detect session boundaries.
   */
  useEffect(() => {
    console.debug(
      `[useSessionPersistence] Effect running: enabled=${enabled}, events.length=${events.length}, lastProcessed=${lastProcessedEventCountRef.current}`,
    )

    if (!enabled) {
      console.debug("[useSessionPersistence] Skipping: disabled")
      return
    }

    // Only process if we have new events
    if (events.length <= lastProcessedEventCountRef.current) {
      console.debug(
        `[useSessionPersistence] No new events: events.length=${events.length}, lastProcessed=${lastProcessedEventCountRef.current}`,
      )
      return
    }

    const boundaries = getSessionBoundaries(events)
    console.debug(
      `[useSessionPersistence] Found ${boundaries.length} boundaries in ${events.length} events`,
    )

    // Check for new session start
    if (boundaries.length > 0) {
      const latestBoundaryIndex = boundaries.length - 1
      const latestBoundaryEventIndex = boundaries[latestBoundaryIndex]
      const boundaryEvent = events[latestBoundaryEventIndex]
      console.debug(
        `[useSessionPersistence] Latest boundary at index ${latestBoundaryEventIndex}, event:`,
        boundaryEvent.type,
        (boundaryEvent as any).subtype,
      )

      // New session started if we don't have a current one, or the boundary changed
      if (
        !currentSessionRef.current ||
        currentSessionRef.current.sessionIndex !== latestBoundaryIndex
      ) {
        console.debug(
          `[useSessionPersistence] Creating new session: currentRef=${currentSessionRef.current?.id ?? "null"}`,
        )
        // Handle previous session if it exists
        if (currentSessionRef.current) {
          const prevEvents = getEventsForSessionIndex(
            events,
            currentSessionRef.current.sessionIndex,
          )
          if (prevEvents.length > 0) {
            // Check if the previous session should be filtered (empty/no-task sessions)
            if (shouldFilterSession(prevEvents)) {
              // Delete the empty session instead of saving it
              console.debug(
                `[useSessionPersistence] Filtering empty session: ${currentSessionRef.current.id}`,
              )
              eventDatabase.deleteSession(currentSessionRef.current.id).catch(error => {
                console.error("[useSessionPersistence] Failed to delete empty session:", error)
              })
            } else {
              const prevData = buildSessionData(
                currentSessionRef.current.id,
                currentSessionRef.current.startedAt,
                prevEvents,
                true, // Mark as complete since a new session started
              )
              saveSession(prevData)
            }
          }
        }

        // Start tracking new session
        // Extract session ID from the boundary event (prefers server-generated ID)
        const { sessionId: newId, startedAt } = getSessionIdFromEvent(boundaryEvent, instanceId)

        currentSessionRef.current = {
          id: newId,
          startedAt,
          sessionIndex: latestBoundaryIndex,
          eventCount: 0,
          saved: false,
        }
        console.debug(`[useSessionPersistence] Setting currentSessionId to: ${newId}`)
        setCurrentSessionId(newId)

        // Sync session ID to ralphConnection singleton so it uses the same ID for IndexedDB persistence
        // This ensures both systems (hook and singleton) use the same session ID, avoiding event/session mismatches
        setRalphConnectionSessionId(instanceId, newId)

        // Save the new session immediately so it appears in the session history dropdown
        // This ensures sessions are visible even before they complete
        const newSessionEvents = getEventsForSessionIndex(events, latestBoundaryIndex)
        if (newSessionEvents.length > 0) {
          const newSessionData = buildSessionData(newId, startedAt, newSessionEvents, false)
          saveSession(newSessionData)
          currentSessionRef.current = {
            ...currentSessionRef.current,
            saved: true,
            eventCount: newSessionEvents.length,
          }
        }
      }
    }

    // Check for session end signals in new events
    const newEvents = events.slice(lastProcessedEventCountRef.current)
    for (const event of newEvents) {
      if (isSessionEndEvent(event) && currentSessionRef.current) {
        const current = currentSessionRef.current
        const sessionEvents = getEventsForSessionIndex(events, current.sessionIndex)

        if (sessionEvents.length > 0) {
          // Check if this session should be filtered (empty/no-task sessions)
          if (shouldFilterSession(sessionEvents)) {
            // Delete the empty session instead of saving it
            console.debug(`[useSessionPersistence] Filtering empty session on end: ${current.id}`)
            eventDatabase.deleteSession(current.id).catch(error => {
              console.error("[useSessionPersistence] Failed to delete empty session:", error)
            })
          } else {
            const sessionData = buildSessionData(current.id, current.startedAt, sessionEvents, true)
            saveSession(sessionData)
          }
          currentSessionRef.current = {
            ...current,
            saved: true,
            eventCount: sessionEvents.length,
          }
        }
        break // Only process one completion per effect run
      }
    }

    // Note: Periodic saves removed in v3 schema - events are now persisted separately
    // in ralphConnection.ts as they arrive. Session metadata is only saved on
    // session boundaries and completion.

    lastProcessedEventCountRef.current = events.length
  }, [enabled, events, instanceId, buildSessionData, saveSession])

  // Initialize database on mount
  useEffect(() => {
    if (!enabled) return
    eventDatabase.init().catch(error => {
      console.error("[useSessionPersistence] Failed to initialize database:", error)
    })
  }, [enabled])

  return {
    saveCurrentSession,
    currentSessionId,
  }
}
