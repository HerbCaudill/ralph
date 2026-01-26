/**
 * Hook for persisting iterations to IndexedDB.
 *
 * Auto-saves iterations at:
 * - Iteration boundary (system init event)
 * - Iteration end (ralph_task_completed or COMPLETE signal)
 *
 * Generates a stable GUID per iteration for reliable storage and retrieval.
 */

import { useEffect, useRef, useCallback, useState } from "react"
import { eventDatabase } from "@/lib/persistence"
import type { PersistedIteration } from "@/lib/persistence"
import type { ChatEvent, TokenUsage, ContextWindow, IterationInfo } from "@/types"
import { getIterationBoundaries, getTaskFromIterationEvents } from "@/store"

/**
 * Generates a stable iteration ID based on instance ID and iteration start timestamp.
 * Format: "{instanceId}-{timestamp}"
 */
function generateIterationId(instanceId: string, startedAt: number): string {
  return `${instanceId}-${startedAt}`
}

/**
 * Checks if an event signals iteration completion.
 * Returns true for ralph_task_completed events or COMPLETE promise signals.
 */
function isIterationEndEvent(event: ChatEvent): boolean {
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

/**  Extracts the events for a specific iteration from the full events array. */
function getEventsForIterationIndex(events: ChatEvent[], iterationIndex: number): ChatEvent[] {
  const boundaries = getIterationBoundaries(events)
  if (boundaries.length === 0 || iterationIndex < 0 || iterationIndex >= boundaries.length) {
    return []
  }

  const startIndex = boundaries[iterationIndex]
  const endIndex = boundaries[iterationIndex + 1] ?? events.length
  return events.slice(startIndex, endIndex)
}

export interface UseIterationPersistenceOptions {
  /** ID of the Ralph instance */
  instanceId: string
  /** All events from the instance */
  events: ChatEvent[]
  /** Current token usage */
  tokenUsage: TokenUsage
  /** Current context window */
  contextWindow: ContextWindow
  /** Current iteration info */
  iteration: IterationInfo
  /** Whether persistence is enabled (default: true) */
  enabled?: boolean
}

export interface UseIterationPersistenceResult {
  /** Manually save the current iteration */
  saveCurrentIteration: () => Promise<void>
  /** Get the current iteration ID (null if no iteration started) */
  currentIterationId: string | null
}

/**
 * Hook to persist iterations to IndexedDB.
 *
 * Automatically saves iterations when:
 * 1. A new iteration starts (system init event detected)
 * 2. An iteration ends (ralph_task_completed or COMPLETE signal)
 *
 * The hook tracks the current iteration and maintains a stable ID for it.
 */
export function useIterationPersistence(
  options: UseIterationPersistenceOptions,
): UseIterationPersistenceResult {
  const { instanceId, events, tokenUsage, contextWindow, iteration, enabled = true } = options

  // Track current iteration ID in state (for reactivity)
  const [currentIterationId, setCurrentIterationId] = useState<string | null>(null)

  // Track the current iteration state in ref (for effect processing)
  const currentIterationRef = useRef<{
    id: string
    startedAt: number
    iterationIndex: number
    eventCount: number
    saved: boolean
  } | null>(null)

  // Track last processed event count to detect new events
  const lastProcessedEventCountRef = useRef(0)

  /**
   * Build a PersistedIteration from the current state.
   */
  const buildIterationData = useCallback(
    (
      iterationId: string,
      startedAt: number,
      iterationEvents: ChatEvent[],
      completed: boolean,
    ): PersistedIteration => {
      const taskInfo = getTaskFromIterationEvents(iterationEvents)

      // Find the last event sequence number (using event index as proxy since we don't have server sequence numbers yet)
      const lastEventSequence = iterationEvents.length - 1

      return {
        id: iterationId,
        instanceId,
        workspaceId: null, // Will be populated by server in a future update
        startedAt,
        completedAt: completed ? Date.now() : null,
        taskId: taskInfo?.id ?? null,
        taskTitle: taskInfo?.title ?? null,
        tokenUsage,
        contextWindow,
        iteration,
        eventCount: iterationEvents.length,
        lastEventSequence,
        events: iterationEvents,
      }
    },
    [instanceId, tokenUsage, contextWindow, iteration],
  )

  /**
   * Save an iteration to IndexedDB.
   */
  const saveIteration = useCallback(async (iterationData: PersistedIteration): Promise<void> => {
    try {
      await eventDatabase.saveIteration(iterationData)
    } catch (error) {
      console.error("[useIterationPersistence] Failed to save iteration:", error)
    }
  }, [])

  /**
   * Manually save the current iteration.
   */
  const saveCurrentIteration = useCallback(async (): Promise<void> => {
    if (!enabled) return

    const current = currentIterationRef.current
    if (!current) return

    const iterationEvents = getEventsForIterationIndex(events, current.iterationIndex)
    if (iterationEvents.length === 0) return

    const iterationData = buildIterationData(
      current.id,
      current.startedAt,
      iterationEvents,
      false, // Not marking as complete on manual save
    )

    await saveIteration(iterationData)
    currentIterationRef.current = { ...current, saved: true, eventCount: iterationEvents.length }
  }, [enabled, events, buildIterationData, saveIteration])

  /**
   * Process events and detect iteration boundaries.
   */
  useEffect(() => {
    if (!enabled) return

    // Only process if we have new events
    if (events.length <= lastProcessedEventCountRef.current) return

    const boundaries = getIterationBoundaries(events)

    // Check for new iteration start
    if (boundaries.length > 0) {
      const latestBoundaryIndex = boundaries.length - 1
      const latestBoundaryEventIndex = boundaries[latestBoundaryIndex]
      const boundaryEvent = events[latestBoundaryEventIndex]

      // New iteration started if we don't have a current one, or the boundary changed
      if (
        !currentIterationRef.current ||
        currentIterationRef.current.iterationIndex !== latestBoundaryIndex
      ) {
        // Save previous iteration if it exists and wasn't saved
        if (currentIterationRef.current) {
          const prevEvents = getEventsForIterationIndex(
            events,
            currentIterationRef.current.iterationIndex,
          )
          if (prevEvents.length > 0) {
            const prevData = buildIterationData(
              currentIterationRef.current.id,
              currentIterationRef.current.startedAt,
              prevEvents,
              true, // Mark as complete since a new iteration started
            )
            saveIteration(prevData)
          }
        }

        // Start tracking new iteration
        // Fall back to Date.now() if timestamp is missing (defensive - should be set by server)
        const startedAt = boundaryEvent.timestamp ?? Date.now()
        const newId = generateIterationId(instanceId, startedAt)

        currentIterationRef.current = {
          id: newId,
          startedAt,
          iterationIndex: latestBoundaryIndex,
          eventCount: 0,
          saved: false,
        }
        setCurrentIterationId(newId)
      }
    }

    // Check for iteration end signals in new events
    const newEvents = events.slice(lastProcessedEventCountRef.current)
    for (const event of newEvents) {
      if (isIterationEndEvent(event) && currentIterationRef.current) {
        const current = currentIterationRef.current
        const iterationEvents = getEventsForIterationIndex(events, current.iterationIndex)

        if (iterationEvents.length > 0) {
          const iterationData = buildIterationData(
            current.id,
            current.startedAt,
            iterationEvents,
            true,
          )
          saveIteration(iterationData)
          currentIterationRef.current = {
            ...current,
            saved: true,
            eventCount: iterationEvents.length,
          }
        }
        break // Only process one completion per effect run
      }
    }

    // Periodically save progress (every 10 new events)
    if (currentIterationRef.current) {
      const current = currentIterationRef.current
      const iterationEvents = getEventsForIterationIndex(events, current.iterationIndex)
      const newEventsSinceSave = iterationEvents.length - current.eventCount

      if (newEventsSinceSave >= 10) {
        const iterationData = buildIterationData(
          current.id,
          current.startedAt,
          iterationEvents,
          false,
        )
        saveIteration(iterationData)
        currentIterationRef.current = { ...current, eventCount: iterationEvents.length }
      }
    }

    lastProcessedEventCountRef.current = events.length
  }, [enabled, events, instanceId, buildIterationData, saveIteration])

  // Initialize database on mount
  useEffect(() => {
    if (!enabled) return
    eventDatabase.init().catch(error => {
      console.error("[useIterationPersistence] Failed to initialize database:", error)
    })
  }, [enabled])

  return {
    saveCurrentIteration,
    currentIterationId,
  }
}
