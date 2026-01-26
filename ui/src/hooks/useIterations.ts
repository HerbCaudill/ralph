import { useState, useEffect, useCallback } from "react"
import { eventDatabase, type IterationMetadata } from "@/lib/persistence"

/**
 * Summary of an iteration (without full event data).
 * Returned by the hook for efficient browsing of past iterations.
 */
export interface IterationSummary {
  id: string
  createdAt: string
  eventCount: number
  metadata?: {
    taskId?: string
    title?: string
  }
}

export interface UseIterationsOptions {
  /** Optional task ID to filter iterations by */
  taskId?: string
}

export interface UseIterationsResult {
  /** List of iteration summaries */
  iterations: IterationSummary[]
  /** Whether iterations are currently loading */
  isLoading: boolean
  /** Error message if fetch failed */
  error: string | null
  /** Manually refresh iterations */
  refresh: () => Promise<void>
}

/**
 * Validates a timestamp and returns a valid Date, or null if invalid.
 * A timestamp is considered invalid if it's undefined, null, NaN, or 0.
 */
function isValidTimestamp(timestamp: number | undefined | null): timestamp is number {
  return timestamp !== undefined && timestamp !== null && !isNaN(timestamp) && timestamp > 0
}

/**
 * Converts IterationMetadata from IndexedDB to IterationSummary for consumers.
 * Returns null if the metadata has an invalid timestamp.
 */
function toIterationSummary(metadata: IterationMetadata): IterationSummary | null {
  // Validate timestamp before attempting conversion
  if (!isValidTimestamp(metadata.startedAt)) {
    console.warn(
      `[useIterations] Skipping iteration ${metadata.id} with invalid startedAt: ${metadata.startedAt}`,
    )
    return null
  }

  return {
    id: metadata.id,
    createdAt: new Date(metadata.startedAt).toISOString(),
    eventCount: metadata.eventCount,
    metadata:
      metadata.taskId || metadata.taskTitle ?
        {
          taskId: metadata.taskId ?? undefined,
          title: metadata.taskTitle ?? undefined,
        }
      : undefined,
  }
}

/**
 * Hook to fetch and manage iteration summaries from IndexedDB.
 * Returns summaries (without full event data) for efficient browsing.
 *
 * Iterations are stored client-side in IndexedDB by useIterationPersistence
 * and persist across sessions.
 */
export function useIterations(options: UseIterationsOptions = {}): UseIterationsResult {
  const { taskId } = options

  const [iterations, setIterations] = useState<IterationSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      await eventDatabase.init()

      const metadata =
        taskId ?
          await eventDatabase.getIterationsForTask(taskId)
        : await eventDatabase.listAllIterations()

      // Filter out iterations with invalid timestamps
      const summaries = metadata
        .map(toIterationSummary)
        .filter((s): s is IterationSummary => s !== null)
      setIterations(summaries)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load iterations")
    } finally {
      setIsLoading(false)
    }
  }, [taskId])

  // Initial fetch
  useEffect(() => {
    refresh()
  }, [refresh])

  return { iterations, isLoading, error, refresh }
}
