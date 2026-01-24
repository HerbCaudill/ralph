/**
 * Hook for persisting task chat sessions to IndexedDB.
 *
 * Auto-saves task chat sessions with debouncing:
 * - Debounced save on new events (500ms debounce)
 * - Clear session on explicit clear history
 *
 * Generates a stable GUID per session for reliable storage and retrieval.
 */

import { useEffect, useRef, useCallback, useState } from "react"
import { eventDatabase } from "@/lib/persistence"
import type { PersistedTaskChatSession } from "@/lib/persistence"
import type { ChatEvent, TaskChatMessage } from "@/types"

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
 * 1. New events are added (debounced to avoid excessive writes)
 * 2. New messages are added (debounced)
 *
 * The hook tracks the current session and maintains a stable ID for it.
 */
export function useTaskChatPersistence(
  options: UseTaskChatPersistenceOptions,
): UseTaskChatPersistenceResult {
  const { instanceId, taskId, taskTitle, messages, events, enabled = true } = options

  // Track current session ID in state (for reactivity)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)

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
   * Build a PersistedTaskChatSession from the current state.
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
      events,
    }
  }, [instanceId, taskTitle, messages, events])

  /**
   * Save the session to IndexedDB immediately (no debounce).
   */
  const saveImmediately = useCallback(async (): Promise<void> => {
    const sessionData = buildSessionData()
    if (!sessionData) return

    try {
      await eventDatabase.saveTaskChatSession(sessionData)

      // Update tracking state
      if (currentSessionRef.current) {
        currentSessionRef.current = {
          ...currentSessionRef.current,
          lastSavedEventCount: events.length,
          lastSavedMessageCount: messages.length,
        }
      }
    } catch (error) {
      console.error("[useTaskChatPersistence] Failed to save session:", error)
    }
  }, [buildSessionData, events.length, messages.length])

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
  }, [enabled, cancelDebouncedSave])

  /**
   * Start or update session tracking based on task changes.
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
    }
  }, [enabled, instanceId, taskId, messages.length, events.length, saveImmediately])

  /**
   * Auto-save when events or messages change (debounced).
   */
  useEffect(() => {
    if (!enabled) return
    if (!currentSessionRef.current) return

    const session = currentSessionRef.current
    const hasNewEvents = events.length > session.lastSavedEventCount
    const hasNewMessages = messages.length > session.lastSavedMessageCount

    if (hasNewEvents || hasNewMessages) {
      saveDebounced()
    }
  }, [enabled, events.length, messages.length, saveDebounced])

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
