/**
 * Hook for persisting individual events to IndexedDB.
 *
 * Saves events to the events store for append-only writes. This is part of the
 * v3 schema normalization that separates events from sessions.
 *
 * Auto-saves events as they arrive:
 * - New events are detected by comparing against last saved count
 * - Events are saved individually for efficient append-only writes
 * - Batch saves are supported for reconnection scenarios
 */

import { useEffect, useRef, useCallback } from "react"
import { eventDatabase, type PersistedEvent } from "@/lib/persistence"
import type { ChatEvent } from "@/types"

/**
 * Generates a unique event ID based on session ID and event index.
 * Format: "{sessionId}-event-{index}"
 */
function generateEventId(sessionId: string, eventIndex: number): string {
  return `${sessionId}-event-${eventIndex}`
}

/**
 * Extracts the event type from a ChatEvent.
 * Falls back to "unknown" if type is not available.
 */
function getEventType(event: ChatEvent): string {
  return event.type ?? "unknown"
}

export interface UseEventPersistenceOptions {
  /** ID of the current session (null if no session started) */
  sessionId: string | null
  /** All events from the session */
  events: ChatEvent[]
  /** ID of the workspace (for cross-workspace queries) */
  workspaceId: string | null
  /** Whether persistence is enabled (default: true) */
  enabled?: boolean
}

export interface UseEventPersistenceResult {
  /** Manually save a batch of events (for reconnection scenarios) */
  saveEvents: (events: ChatEvent[], startIndex: number) => Promise<void>
  /** Number of events that have been persisted */
  persistedEventCount: number
}

/**
 * Hook to persist events to IndexedDB.
 *
 * Automatically saves events as they arrive when an session is active.
 * Events are saved individually to the events store for efficient append-only writes.
 *
 * This hook works alongside useSessionPersistence, which handles the session
 * metadata. Together they implement the v3 normalized schema.
 */
export function useEventPersistence(
  options: UseEventPersistenceOptions,
): UseEventPersistenceResult {
  const { sessionId, events, workspaceId: _workspaceId, enabled = true } = options
  // Note: workspaceId is reserved for future use in cross-workspace queries

  // Track the last saved event count to detect new events
  const lastSavedEventCountRef = useRef(0)
  // Track the current session ID to reset count when session changes
  const currentSessionIdRef = useRef<string | null>(null)

  /**
   * Build a PersistedEvent from a ChatEvent.
   */
  const buildPersistedEvent = useCallback(
    (event: ChatEvent, eventIndex: number, iterId: string): PersistedEvent => {
      return {
        id: generateEventId(iterId, eventIndex),
        sessionId: iterId,
        timestamp: event.timestamp ?? Date.now(),
        eventType: getEventType(event),
        event,
      }
    },
    [],
  )

  /**
   * Save a single event to IndexedDB.
   */
  const saveEvent = useCallback(
    async (event: ChatEvent, eventIndex: number, iterId: string): Promise<void> => {
      try {
        const persistedEvent = buildPersistedEvent(event, eventIndex, iterId)
        await eventDatabase.saveEvent(persistedEvent)
      } catch (error) {
        console.error("[useEventPersistence] Failed to save event:", error)
      }
    },
    [buildPersistedEvent],
  )

  /**
   * Save multiple events to IndexedDB in a batch.
   * Used for reconnection scenarios where multiple events need to be saved at once.
   */
  const saveEventsBatch = useCallback(
    async (eventsToSave: ChatEvent[], startIndex: number): Promise<void> => {
      if (!enabled || !sessionId || eventsToSave.length === 0) return

      try {
        const persistedEvents = eventsToSave.map((event, i) =>
          buildPersistedEvent(event, startIndex + i, sessionId),
        )
        await eventDatabase.saveEvents(persistedEvents)
      } catch (error) {
        console.error("[useEventPersistence] Failed to save events batch:", error)
      }
    },
    [enabled, sessionId, buildPersistedEvent],
  )

  /**
   * Process new events and save them to IndexedDB.
   */
  useEffect(() => {
    if (!enabled || !sessionId) return

    // Reset count if session changed
    if (currentSessionIdRef.current !== sessionId) {
      currentSessionIdRef.current = sessionId
      lastSavedEventCountRef.current = 0
    }

    // Only process if we have new events
    if (events.length <= lastSavedEventCountRef.current) return

    // Get the new events that need to be saved
    const newStartIndex = lastSavedEventCountRef.current
    const newEvents = events.slice(newStartIndex)

    // Save new events (async, fire and forget)
    const saveNewEvents = async () => {
      for (let i = 0; i < newEvents.length; i++) {
        const eventIndex = newStartIndex + i
        await saveEvent(newEvents[i], eventIndex, sessionId)
      }
      lastSavedEventCountRef.current = events.length
    }

    saveNewEvents()
  }, [enabled, sessionId, events, saveEvent])

  // Initialize database on mount
  useEffect(() => {
    if (!enabled) return
    eventDatabase.init().catch(error => {
      console.error("[useEventPersistence] Failed to initialize database:", error)
    })
  }, [enabled])

  return {
    saveEvents: saveEventsBatch,
    persistedEventCount: lastSavedEventCountRef.current,
  }
}
