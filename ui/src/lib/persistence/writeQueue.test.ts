import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import "fake-indexeddb/auto"
import { writeQueue } from "./writeQueue"
import { eventDatabase, type PersistedEvent } from "./index"

/**
 * Create a test persisted event with sensible defaults.
 */
function createTestEvent(overrides: Partial<PersistedEvent> = {}): PersistedEvent {
  const id = overrides.id ?? `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return {
    id,
    sessionId: "test-session",
    timestamp: Date.now(),
    eventType: "user_message",
    event: { type: "user_message", timestamp: Date.now(), message: "Test message" },
    ...overrides,
  }
}

describe("WriteQueue", () => {
  beforeEach(async () => {
    // Reset the write queue state
    writeQueue.reset()
    // Initialize the database
    await eventDatabase.init()
    // Clear any existing data
    await eventDatabase.clearAll()
  })

  afterEach(async () => {
    writeQueue.reset()
    eventDatabase.close()
    // Clear IndexedDB databases
    const databases = await indexedDB.databases()
    for (const db of databases) {
      if (db.name) {
        indexedDB.deleteDatabase(db.name)
      }
    }
  })

  describe("enqueue", () => {
    it("should add an event to the queue and persist it", async () => {
      const event = createTestEvent()

      writeQueue.enqueue(event, "test-session")

      // Wait for queue to process
      await new Promise(resolve => setTimeout(resolve, 50))

      // Check that the event was persisted
      const persisted = await eventDatabase.getEvent(event.id)
      expect(persisted).toBeDefined()
      expect(persisted?.eventType).toBe("user_message")
    })

    it("should process multiple events sequentially", async () => {
      const events = [
        createTestEvent({ id: "event-1", timestamp: 1 }),
        createTestEvent({ id: "event-2", timestamp: 2 }),
        createTestEvent({ id: "event-3", timestamp: 3 }),
      ]

      for (const event of events) {
        writeQueue.enqueue(event, "test-session")
      }

      // Wait for queue to process
      await new Promise(resolve => setTimeout(resolve, 100))

      // Check all events were persisted
      for (const event of events) {
        const persisted = await eventDatabase.getEvent(event.id)
        expect(persisted).toBeDefined()
      }
    })

    it("should add events to the in-memory buffer", () => {
      const event = createTestEvent()

      writeQueue.enqueue(event, "test-session")

      const buffer = writeQueue.getRecentEventsBuffer()
      expect(buffer).toHaveLength(1)
      expect(buffer[0].id).toBe(event.id)
    })

    it("should limit buffer size to MAX_BUFFER_SIZE", () => {
      // Enqueue more than MAX_BUFFER_SIZE events
      for (let i = 0; i < 150; i++) {
        const event = createTestEvent({ id: `event-${i}` })
        writeQueue.enqueue(event, "test-session")
      }

      const buffer = writeQueue.getRecentEventsBuffer()
      // Buffer should be limited to 100 (MAX_BUFFER_SIZE)
      expect(buffer.length).toBe(100)
      // Should contain the most recent events (50-149)
      expect(buffer[0].id).toBe("event-50")
      expect(buffer[99].id).toBe("event-149")
    })
  })

  describe("statistics", () => {
    it("should track pending count", () => {
      // Initially no pending
      expect(writeQueue.getStats().pendingCount).toBe(0)
    })

    it("should track successful writes", async () => {
      const event = createTestEvent()

      writeQueue.enqueue(event, "test-session")

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 50))

      const stats = writeQueue.getStats()
      expect(stats.totalSucceeded).toBe(1)
      expect(stats.totalProcessed).toBe(1)
      expect(stats.totalFailed).toBe(0)
    })
  })

  describe("failure callback", () => {
    it("should invoke failure callback on permanent failure", async () => {
      // Use fake timers to control timing
      vi.useFakeTimers()

      const failureCallback = vi.fn()
      writeQueue.setFailureCallback(failureCallback)

      // Mock saveEvent to always fail
      const saveEventSpy = vi
        .spyOn(eventDatabase, "saveEvent")
        .mockRejectedValue(new Error("IndexedDB error"))

      const event = createTestEvent()
      writeQueue.enqueue(event, "test-session")

      // Advance through all retries (5 retries with exponential backoff)
      // Need to flush promises between timer advances for async processing
      for (let i = 0; i < 6; i++) {
        await vi.advanceTimersByTimeAsync(10000)
      }

      expect(failureCallback).toHaveBeenCalled()
      const errorArg = failureCallback.mock.calls[0][0] as {
        message: string
        failedCount: number
        lastError: Error
      }
      expect(errorArg.failedCount).toBe(1)
      expect(errorArg.lastError.message).toBe("IndexedDB error")

      saveEventSpy.mockRestore()
      vi.useRealTimers()
    })

    it("should clear failure callback on null", () => {
      const failureCallback = vi.fn()
      writeQueue.setFailureCallback(failureCallback)
      writeQueue.setFailureCallback(null)

      // getStats should reflect no callback is set
      expect(writeQueue.getStats().hasFailures).toBe(false)
    })
  })

  describe("retry failed writes", () => {
    it("should move failed writes back to queue on retry", async () => {
      vi.useFakeTimers()

      const failureCallback = vi.fn()
      writeQueue.setFailureCallback(failureCallback)

      // Mock saveEvent to fail initially
      let callCount = 0
      const saveEventSpy = vi.spyOn(eventDatabase, "saveEvent").mockImplementation(async () => {
        callCount++
        // Fail for the first 5 calls (max retries), then succeed
        if (callCount <= 5) {
          throw new Error("IndexedDB error")
        }
      })

      const event = createTestEvent()
      writeQueue.enqueue(event, "test-session")

      // Advance through all retries
      for (let i = 0; i < 6; i++) {
        await vi.advanceTimersByTimeAsync(10000)
      }

      // Should have failed
      expect(writeQueue.getStats().failedCount).toBe(1)

      // Retry failed writes
      writeQueue.retryFailedWrites()

      // Wait for retry to complete
      await vi.advanceTimersByTimeAsync(100)

      // Should succeed now
      expect(writeQueue.getStats().failedCount).toBe(0)
      expect(writeQueue.getStats().totalSucceeded).toBe(1)

      saveEventSpy.mockRestore()
      vi.useRealTimers()
    })
  })

  describe("clearFailures", () => {
    it("should clear all failed writes", async () => {
      vi.useFakeTimers()

      // Mock saveEvent to always fail
      const saveEventSpy = vi
        .spyOn(eventDatabase, "saveEvent")
        .mockRejectedValue(new Error("IndexedDB error"))

      const event = createTestEvent()
      writeQueue.enqueue(event, "test-session")

      // Advance through all retries
      for (let i = 0; i < 6; i++) {
        await vi.advanceTimersByTimeAsync(10000)
      }

      expect(writeQueue.getStats().failedCount).toBe(1)

      // Clear failures
      writeQueue.clearFailures()

      expect(writeQueue.getStats().failedCount).toBe(0)
      expect(writeQueue.getStats().hasFailures).toBe(false)

      saveEventSpy.mockRestore()
      vi.useRealTimers()
    })
  })

  describe("reset", () => {
    it("should reset all state", async () => {
      const event = createTestEvent()
      writeQueue.enqueue(event, "test-session")

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 50))

      // Reset
      writeQueue.reset()

      const stats = writeQueue.getStats()
      expect(stats.pendingCount).toBe(0)
      expect(stats.failedCount).toBe(0)
      expect(stats.totalProcessed).toBe(0)
      expect(stats.totalSucceeded).toBe(0)
      expect(stats.totalFailed).toBe(0)

      const buffer = writeQueue.getRecentEventsBuffer()
      expect(buffer).toHaveLength(0)
    })
  })
})
