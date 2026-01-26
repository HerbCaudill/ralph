/**
 * Hook for persisting sessions to IndexedDB.
 *
 * Auto-saves sessions at:
 * - Session boundary (system init event)
 * - Session end (ralph_task_completed or COMPLETE signal)
 *
 * Generates a stable GUID per session for reliable storage and retrieval.
 */

import { useEffect, useRef, useCallback, useState } from "react"
import { eventDatabase } from "@/lib/persistence"
import type { PersistedSession } from "@/lib/persistence"
import type { ChatEvent, TokenUsage, ContextWindow, SessionInfo } from "@/types"
import { getSessionBoundaries, getTaskFromSessionEvents } from "@/store"

/**
 * Generates a stable session ID based on instance ID and session start timestamp.
 * Format: "{instanceId}-{timestamp}"
 */
function generateSessionId(instanceId: string, startedAt: number): string {
  return `${instanceId}-${startedAt}`
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
  const { instanceId, events, tokenUsage, contextWindow, session, enabled = true } = options

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
   */
  const buildSessionData = useCallback(
    (
      sessionId: string,
      startedAt: number,
      sessionEvents: ChatEvent[],
      completed: boolean,
    ): PersistedSession => {
      const taskInfo = getTaskFromSessionEvents(sessionEvents)

      // Find the last event sequence number (using event index as proxy since we don't have server sequence numbers yet)
      const lastEventSequence = sessionEvents.length - 1

      return {
        id: sessionId,
        instanceId,
        workspaceId: null, // Will be populated by server in a future update
        startedAt,
        completedAt: completed ? Date.now() : null,
        taskId: taskInfo?.id ?? null,
        taskTitle: taskInfo?.title ?? null,
        tokenUsage,
        contextWindow,
        session,
        eventCount: sessionEvents.length,
        lastEventSequence,
        events: sessionEvents,
      }
    },
    [instanceId, tokenUsage, contextWindow, session],
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
    if (!enabled) return

    // Only process if we have new events
    if (events.length <= lastProcessedEventCountRef.current) return

    const boundaries = getSessionBoundaries(events)

    // Check for new session start
    if (boundaries.length > 0) {
      const latestBoundaryIndex = boundaries.length - 1
      const latestBoundaryEventIndex = boundaries[latestBoundaryIndex]
      const boundaryEvent = events[latestBoundaryEventIndex]

      // New session started if we don't have a current one, or the boundary changed
      if (
        !currentSessionRef.current ||
        currentSessionRef.current.sessionIndex !== latestBoundaryIndex
      ) {
        // Save previous session if it exists and wasn't saved
        if (currentSessionRef.current) {
          const prevEvents = getEventsForSessionIndex(
            events,
            currentSessionRef.current.sessionIndex,
          )
          if (prevEvents.length > 0) {
            const prevData = buildSessionData(
              currentSessionRef.current.id,
              currentSessionRef.current.startedAt,
              prevEvents,
              true, // Mark as complete since a new session started
            )
            saveSession(prevData)
          }
        }

        // Start tracking new session
        // Fall back to Date.now() if timestamp is missing or invalid (defensive - should be set by server)
        // Using || instead of ?? to also catch timestamp=0 (falsy but not nullish)
        const startedAt = boundaryEvent.timestamp || Date.now()
        const newId = generateSessionId(instanceId, startedAt)

        currentSessionRef.current = {
          id: newId,
          startedAt,
          sessionIndex: latestBoundaryIndex,
          eventCount: 0,
          saved: false,
        }
        setCurrentSessionId(newId)
      }
    }

    // Check for session end signals in new events
    const newEvents = events.slice(lastProcessedEventCountRef.current)
    for (const event of newEvents) {
      if (isSessionEndEvent(event) && currentSessionRef.current) {
        const current = currentSessionRef.current
        const sessionEvents = getEventsForSessionIndex(events, current.sessionIndex)

        if (sessionEvents.length > 0) {
          const sessionData = buildSessionData(current.id, current.startedAt, sessionEvents, true)
          saveSession(sessionData)
          currentSessionRef.current = {
            ...current,
            saved: true,
            eventCount: sessionEvents.length,
          }
        }
        break // Only process one completion per effect run
      }
    }

    // Periodically save progress (every 10 new events)
    if (currentSessionRef.current) {
      const current = currentSessionRef.current
      const sessionEvents = getEventsForSessionIndex(events, current.sessionIndex)
      const newEventsSinceSave = sessionEvents.length - current.eventCount

      if (newEventsSinceSave >= 10) {
        const sessionData = buildSessionData(current.id, current.startedAt, sessionEvents, false)
        saveSession(sessionData)
        currentSessionRef.current = { ...current, eventCount: sessionEvents.length }
      }
    }

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
