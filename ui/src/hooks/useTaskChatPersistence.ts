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
 * Generates a stable session ID based on instance ID, task ID, and session start timestamp.
 * Format: "{instanceId}-task-{taskId}-{timestamp}"
 */
function generateSessionId(instanceId: string, taskId: string | null, startedAt: number): string {
  const taskPart = taskId ?? "untitled"
  return `${instanceId}-task-${taskPart}-${startedAt}`
}

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

export interface UseTaskChatPersistenceOptions {
  /** ID of the Ralph instance */
  instanceId: string
  /** Current task ID (null if no task selected) */
  taskId: string | null
  /** Current task title (for display) */
  taskTitle: string | null
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
  const { instanceId, taskId, taskTitle, messages, events, enabled = true } = options

  // Get setter for syncing session ID to store
  const setStoreSessionId = useAppStore(state => state.setCurrentTaskChatSessionId)

  // Track current session ID in state (for reactivity)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(
    () => useAppStore.getState().currentTaskChatSessionId,
  )

  // Track the current session state in ref (for effect processing)
  const currentSessionRef = useRef<{
    id: string
    taskId: string | null
    createdAt: number
    lastSavedEventCount: number
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
  const buildPersistedEvent = useCallback(
    (event: ChatEvent, eventIndex: number, sessionId: string): PersistedEvent => {
      return {
        id: generateEventId(sessionId, eventIndex),
        sessionId,
        timestamp: event.timestamp ?? Date.now(),
        eventType: getEventType(event),
        event,
      }
    },
    [],
  )

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
      taskId: session.taskId ?? "untitled",
      taskTitle,
      instanceId,
      createdAt: session.createdAt,
      updatedAt: now,
      messageCount: messages.length,
      eventCount: events.length,
      lastEventSequence,
      messages,
      // Events are stored separately in the events table (v7+ schema)
    }
  }, [instanceId, taskTitle, messages, events])

  /**
   * Save a single event to IndexedDB.
   */
  const saveEvent = useCallback(
    async (event: ChatEvent, eventIndex: number, sessionId: string): Promise<void> => {
      try {
        const persistedEvent = buildPersistedEvent(event, eventIndex, sessionId)
        await eventDatabase.saveEvent(persistedEvent)
      } catch (error) {
        console.error("[useTaskChatPersistence] Failed to save event:", error, {
          eventIndex,
          sessionId,
          eventType: event.type,
        })
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
   * Start or update session tracking based on task changes.
   * If there's a session ID in the store (from hydration), restore that session on first init.
   */
  useEffect(() => {
    if (!enabled) return

    // If we have no messages or events, don't create a session yet
    if (messages.length === 0 && events.length === 0) {
      return
    }

    // Check if we need to start a new session
    const needsNewSession =
      !currentSessionRef.current || currentSessionRef.current.taskId !== taskId

    if (needsNewSession) {
      // Save previous session if it exists
      if (currentSessionRef.current) {
        // Don't await - fire and forget
        saveImmediately()
      }

      // Check if there's a session ID in the store (from hydration) on first init only
      // Use getState() to read the store value without adding it to deps
      const currentStoreSessionId = useAppStore.getState().currentTaskChatSessionId
      if (
        currentStoreSessionId &&
        !currentSessionRef.current &&
        !hasInitializedFromStoreRef.current
      ) {
        hasInitializedFromStoreRef.current = true
        // Parse the session ID to extract the createdAt timestamp
        // Format is: "{instanceId}-task-{taskId}-{timestamp}"
        const parts = currentStoreSessionId.split("-")
        const timestampStr = parts[parts.length - 1]
        const createdAt = parseInt(timestampStr, 10) || Date.now()

        currentSessionRef.current = {
          id: currentStoreSessionId,
          taskId,
          createdAt,
          // Treat existing data as already saved to avoid immediate re-save
          lastSavedEventCount: events.length,
          lastSavedMessageCount: messages.length,
        }
        setCurrentSessionId(currentStoreSessionId)
        return
      }

      // Start tracking new session
      const createdAt = Date.now()
      const newId = generateSessionId(instanceId, taskId, createdAt)

      currentSessionRef.current = {
        id: newId,
        taskId,
        createdAt,
        lastSavedEventCount: 0,
        lastSavedMessageCount: 0,
      }
      setCurrentSessionId(newId)
      // Sync the new session ID to the store for persistence
      setStoreSessionId(newId)
    }
  }, [
    enabled,
    instanceId,
    taskId,
    messages.length,
    events.length,
    saveImmediately,
    setStoreSessionId,
  ])

  /**
   * Auto-save new events to the events store (immediately, no debounce).
   * Events are persisted individually for efficient append-only writes.
   */
  useEffect(() => {
    if (!enabled) return
    if (!currentSessionRef.current) return

    const session = currentSessionRef.current
    const hasNewEvents = events.length > session.lastSavedEventCount

    if (!hasNewEvents) return

    // Save new events (async, fire and forget)
    const saveNewEvents = async () => {
      const newStartIndex = session.lastSavedEventCount
      const newEvents = events.slice(newStartIndex)

      for (let i = 0; i < newEvents.length; i++) {
        const eventIndex = newStartIndex + i
        await saveEvent(newEvents[i], eventIndex, session.id)
      }

      // Update tracking state
      if (currentSessionRef.current) {
        currentSessionRef.current = {
          ...currentSessionRef.current,
          lastSavedEventCount: events.length,
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
