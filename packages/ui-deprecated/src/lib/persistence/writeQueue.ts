/**
 * IndexedDB Write Queue with Retry Logic.
 *
 * Provides reliable IndexedDB writes with:
 * - Queue-based write management
 * - Exponential backoff retry for transient failures
 * - Persistent failure detection and surfacing
 * - In-memory buffer for recent events as fallback
 */

import { eventDatabase, type PersistedEvent } from "./index"

// Retry configuration
const INITIAL_RETRY_DELAY = 100 // 100ms
const MAX_RETRY_DELAY = 5000 // 5 seconds
const MAX_RETRY_ATTEMPTS = 5
const JITTER_FACTOR = 0.2 // +/- 20% jitter

// Buffer configuration
const MAX_BUFFER_SIZE = 100 // Keep last 100 events in memory

/**
 * Pending write item in the queue.
 */
interface PendingWrite {
  event: PersistedEvent
  sessionId: string
  retryCount: number
  addedAt: number
}

/**
 * Failure callback type for notifying the UI of persistent failures.
 */
export type PersistenceFailureCallback = (error: {
  message: string
  failedCount: number
  lastError: Error
}) => void

/**
 * Queue state and statistics.
 */
interface QueueStats {
  /** Number of writes currently pending */
  pendingCount: number
  /** Number of writes that have permanently failed */
  failedCount: number
  /** Whether there are persistent failures that need attention */
  hasFailures: boolean
  /** Total writes processed since start */
  totalProcessed: number
  /** Total writes that succeeded */
  totalSucceeded: number
  /** Total writes that failed */
  totalFailed: number
}

/**
 * IndexedDB Write Queue Manager.
 *
 * Handles queueing and retrying IndexedDB writes with exponential backoff.
 * Maintains an in-memory buffer of recent events as fallback.
 */
class WriteQueue {
  private queue: PendingWrite[] = []
  private processing = false
  private failedWrites: PendingWrite[] = []
  private recentEventsBuffer: PersistedEvent[] = []
  private onFailure: PersistenceFailureCallback | null = null

  // Statistics
  private totalProcessed = 0
  private totalSucceeded = 0
  private totalFailed = 0

  /**
   * Add an event to the write queue.
   * Returns immediately (non-blocking).
   */
  enqueue(event: PersistedEvent, sessionId: string): void {
    const pendingWrite: PendingWrite = {
      event,
      sessionId,
      retryCount: 0,
      addedAt: Date.now(),
    }

    // Add to queue
    this.queue.push(pendingWrite)

    // Also add to in-memory buffer (as fallback)
    this.addToBuffer(event)

    // Start processing if not already
    this.processQueue()
  }

  /**
   * Set callback for persistent failures.
   * The callback is invoked when writes fail after all retries.
   */
  setFailureCallback(callback: PersistenceFailureCallback | null): void {
    this.onFailure = callback
  }

  /**
   * Get current queue statistics.
   */
  getStats(): QueueStats {
    return {
      pendingCount: this.queue.length,
      failedCount: this.failedWrites.length,
      hasFailures: this.failedWrites.length > 0,
      totalProcessed: this.totalProcessed,
      totalSucceeded: this.totalSucceeded,
      totalFailed: this.totalFailed,
    }
  }

  /**
   * Get the in-memory buffer of recent events.
   * Use as fallback if IndexedDB is unavailable.
   */
  getRecentEventsBuffer(): PersistedEvent[] {
    return [...this.recentEventsBuffer]
  }

  /**
   * Clear all failed writes and reset failure state.
   * Call after user acknowledges the error.
   */
  clearFailures(): void {
    this.failedWrites = []
  }

  /**
   * Retry all failed writes.
   * Moves failed writes back to the queue with reset retry count.
   */
  retryFailedWrites(): void {
    if (this.failedWrites.length === 0) return

    // Move failed writes back to queue with reset retry count
    for (const failed of this.failedWrites) {
      failed.retryCount = 0
      this.queue.push(failed)
    }

    this.failedWrites = []

    // Start processing
    this.processQueue()
  }

  /**
   * Reset the queue (for testing).
   */
  reset(): void {
    this.queue = []
    this.processing = false
    this.failedWrites = []
    this.recentEventsBuffer = []
    this.onFailure = null
    this.totalProcessed = 0
    this.totalSucceeded = 0
    this.totalFailed = 0
  }

  /**
   * Add an event to the in-memory buffer.
   * Maintains a rolling buffer of recent events.
   */
  private addToBuffer(event: PersistedEvent): void {
    this.recentEventsBuffer.push(event)

    // Keep buffer at max size
    if (this.recentEventsBuffer.length > MAX_BUFFER_SIZE) {
      this.recentEventsBuffer.shift()
    }
  }

  /**
   * Process the write queue.
   * Runs sequentially to avoid overwhelming IndexedDB.
   */
  private async processQueue(): Promise<void> {
    // Prevent concurrent processing
    if (this.processing) return
    this.processing = true

    try {
      while (this.queue.length > 0) {
        const item = this.queue.shift()!
        await this.processWrite(item)
      }
    } finally {
      this.processing = false
    }
  }

  /**
   * Process a single write with retry logic.
   */
  private async processWrite(item: PendingWrite): Promise<void> {
    try {
      await eventDatabase.saveEvent(item.event)
      this.totalProcessed++
      this.totalSucceeded++

      console.debug(
        `[WriteQueue] Event persisted: id=${item.event.id}, type=${item.event.eventType}`,
      )
    } catch (error) {
      item.retryCount++

      if (item.retryCount >= MAX_RETRY_ATTEMPTS) {
        // Max retries exceeded - mark as failed
        this.handlePermanentFailure(item, error as Error)
      } else {
        // Schedule retry with exponential backoff
        await this.scheduleRetry(item)
      }
    }
  }

  /**
   * Schedule a retry with exponential backoff.
   */
  private async scheduleRetry(item: PendingWrite): Promise<void> {
    const delay = this.calculateRetryDelay(item.retryCount)

    console.debug(
      `[WriteQueue] Scheduling retry ${item.retryCount}/${MAX_RETRY_ATTEMPTS} in ${delay}ms for event: id=${item.event.id}`,
    )

    await new Promise(resolve => setTimeout(resolve, delay))

    // Re-add to queue for processing
    this.queue.unshift(item)
  }

  /**
   * Calculate retry delay with exponential backoff and jitter.
   */
  private calculateRetryDelay(retryCount: number): number {
    // Exponential backoff
    const baseDelay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, retryCount), MAX_RETRY_DELAY)

    // Add jitter
    const jitter = baseDelay * JITTER_FACTOR * (Math.random() * 2 - 1)
    return Math.max(INITIAL_RETRY_DELAY, Math.round(baseDelay + jitter))
  }

  /**
   * Handle a write that has permanently failed after all retries.
   */
  private handlePermanentFailure(item: PendingWrite, error: Error): void {
    this.totalProcessed++
    this.totalFailed++

    console.error(
      `[WriteQueue] Permanent failure for event: id=${item.event.id}, type=${item.event.eventType}`,
      error,
    )

    this.failedWrites.push(item)

    // Notify the failure callback
    if (this.onFailure) {
      this.onFailure({
        message: `Failed to persist ${this.failedWrites.length} event(s) to IndexedDB after ${MAX_RETRY_ATTEMPTS} retries`,
        failedCount: this.failedWrites.length,
        lastError: error,
      })
    }
  }
}

/**
 * Singleton instance of the write queue.
 */
export const writeQueue = new WriteQueue()
