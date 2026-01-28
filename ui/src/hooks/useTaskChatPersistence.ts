/**
 * Hook for persisting task chat sessions to IndexedDB.
 *
 * Auto-saves task chat sessions with debouncing:
 * - Debounced save on new messages (500ms debounce)
 * - Events are saved individually to the events store (unified storage)
 * - Clear session on explicit clear history
 *
 * Generates a stable GUID per session for reliable storage and retrieval.
 */

import { useEffect, useRef, useCallback, useState } from "react"
import { eventDatabase } from "@/lib/persistence"
import type { PersistedEvent, PersistedTaskChatSession } from "@/lib/persistence"
import type { ChatEvent, TaskChatMessage } from "@/types"
import { useAppStore } from "@/store"

/** Debounce interval for auto-saving (in milliseconds) */
const SAVE_DEBOUNCE_MS = 500

/**
 * Generates a stable session ID based on instance ID and session start timestamp.
 * Format: "{instanceId}-taskchat-{timestamp}"
 */
function generateSessionId(instanceId: string, startedAt: number): string {
  return `${instanceId}-taskchat-${startedAt}`
}

/**
 * Simple hash function for generating a short content fingerprint.
 * Uses djb2 algorithm - fast and produces reasonable distribution.
 */
function hashString(str: string): string {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i)
  }
  // Convert to positive number and to base36 for shorter strings
  return (hash >>> 0).toString(36)
}

/**
 * Generates a stable event ID from an event.
 *
 * Uses the event's built-in `id` field if present (server-assigned UUID),
 * otherwise falls back to a content-based ID using session ID, timestamp, type,
 * and a hash of the event content. This ensures uniqueness even when two events
 * have the same timestamp and type (e.g., multiple tool_use events in the same ms).
 *
 * This is more robust than index-based IDs which break if events are reordered/removed.
 */
function getEventId(event: ChatEvent, sessionId: string): string {
  // Prefer server-assigned ID if available
  if (event.id) {
    return event.id
  }
  // Fallback: generate stable ID from content
  // Include a content hash to distinguish events with same timestamp+type
  const contentHash = hashString(JSON.stringify(event))
  return `${sessionId}-${event.timestamp}-${event.type ?? "unknown"}-${contentHash}`
}

/**
 * Extracts the event type from a ChatEvent.
 * Falls back to "unknown" if type is not available.
 */
function getEventType(event: ChatEvent): string {
  return event.type ?? "unknown"
}

export interface UseTaskChatPersistenceOptions {
  /** ID of the Ralph instance */
  instanceId: string
  /** All task chat messages */
  messages: TaskChatMessage[]
  /** All task chat events */
  events: ChatEvent[]
  /** Whether persistence is enabled (default: true) */
  enabled?: boolean
}

export interface UseTaskChatPersistenceResult {
  /** Manually save the current session */
  saveCurrentSession: () => Promise<void>
  /** Clear the current session from IndexedDB */
  clearSession: () => Promise<void>
  /** Get the current session ID (null if no session started) */
  currentSessionId: string | null
}

/**
 * Hook to persist task chat sessions to IndexedDB.
 *
 * Automatically saves sessions when:
 * 1. New messages are added (debounced to avoid excessive writes)
 * 2. Events are saved individually to the events store (unified storage)
 *
 * The hook tracks the current session and maintains a stable ID for it.
 */
export function useTaskChatPersistence(
  options: UseTaskChatPersistenceOptions,
): UseTaskChatPersistenceResult {
  const { instanceId, messages, events, enabled = true } = options

  // Get setter for syncing session ID to store
  const setStoreSessionId = useAppStore(state => state.setCurrentTaskChatSessionId)

  // Track current session ID in state (for reactivity)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(
    () => useAppStore.getState().currentTaskChatSessionId,
  )

  // Track the current session state in ref (for effect processing)
  const currentSessionRef = useRef<{
    id: string
    createdAt: number
    savedEventIds: Set<string>
    lastSavedMessageCount: number
  } | null>(null)

  // Debounce timer ref
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /**
   * Cancel any pending debounced save.
   */
  const cancelDebouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
  }, [])

  /**
   * Build a PersistedEvent from a ChatEvent.
   */
  const buildPersistedEvent = useCallback((event: ChatEvent, sessionId: string): PersistedEvent => {
    return {
      id: getEventId(event, sessionId),
      sessionId,
      timestamp: event.timestamp ?? Date.now(),
      eventType: getEventType(event),
      event,
    }
  }, [])

  /**
   * Build a PersistedTaskChatSession from the current state.
   * Note: Events are stored separately in the events table (v7+ schema).
   */
  const buildSessionData = useCallback((): PersistedTaskChatSession | null => {
    const session = currentSessionRef.current
    if (!session) return null

    const now = Date.now()
    const lastEventSequence = events.length - 1

    return {
      id: session.id,
      instanceId,
      createdAt: session.createdAt,
      updatedAt: now,
      messageCount: messages.length,
      eventCount: events.length,
      lastEventSequence,
      messages,
      // Events are stored separately in the events table (v7+ schema)
    }
  }, [instanceId, messages, events])

  /**
   * Save a single event to IndexedDB.
   * Returns the event ID if saved successfully, null otherwise.
   */
  const saveEvent = useCallback(
    async (event: ChatEvent, sessionId: string): Promise<string | null> => {
      try {
        const persistedEvent = buildPersistedEvent(event, sessionId)
        await eventDatabase.saveEvent(persistedEvent)
        return persistedEvent.id
      } catch (error) {
        console.error("[useTaskChatPersistence] Failed to save event:", error, {
          eventId: getEventId(event, sessionId),
          sessionId,
          eventType: event.type,
        })
        return null
      }
    },
    [buildPersistedEvent],
  )

  /**
   * Save the session to IndexedDB immediately (no debounce).
   * This saves session metadata and messages. Events are saved separately.
   */
  const saveImmediately = useCallback(async (): Promise<void> => {
    const sessionData = buildSessionData()
    if (!sessionData) return

    try {
      await eventDatabase.saveTaskChatSession(sessionData)

      // Update tracking state (only for messages - events tracked separately)
      if (currentSessionRef.current) {
        currentSessionRef.current = {
          ...currentSessionRef.current,
          lastSavedMessageCount: messages.length,
        }
      }
    } catch (error) {
      console.error("[useTaskChatPersistence] Failed to save session:", error)
    }
  }, [buildSessionData, messages.length])

  /**
   * Save the session with debouncing.
   */
  const saveDebounced = useCallback(() => {
    cancelDebouncedSave()
    saveTimeoutRef.current = setTimeout(() => {
      saveImmediately()
    }, SAVE_DEBOUNCE_MS)
  }, [cancelDebouncedSave, saveImmediately])

  /**
   * Manually save the current session.
   */
  const saveCurrentSession = useCallback(async (): Promise<void> => {
    if (!enabled) return
    cancelDebouncedSave()
    await saveImmediately()
  }, [enabled, cancelDebouncedSave, saveImmediately])

  /**
   * Clear the current session from IndexedDB.
   */
  const clearSession = useCallback(async (): Promise<void> => {
    if (!enabled) return

    cancelDebouncedSave()

    const session = currentSessionRef.current
    if (session) {
      try {
        await eventDatabase.deleteTaskChatSession(session.id)
      } catch (error) {
        console.error("[useTaskChatPersistence] Failed to delete session:", error)
      }
    }

    // Reset session state
    currentSessionRef.current = null
    setCurrentSessionId(null)
    // Clear the store session ID so a new session starts fresh
    setStoreSessionId(null)
  }, [enabled, cancelDebouncedSave, setStoreSessionId])

  // Track whether we've initialized from the store (to avoid re-triggering on store changes)
  const hasInitializedFromStoreRef = useRef(false)

  /**
   * Start session tracking when messages/events are added.
   * If there's a session ID in the store (from hydration), restore that session on first init.
   * Session continues until explicitly cleared - not tied to current task.
   */
  useEffect(() => {
    if (!enabled) return

    // If we have no messages or events, don't create a session yet
    if (messages.length === 0 && events.length === 0) {
      return
    }

    // Only create a new session if we don't have one
    if (currentSessionRef.current) {
      return
    }

    // Check if there's a session ID in the store (from hydration) on first init only
    // Use getState() to read the store value without adding it to deps
    const currentStoreSessionId = useAppStore.getState().currentTaskChatSessionId
    if (currentStoreSessionId && !hasInitializedFromStoreRef.current) {
      hasInitializedFromStoreRef.current = true
      // Parse the session ID to extract the createdAt timestamp
      // Format is: "{instanceId}-taskchat-{timestamp}"
      const parts = currentStoreSessionId.split("-")
      const timestampStr = parts[parts.length - 1]
      const createdAt = parseInt(timestampStr, 10) || Date.now()

      // Mark all existing events as already saved (using their stable IDs)
      const savedEventIds = new Set(events.map(e => getEventId(e, currentStoreSessionId)))

      currentSessionRef.current = {
        id: currentStoreSessionId,
        createdAt,
        // Treat existing data as already saved to avoid immediate re-save
        savedEventIds,
        lastSavedMessageCount: messages.length,
      }
      setCurrentSessionId(currentStoreSessionId)
      return
    }

    // Start tracking new session
    const createdAt = Date.now()
    const newId = generateSessionId(instanceId, createdAt)

    currentSessionRef.current = {
      id: newId,
      createdAt,
      savedEventIds: new Set<string>(),
      lastSavedMessageCount: 0,
    }
    setCurrentSessionId(newId)
    // Sync the new session ID to the store for persistence
    setStoreSessionId(newId)
  }, [enabled, instanceId, messages.length, events.length, setStoreSessionId])

  /**
   * Auto-save new events to the events store (immediately, no debounce).
   * Events are persisted individually for efficient append-only writes.
   *
   * Uses stable event IDs (from server or content-based) instead of array indices
   * to correctly handle:
   * - Events with server-assigned UUIDs
   * - Array reorders/mutations
   * - Session switches with stale event arrays
   * - HMR/duplicate processing
   */
  useEffect(() => {
    if (!enabled) return
    if (!currentSessionRef.current) return

    const session = currentSessionRef.current

    // Find events that haven't been saved yet (by their stable ID)
    const unsavedEvents = events.filter(e => !session.savedEventIds.has(getEventId(e, session.id)))

    if (unsavedEvents.length === 0) return

    // Save new events (async, fire and forget)
    const saveNewEvents = async () => {
      for (const event of unsavedEvents) {
        const savedId = await saveEvent(event, session.id)
        // Track saved event by its ID
        if (savedId && currentSessionRef.current) {
          currentSessionRef.current.savedEventIds.add(savedId)
        }
      }
    }

    saveNewEvents()
  }, [enabled, events, saveEvent])

  /**
   * Auto-save session metadata when messages change (debounced).
   * Events are saved separately via the effect above.
   */
  useEffect(() => {
    if (!enabled) return
    if (!currentSessionRef.current) return

    const session = currentSessionRef.current
    const hasNewMessages = messages.length > session.lastSavedMessageCount

    if (hasNewMessages) {
      saveDebounced()
    }
  }, [enabled, messages.length, saveDebounced])

  /**
   * Initialize database on mount.
   */
  useEffect(() => {
    if (!enabled) return
    eventDatabase.init().catch(error => {
      console.error("[useTaskChatPersistence] Failed to initialize database:", error)
    })
  }, [enabled])

  /**
   * Cleanup: flush any pending saves and cancel timer on unmount.
   */
  useEffect(() => {
    return () => {
      cancelDebouncedSave()
    }
  }, [cancelDebouncedSave])

  return {
    saveCurrentSession,
    clearSession,
    currentSessionId,
  }
}
