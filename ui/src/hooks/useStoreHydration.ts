/**
 * Hook for hydrating the store from IndexedDB on startup.
 *
 * Loads:
 * - Most recent active session (if not ended) to restore events
 * - Most recent task chat session to restore task chat messages/events
 *
 * This enables the UI to restore state after page reload or browser restart.
 */

import { useEffect, useState, useRef } from "react"
import { eventDatabase } from "@/lib/persistence"
import { useAppStore } from "@/store"

export interface UseStoreHydrationOptions {
  /** ID of the Ralph instance to hydrate */
  instanceId: string
  /** Whether hydration is enabled (default: true) */
  enabled?: boolean
}

export interface UseStoreHydrationResult {
  /** Whether hydration has completed */
  isHydrated: boolean
  /** Whether hydration is in progress */
  isHydrating: boolean
  /** Error that occurred during hydration, if any */
  error: Error | null
}

/**
 * Hook to hydrate the store from IndexedDB on startup.
 *
 * On mount, it loads:
 * 1. The most recent active (incomplete) session and restores its events
 * 2. The most recent task chat session and restores its messages/events
 *
 * This allows the UI to pick up where it left off after a page reload.
 */
export function useStoreHydration(options: UseStoreHydrationOptions): UseStoreHydrationResult {
  const { instanceId, enabled = true } = options

  const [isHydrated, setIsHydrated] = useState(false)
  const [isHydrating, setIsHydrating] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Track whether we've already hydrated to prevent re-hydration
  const hasHydratedRef = useRef(false)

  // Get store actions
  const setEventsForInstance = useAppStore(state => state.setEventsForInstance)
  const setEvents = useAppStore(state => state.setEvents)
  const activeInstanceId = useAppStore(state => state.activeInstanceId)

  useEffect(() => {
    if (!enabled) {
      setIsHydrated(true)
      return
    }

    // Only hydrate once
    if (hasHydratedRef.current) return
    hasHydratedRef.current = true

    async function hydrate() {
      setIsHydrating(true)
      setError(null)

      try {
        // Initialize the database
        await eventDatabase.init()

        // Load the most recent active session
        const activeSession = await eventDatabase.getLatestActiveSession(instanceId)

        if (activeSession) {
          // In v3+ schema, events are stored separately in the events table.
          // For v2 data (migration), events may be inline.
          let sessionEvents = activeSession.events ?? []

          // If no inline events (v3 schema), load from the events table
          if (sessionEvents.length === 0) {
            const persistedEvents = await eventDatabase.getEventsForSession(activeSession.id)
            sessionEvents = persistedEvents.map(pe => pe.event)
          }

          if (sessionEvents.length > 0) {
            // Restore events to the store
            // Use setEventsForInstance for the specific instance
            setEventsForInstance(instanceId, sessionEvents)

            // If this is the active instance, also update the flat events array
            if (instanceId === activeInstanceId) {
              setEvents(sessionEvents)
            }

            console.log(
              `[useStoreHydration] Restored ${sessionEvents.length} events from active session ${activeSession.id}`,
            )
          }
        }

        // Load the task chat session - use stored session ID if available
        const storedSessionId = useAppStore.getState().currentTaskChatSessionId
        const taskChatSession =
          storedSessionId ?
            await eventDatabase.getTaskChatSession(storedSessionId)
          : await eventDatabase.getLatestTaskChatSessionForInstance(instanceId)

        if (taskChatSession) {
          // Restore task chat messages
          if (taskChatSession.messages.length > 0) {
            useAppStore.setState({
              taskChatMessages: taskChatSession.messages,
            })

            console.log(
              `[useStoreHydration] Restored ${taskChatSession.messages.length} task chat messages from session ${taskChatSession.id}`,
            )
          }

          // In v7+ schema, events are stored separately in the events table.
          // For v6 data (migration), events may be inline.
          let taskChatEvents = taskChatSession.events ?? []

          // If no inline events (v7 schema), load from the events table
          if (taskChatEvents.length === 0) {
            const persistedEvents = await eventDatabase.getEventsForSession(taskChatSession.id)
            taskChatEvents = persistedEvents.map(pe => pe.event)
          }

          // Restore task chat events
          if (taskChatEvents.length > 0) {
            useAppStore.setState({
              taskChatEvents: taskChatEvents,
            })

            console.log(
              `[useStoreHydration] Restored ${taskChatEvents.length} task chat events from session ${taskChatSession.id}`,
            )
          }

          // Ensure the session ID is set in the store for useTaskChatPersistence to continue
          if (taskChatSession.id !== storedSessionId) {
            useAppStore.setState({
              currentTaskChatSessionId: taskChatSession.id,
            })
          }
        }

        setIsHydrated(true)
      } catch (err) {
        console.error("[useStoreHydration] Failed to hydrate store:", err)
        setError(err instanceof Error ? err : new Error("Unknown hydration error"))
        // Still mark as hydrated so the app can proceed (just without restored data)
        setIsHydrated(true)
      } finally {
        setIsHydrating(false)
      }
    }

    hydrate()
  }, [enabled, instanceId, activeInstanceId, setEventsForInstance, setEvents])

  return {
    isHydrated,
    isHydrating,
    error,
  }
}
