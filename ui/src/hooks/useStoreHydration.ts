/**
 * Hook for hydrating the store from IndexedDB on startup.
 *
 * Loads:
 * - Most recent active iteration (if not ended) to restore events
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
 * 1. The most recent active (incomplete) iteration and restores its events
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

        // Load the most recent active iteration
        const activeIteration = await eventDatabase.getLatestActiveIteration(instanceId)

        // In v3+ schema, events are stored separately. For v2 data, events are inline.
        const iterationEvents = activeIteration?.events ?? []
        if (activeIteration && iterationEvents.length > 0) {
          // Restore events to the store
          // Use setEventsForInstance for the specific instance
          setEventsForInstance(instanceId, iterationEvents)

          // If this is the active instance, also update the flat events array
          if (instanceId === activeInstanceId) {
            setEvents(iterationEvents)
          }

          console.log(
            `[useStoreHydration] Restored ${iterationEvents.length} events from active iteration ${activeIteration.id}`,
          )
        }

        // Load the most recent task chat session
        const latestTaskChat = await eventDatabase.getLatestTaskChatSessionForInstance(instanceId)

        if (latestTaskChat) {
          // Restore task chat messages
          if (latestTaskChat.messages.length > 0) {
            useAppStore.setState({
              taskChatMessages: latestTaskChat.messages,
            })

            console.log(
              `[useStoreHydration] Restored ${latestTaskChat.messages.length} task chat messages from session ${latestTaskChat.id}`,
            )
          }

          // Restore task chat events
          if (latestTaskChat.events.length > 0) {
            useAppStore.setState({
              taskChatEvents: latestTaskChat.events,
            })

            console.log(
              `[useStoreHydration] Restored ${latestTaskChat.events.length} task chat events from session ${latestTaskChat.id}`,
            )
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
