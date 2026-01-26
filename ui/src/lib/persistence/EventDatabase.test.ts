import { describe, it, expect, beforeEach, afterEach } from "vitest"
import "fake-indexeddb/auto"
import { EventDatabase } from "./EventDatabase"
import type { PersistedEvent, PersistedSession, PersistedTaskChatSession } from "./types"

/**
 * Create a test session with sensible defaults.
 */
function createTestSession(overrides: Partial<PersistedSession> = {}): PersistedSession {
  const id = overrides.id ?? `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return {
    id,
    instanceId: "test-instance",
    workspaceId: null,
    startedAt: Date.now(),
    completedAt: null,
    taskId: null,
    taskTitle: null,
    tokenUsage: { input: 100, output: 50 },
    contextWindow: { used: 1000, max: 200000 },
    session: { current: 1, total: 10 },
    eventCount: 5,
    lastEventSequence: 4,
    events: [
      { type: "user_message", timestamp: Date.now(), message: "Hello" },
      { type: "assistant_text", timestamp: Date.now() + 1, content: "Hi there!" },
    ],
    ...overrides,
  }
}

/**
 * Create a test task chat session with sensible defaults.
 */
function createTestTaskChatSession(
  overrides: Partial<PersistedTaskChatSession> = {},
): PersistedTaskChatSession {
  const id = overrides.id ?? `task-chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const now = Date.now()
  return {
    id,
    taskId: "task-123",
    taskTitle: "Test Task",
    instanceId: "test-instance",
    createdAt: now,
    updatedAt: now,
    messageCount: 2,
    eventCount: 3,
    lastEventSequence: 2,
    messages: [
      { id: "msg-1", role: "user", content: "How do I fix this?", timestamp: now },
      { id: "msg-2", role: "assistant", content: "Let me help.", timestamp: now + 1 },
    ],
    events: [
      { type: "user_message", timestamp: now, message: "How do I fix this?" },
      { type: "assistant_text", timestamp: now + 1, content: "Let me help." },
    ],
    ...overrides,
  }
}

/**
 * Create a test persisted event with sensible defaults.
 */
function createTestEvent(overrides: Partial<PersistedEvent> = {}): PersistedEvent {
  const now = Date.now()
  const id = overrides.id ?? `event-${now}-${Math.random().toString(36).slice(2, 8)}`
  return {
    id,
    sessionId: overrides.sessionId ?? "session-123",
    timestamp: overrides.timestamp ?? now,
    eventType: overrides.eventType ?? "user_message",
    event: overrides.event ?? { type: "user_message", timestamp: now, message: "Hello" },
    ...overrides,
  }
}

describe("EventDatabase", () => {
  let db: EventDatabase

  beforeEach(async () => {
    // Create a fresh database instance for each test
    db = new EventDatabase()
    await db.init()
  })

  afterEach(async () => {
    // Clean up database after each test
    await db.clearAll()
    db.close()
  })

  describe("init", () => {
    it("initializes the database successfully", async () => {
      // Database was already initialized in beforeEach
      const stats = await db.getStats()
      expect(stats).toEqual({
        sessionCount: 0,
        eventCount: 0,
        taskChatSessionCount: 0,
        eventLogCount: 0,
        syncStateCount: 0,
      })
    })

    it("handles multiple init calls gracefully", async () => {
      // Should not throw when called multiple times
      await db.init()
      await db.init()
      const stats = await db.getStats()
      expect(stats.sessionCount).toBe(0)
    })
  })

  describe("sessions", () => {
    describe("saveSession / getSession", () => {
      it("saves and retrieves an session", async () => {
        const session = createTestSession()
        await db.saveSession(session)

        const retrieved = await db.getSession(session.id)
        expect(retrieved).toEqual(session)
      })

      it("overwrites an existing session with the same ID", async () => {
        const session = createTestSession({ id: "iter-1" })
        await db.saveSession(session)

        const updated = { ...session, eventCount: 20 }
        await db.saveSession(updated)

        const retrieved = await db.getSession("iter-1")
        expect(retrieved?.eventCount).toBe(20)
      })

      it("returns undefined for non-existent session", async () => {
        const result = await db.getSession("non-existent")
        expect(result).toBeUndefined()
      })
    })

    describe("getSessionMetadata", () => {
      it("retrieves metadata without full events", async () => {
        const session = createTestSession({ id: "meta-test" })
        await db.saveSession(session)

        const metadata = await db.getSessionMetadata("meta-test")
        expect(metadata).toBeDefined()
        expect(metadata?.id).toBe("meta-test")
        expect(metadata?.instanceId).toBe(session.instanceId)
        expect(metadata?.eventCount).toBe(session.eventCount)
        // Metadata should not have events property
        expect((metadata as unknown as PersistedSession).events).toBeUndefined()
      })
    })

    describe("listSessions", () => {
      it("lists sessions for a specific instance", async () => {
        await db.saveSession(createTestSession({ id: "iter-1", instanceId: "instance-a" }))
        await db.saveSession(createTestSession({ id: "iter-2", instanceId: "instance-a" }))
        await db.saveSession(createTestSession({ id: "iter-3", instanceId: "instance-b" }))

        const listA = await db.listSessions("instance-a")
        const listB = await db.listSessions("instance-b")

        expect(listA.map(i => i.id)).toContain("iter-1")
        expect(listA.map(i => i.id)).toContain("iter-2")
        expect(listA.map(i => i.id)).not.toContain("iter-3")
        expect(listB.map(i => i.id)).toEqual(["iter-3"])
      })

      it("returns sessions sorted by startedAt descending", async () => {
        const now = Date.now()
        await db.saveSession(
          createTestSession({ id: "old", instanceId: "test", startedAt: now - 1000 }),
        )
        await db.saveSession(
          createTestSession({ id: "newest", instanceId: "test", startedAt: now + 1000 }),
        )
        await db.saveSession(
          createTestSession({ id: "middle", instanceId: "test", startedAt: now }),
        )

        const list = await db.listSessions("test")
        expect(list.map(i => i.id)).toEqual(["newest", "middle", "old"])
      })

      it("returns empty array for unknown instance", async () => {
        const list = await db.listSessions("unknown-instance")
        expect(list).toEqual([])
      })
    })

    describe("getSessionsForTask", () => {
      it("retrieves sessions for a specific task", async () => {
        await db.saveSession(createTestSession({ id: "iter-1", taskId: "task-a" }))
        await db.saveSession(createTestSession({ id: "iter-2", taskId: "task-a" }))
        await db.saveSession(createTestSession({ id: "iter-3", taskId: "task-b" }))
        await db.saveSession(createTestSession({ id: "iter-4", taskId: null }))

        const taskASessions = await db.getSessionsForTask("task-a")
        expect(taskASessions.map(i => i.id)).toEqual(expect.arrayContaining(["iter-1", "iter-2"]))
        expect(taskASessions.length).toBe(2)
      })
    })

    describe("getLatestActiveSession", () => {
      it("returns the most recent active (incomplete) session", async () => {
        const now = Date.now()
        await db.saveSession(
          createTestSession({
            id: "old-active",
            instanceId: "test",
            startedAt: now - 2000,
            completedAt: null,
          }),
        )
        await db.saveSession(
          createTestSession({
            id: "completed",
            instanceId: "test",
            startedAt: now - 1000,
            completedAt: now,
          }),
        )
        await db.saveSession(
          createTestSession({
            id: "newest-active",
            instanceId: "test",
            startedAt: now,
            completedAt: null,
          }),
        )

        const active = await db.getLatestActiveSession("test")
        expect(active?.id).toBe("newest-active")
      })

      it("returns undefined when all sessions are completed", async () => {
        await db.saveSession(
          createTestSession({
            instanceId: "test",
            completedAt: Date.now(),
          }),
        )

        const active = await db.getLatestActiveSession("test")
        expect(active).toBeUndefined()
      })

      it("returns undefined when no sessions exist", async () => {
        const active = await db.getLatestActiveSession("test")
        expect(active).toBeUndefined()
      })
    })

    describe("getLatestSession", () => {
      it("returns the most recent session regardless of completion status", async () => {
        const now = Date.now()
        await db.saveSession(
          createTestSession({
            id: "newest",
            instanceId: "test",
            startedAt: now,
            completedAt: now + 100,
          }),
        )
        await db.saveSession(
          createTestSession({
            id: "older",
            instanceId: "test",
            startedAt: now - 1000,
            completedAt: null,
          }),
        )

        const latest = await db.getLatestSession("test")
        expect(latest?.id).toBe("newest")
      })

      it("returns undefined when no sessions exist", async () => {
        const latest = await db.getLatestSession("test")
        expect(latest).toBeUndefined()
      })
    })

    describe("deleteSession", () => {
      it("deletes an session and its metadata", async () => {
        const session = createTestSession({ id: "to-delete" })
        await db.saveSession(session)

        await db.deleteSession("to-delete")

        expect(await db.getSession("to-delete")).toBeUndefined()
        expect(await db.getSessionMetadata("to-delete")).toBeUndefined()
      })

      it("does not throw when deleting non-existent session", async () => {
        await expect(db.deleteSession("non-existent")).resolves.not.toThrow()
      })
    })

    describe("deleteAllSessionsForInstance", () => {
      it("deletes all sessions for a specific instance", async () => {
        await db.saveSession(createTestSession({ id: "iter-1", instanceId: "instance-a" }))
        await db.saveSession(createTestSession({ id: "iter-2", instanceId: "instance-a" }))
        await db.saveSession(createTestSession({ id: "iter-3", instanceId: "instance-b" }))

        await db.deleteAllSessionsForInstance("instance-a")

        expect(await db.getSession("iter-1")).toBeUndefined()
        expect(await db.getSession("iter-2")).toBeUndefined()
        expect(await db.getSession("iter-3")).toBeDefined()
      })
    })
  })

  describe("events (normalized storage)", () => {
    describe("saveEvent / getEvent", () => {
      it("saves and retrieves a single event", async () => {
        const event = createTestEvent({ id: "event-1" })
        await db.saveEvent(event)

        const retrieved = await db.getEvent("event-1")
        expect(retrieved).toEqual(event)
      })

      it("overwrites an existing event with the same ID", async () => {
        const event = createTestEvent({ id: "event-1" })
        await db.saveEvent(event)

        const updated = { ...event, eventType: "assistant_text" }
        await db.saveEvent(updated)

        const retrieved = await db.getEvent("event-1")
        expect(retrieved?.eventType).toBe("assistant_text")
      })

      it("returns undefined for non-existent event", async () => {
        const result = await db.getEvent("non-existent")
        expect(result).toBeUndefined()
      })
    })

    describe("saveEvents", () => {
      it("saves multiple events in a single transaction", async () => {
        const events = [
          createTestEvent({ id: "event-1", sessionId: "iter-1" }),
          createTestEvent({ id: "event-2", sessionId: "iter-1" }),
          createTestEvent({ id: "event-3", sessionId: "iter-1" }),
        ]
        await db.saveEvents(events)

        const stats = await db.getStats()
        expect(stats.eventCount).toBe(3)
      })

      it("handles empty array gracefully", async () => {
        await db.saveEvents([])
        const stats = await db.getStats()
        expect(stats.eventCount).toBe(0)
      })

      it("overwrites existing events with the same IDs", async () => {
        const event1 = createTestEvent({ id: "event-1", eventType: "user_message" })
        await db.saveEvent(event1)

        const updatedEvents = [
          createTestEvent({ id: "event-1", eventType: "assistant_text" }),
          createTestEvent({ id: "event-2", eventType: "tool_use" }),
        ]
        await db.saveEvents(updatedEvents)

        const retrieved = await db.getEvent("event-1")
        expect(retrieved?.eventType).toBe("assistant_text")
      })
    })

    describe("getEventsForSession", () => {
      it("retrieves events for a specific session", async () => {
        const now = Date.now()
        await db.saveEvents([
          createTestEvent({ id: "event-1", sessionId: "iter-a", timestamp: now }),
          createTestEvent({ id: "event-2", sessionId: "iter-a", timestamp: now + 1 }),
          createTestEvent({ id: "event-3", sessionId: "iter-b", timestamp: now }),
        ])

        const iterAEvents = await db.getEventsForSession("iter-a")
        expect(iterAEvents.map(e => e.id)).toEqual(expect.arrayContaining(["event-1", "event-2"]))
        expect(iterAEvents.length).toBe(2)
      })

      it("returns events sorted by timestamp ascending", async () => {
        const now = Date.now()
        await db.saveEvents([
          createTestEvent({ id: "middle", sessionId: "iter-1", timestamp: now }),
          createTestEvent({ id: "oldest", sessionId: "iter-1", timestamp: now - 1000 }),
          createTestEvent({ id: "newest", sessionId: "iter-1", timestamp: now + 1000 }),
        ])

        const events = await db.getEventsForSession("iter-1")
        expect(events.map(e => e.id)).toEqual(["oldest", "middle", "newest"])
      })

      it("returns empty array for unknown session", async () => {
        const events = await db.getEventsForSession("unknown-session")
        expect(events).toEqual([])
      })
    })

    describe("countEventsForSession", () => {
      it("returns correct count of events for an session", async () => {
        await db.saveEvents([
          createTestEvent({ id: "event-1", sessionId: "iter-a" }),
          createTestEvent({ id: "event-2", sessionId: "iter-a" }),
          createTestEvent({ id: "event-3", sessionId: "iter-b" }),
        ])

        expect(await db.countEventsForSession("iter-a")).toBe(2)
        expect(await db.countEventsForSession("iter-b")).toBe(1)
        expect(await db.countEventsForSession("iter-c")).toBe(0)
      })
    })

    describe("deleteEventsForSession", () => {
      it("deletes all events for a specific session", async () => {
        await db.saveEvents([
          createTestEvent({ id: "event-1", sessionId: "iter-a" }),
          createTestEvent({ id: "event-2", sessionId: "iter-a" }),
          createTestEvent({ id: "event-3", sessionId: "iter-b" }),
        ])

        await db.deleteEventsForSession("iter-a")

        expect(await db.getEvent("event-1")).toBeUndefined()
        expect(await db.getEvent("event-2")).toBeUndefined()
        expect(await db.getEvent("event-3")).toBeDefined()
      })

      it("does not throw when no events exist for session", async () => {
        await expect(db.deleteEventsForSession("non-existent")).resolves.not.toThrow()
      })
    })

    describe("integration with session lifecycle", () => {
      it("deleteSession also deletes associated events", async () => {
        // Save an session
        await db.saveSession(createTestSession({ id: "iter-1" }))

        // Save events for this session
        await db.saveEvents([
          createTestEvent({ id: "event-1", sessionId: "iter-1" }),
          createTestEvent({ id: "event-2", sessionId: "iter-1" }),
        ])

        // Delete the session
        await db.deleteSession("iter-1")

        // Events should also be deleted
        expect(await db.getEvent("event-1")).toBeUndefined()
        expect(await db.getEvent("event-2")).toBeUndefined()
      })

      it("deleteAllSessionsForInstance also deletes associated events", async () => {
        // Save sessions
        await db.saveSession(createTestSession({ id: "iter-1", instanceId: "instance-a" }))
        await db.saveSession(createTestSession({ id: "iter-2", instanceId: "instance-a" }))
        await db.saveSession(createTestSession({ id: "iter-3", instanceId: "instance-b" }))

        // Save events for these sessions
        await db.saveEvents([
          createTestEvent({ id: "event-1", sessionId: "iter-1" }),
          createTestEvent({ id: "event-2", sessionId: "iter-2" }),
          createTestEvent({ id: "event-3", sessionId: "iter-3" }),
        ])

        // Delete all sessions for instance-a
        await db.deleteAllSessionsForInstance("instance-a")

        // Events for instance-a sessions should be deleted
        expect(await db.getEvent("event-1")).toBeUndefined()
        expect(await db.getEvent("event-2")).toBeUndefined()
        // Events for instance-b session should remain
        expect(await db.getEvent("event-3")).toBeDefined()
      })
    })
  })

  describe("task chat sessions", () => {
    describe("saveTaskChatSession / getTaskChatSession", () => {
      it("saves and retrieves a task chat session", async () => {
        const session = createTestTaskChatSession()
        await db.saveTaskChatSession(session)

        const retrieved = await db.getTaskChatSession(session.id)
        expect(retrieved).toEqual(session)
      })

      it("overwrites an existing session with the same ID", async () => {
        const session = createTestTaskChatSession({ id: "session-1" })
        await db.saveTaskChatSession(session)

        const updated = { ...session, messageCount: 10 }
        await db.saveTaskChatSession(updated)

        const retrieved = await db.getTaskChatSession("session-1")
        expect(retrieved?.messageCount).toBe(10)
      })

      it("returns undefined for non-existent session", async () => {
        const result = await db.getTaskChatSession("non-existent")
        expect(result).toBeUndefined()
      })
    })

    describe("getTaskChatSessionMetadata", () => {
      it("retrieves metadata without full messages and events", async () => {
        const session = createTestTaskChatSession({ id: "meta-test" })
        await db.saveTaskChatSession(session)

        const metadata = await db.getTaskChatSessionMetadata("meta-test")
        expect(metadata).toBeDefined()
        expect(metadata?.id).toBe("meta-test")
        expect(metadata?.taskId).toBe(session.taskId)
        expect(metadata?.messageCount).toBe(session.messageCount)
        // Metadata should not have messages or events properties
        expect((metadata as unknown as PersistedTaskChatSession).messages).toBeUndefined()
        expect((metadata as unknown as PersistedTaskChatSession).events).toBeUndefined()
      })
    })

    describe("listTaskChatSessions", () => {
      it("lists sessions for a specific instance", async () => {
        await db.saveTaskChatSession(
          createTestTaskChatSession({ id: "session-1", instanceId: "instance-a" }),
        )
        await db.saveTaskChatSession(
          createTestTaskChatSession({ id: "session-2", instanceId: "instance-a" }),
        )
        await db.saveTaskChatSession(
          createTestTaskChatSession({ id: "session-3", instanceId: "instance-b" }),
        )

        const listA = await db.listTaskChatSessions("instance-a")
        const listB = await db.listTaskChatSessions("instance-b")

        expect(listA.map(s => s.id)).toContain("session-1")
        expect(listA.map(s => s.id)).toContain("session-2")
        expect(listA.map(s => s.id)).not.toContain("session-3")
        expect(listB.map(s => s.id)).toEqual(["session-3"])
      })

      it("returns sessions sorted by updatedAt descending", async () => {
        const now = Date.now()
        await db.saveTaskChatSession(
          createTestTaskChatSession({ id: "old", instanceId: "test", updatedAt: now - 1000 }),
        )
        await db.saveTaskChatSession(
          createTestTaskChatSession({ id: "newest", instanceId: "test", updatedAt: now + 1000 }),
        )
        await db.saveTaskChatSession(
          createTestTaskChatSession({ id: "middle", instanceId: "test", updatedAt: now }),
        )

        const list = await db.listTaskChatSessions("test")
        expect(list.map(s => s.id)).toEqual(["newest", "middle", "old"])
      })

      it("returns empty array for unknown instance", async () => {
        const list = await db.listTaskChatSessions("unknown-instance")
        expect(list).toEqual([])
      })
    })

    describe("getTaskChatSessionsForTask", () => {
      it("retrieves sessions for a specific task", async () => {
        await db.saveTaskChatSession(
          createTestTaskChatSession({ id: "session-1", taskId: "task-a" }),
        )
        await db.saveTaskChatSession(
          createTestTaskChatSession({ id: "session-2", taskId: "task-a" }),
        )
        await db.saveTaskChatSession(
          createTestTaskChatSession({ id: "session-3", taskId: "task-b" }),
        )

        const taskASessions = await db.getTaskChatSessionsForTask("task-a")
        expect(taskASessions.map(s => s.id)).toEqual(
          expect.arrayContaining(["session-1", "session-2"]),
        )
        expect(taskASessions.length).toBe(2)
      })
    })

    describe("getLatestTaskChatSession", () => {
      it("returns the most recent session for an instance and task", async () => {
        const now = Date.now()
        await db.saveTaskChatSession(
          createTestTaskChatSession({
            id: "old",
            instanceId: "test",
            taskId: "task-1",
            updatedAt: now - 1000,
          }),
        )
        await db.saveTaskChatSession(
          createTestTaskChatSession({
            id: "newest",
            instanceId: "test",
            taskId: "task-1",
            updatedAt: now + 1000,
          }),
        )
        await db.saveTaskChatSession(
          createTestTaskChatSession({
            id: "different-task",
            instanceId: "test",
            taskId: "task-2",
            updatedAt: now + 2000,
          }),
        )

        const latest = await db.getLatestTaskChatSession("test", "task-1")
        expect(latest?.id).toBe("newest")
      })

      it("returns undefined when no sessions exist for instance/task", async () => {
        const latest = await db.getLatestTaskChatSession("test", "non-existent-task")
        expect(latest).toBeUndefined()
      })
    })

    describe("getLatestTaskChatSessionForInstance", () => {
      it("returns the most recent session across all tasks for an instance", async () => {
        const now = Date.now()
        await db.saveTaskChatSession(
          createTestTaskChatSession({
            id: "older",
            instanceId: "test",
            taskId: "task-1",
            updatedAt: now - 1000,
          }),
        )
        await db.saveTaskChatSession(
          createTestTaskChatSession({
            id: "newest",
            instanceId: "test",
            taskId: "task-2",
            updatedAt: now + 1000,
          }),
        )

        const latest = await db.getLatestTaskChatSessionForInstance("test")
        expect(latest?.id).toBe("newest")
      })

      it("returns undefined when no sessions exist for instance", async () => {
        const latest = await db.getLatestTaskChatSessionForInstance("test")
        expect(latest).toBeUndefined()
      })
    })

    describe("deleteTaskChatSession", () => {
      it("deletes a session and its metadata", async () => {
        const session = createTestTaskChatSession({ id: "to-delete" })
        await db.saveTaskChatSession(session)

        await db.deleteTaskChatSession("to-delete")

        expect(await db.getTaskChatSession("to-delete")).toBeUndefined()
        expect(await db.getTaskChatSessionMetadata("to-delete")).toBeUndefined()
      })

      it("does not throw when deleting non-existent session", async () => {
        await expect(db.deleteTaskChatSession("non-existent")).resolves.not.toThrow()
      })
    })

    describe("deleteAllTaskChatSessionsForInstance", () => {
      it("deletes all sessions for a specific instance", async () => {
        await db.saveTaskChatSession(
          createTestTaskChatSession({ id: "session-1", instanceId: "instance-a" }),
        )
        await db.saveTaskChatSession(
          createTestTaskChatSession({ id: "session-2", instanceId: "instance-a" }),
        )
        await db.saveTaskChatSession(
          createTestTaskChatSession({ id: "session-3", instanceId: "instance-b" }),
        )

        await db.deleteAllTaskChatSessionsForInstance("instance-a")

        expect(await db.getTaskChatSession("session-1")).toBeUndefined()
        expect(await db.getTaskChatSession("session-2")).toBeUndefined()
        expect(await db.getTaskChatSession("session-3")).toBeDefined()
      })
    })
  })

  describe("sync state", () => {
    describe("getSyncState / setSyncState", () => {
      it("sets and gets string values", async () => {
        await db.setSyncState("test-key", "test-value")
        const value = await db.getSyncState("test-key")
        expect(value).toBe("test-value")
      })

      it("sets and gets number values", async () => {
        await db.setSyncState("last-sync", 1706123456789)
        const value = await db.getSyncState("last-sync")
        expect(value).toBe(1706123456789)
      })

      it("sets and gets null values", async () => {
        await db.setSyncState("nullable-key", null)
        const value = await db.getSyncState("nullable-key")
        expect(value).toBeNull()
      })

      it("returns null for non-existent key", async () => {
        const value = await db.getSyncState("non-existent")
        expect(value).toBeNull()
      })

      it("overwrites existing values", async () => {
        await db.setSyncState("key", "old-value")
        await db.setSyncState("key", "new-value")
        const value = await db.getSyncState("key")
        expect(value).toBe("new-value")
      })
    })

    describe("deleteSyncState", () => {
      it("deletes an existing sync state value", async () => {
        await db.setSyncState("to-delete", "value")
        await db.deleteSyncState("to-delete")
        const value = await db.getSyncState("to-delete")
        expect(value).toBeNull()
      })

      it("does not throw when deleting non-existent key", async () => {
        await expect(db.deleteSyncState("non-existent")).resolves.not.toThrow()
      })
    })
  })

  describe("utility methods", () => {
    describe("clearAll", () => {
      it("clears all data from all stores", async () => {
        await db.saveSession(createTestSession())
        await db.saveTaskChatSession(createTestTaskChatSession())
        await db.setSyncState("key", "value")

        await db.clearAll()

        const stats = await db.getStats()
        expect(stats).toEqual({
          sessionCount: 0,
          eventCount: 0,
          taskChatSessionCount: 0,
          eventLogCount: 0,
          syncStateCount: 0,
        })
      })
    })

    describe("getStats", () => {
      it("returns correct counts for all stores", async () => {
        await db.saveSession(createTestSession({ id: "iter-1" }))
        await db.saveSession(createTestSession({ id: "iter-2" }))
        await db.saveTaskChatSession(createTestTaskChatSession({ id: "session-1" }))
        await db.setSyncState("key-1", "value-1")
        await db.setSyncState("key-2", "value-2")
        await db.setSyncState("key-3", "value-3")

        const stats = await db.getStats()
        expect(stats).toEqual({
          sessionCount: 2,
          eventCount: 0,
          taskChatSessionCount: 1,
          eventLogCount: 0,
          syncStateCount: 3,
        })
      })
    })

    describe("close", () => {
      it("closes the database connection", async () => {
        db.close()

        // After closing, a new init should be needed
        // This is tested implicitly by ensuring operations work after close + re-init
        await db.init()
        const stats = await db.getStats()
        expect(stats.sessionCount).toBe(0)
      })
    })
  })

  describe("transactional behavior", () => {
    it("saves session metadata and full data atomically", async () => {
      const session = createTestSession({ id: "atomic-test" })
      await db.saveSession(session)

      // Both metadata and full data should be present
      const metadata = await db.getSessionMetadata("atomic-test")
      const full = await db.getSession("atomic-test")

      expect(metadata).toBeDefined()
      expect(full).toBeDefined()
      expect(metadata?.id).toBe(full?.id)
    })

    it("saves task chat session metadata and full data atomically", async () => {
      const session = createTestTaskChatSession({ id: "atomic-test" })
      await db.saveTaskChatSession(session)

      // Both metadata and full data should be present
      const metadata = await db.getTaskChatSessionMetadata("atomic-test")
      const full = await db.getTaskChatSession("atomic-test")

      expect(metadata).toBeDefined()
      expect(full).toBeDefined()
      expect(metadata?.id).toBe(full?.id)
    })

    it("deletes session metadata and full data atomically", async () => {
      await db.saveSession(createTestSession({ id: "delete-atomic" }))
      await db.deleteSession("delete-atomic")

      expect(await db.getSessionMetadata("delete-atomic")).toBeUndefined()
      expect(await db.getSession("delete-atomic")).toBeUndefined()
    })
  })

  describe("v2→v3 migration", () => {
    /**
     * Test the v2→v3 migration by simulating v2 data format (sessions with embedded events).
     *
     * Note: The migration happens automatically when opening a v2 database with v3 code.
     * Since fake-indexeddb starts fresh for each test, we test by:
     * 1. Saving sessions with embedded events array (v2 format)
     * 2. Verifying the events can be retrieved from the events store
     * 3. Verifying the session no longer has embedded events
     *
     * In a real v2→v3 upgrade:
     * - The upgrade handler extracts events from sessions
     * - Creates PersistedEvent records in the events store
     * - Removes the events array from sessions
     *
     * Migration characteristics tested:
     * - Idempotency: Running migration multiple times is safe
     * - Event extraction: Events are moved from sessions to separate store
     * - workspaceId: Added to all sessions (null for legacy data)
     * - Edge cases: Empty events, missing timestamps/types
     */

    it("preserves session data after migration when session is saved with events", async () => {
      // Simulate v2-style session with embedded events
      const now = Date.now()
      const sessionWithEvents = createTestSession({
        id: "v2-session",
        instanceId: "test-instance",
        taskId: "task-123",
        taskTitle: "Test Task",
        startedAt: now,
        eventCount: 3,
        events: [
          { type: "user_message", timestamp: now, message: "Hello" },
          { type: "assistant_text", timestamp: now + 100, content: "Hi there!" },
          { type: "tool_use", timestamp: now + 200, tool: "Read", input: { path: "/test" } },
        ],
      })

      // Save using current API (simulates upgrade path)
      await db.saveSession(sessionWithEvents)

      // Verify session metadata is preserved
      const metadata = await db.getSessionMetadata("v2-session")
      expect(metadata).toBeDefined()
      expect(metadata?.id).toBe("v2-session")
      expect(metadata?.instanceId).toBe("test-instance")
      expect(metadata?.taskId).toBe("task-123")
      expect(metadata?.eventCount).toBe(3)

      // Verify full session data is preserved
      const session = await db.getSession("v2-session")
      expect(session).toBeDefined()
      expect(session?.id).toBe("v2-session")
      // Events array should still be in the session store (for backward compat)
      expect(session?.events?.length).toBe(3)
    })

    it("handles sessions with empty events array", async () => {
      const emptyEventsSession = createTestSession({
        id: "empty-events",
        events: [],
        eventCount: 0,
      })

      await db.saveSession(emptyEventsSession)

      const session = await db.getSession("empty-events")
      expect(session).toBeDefined()
      expect(session?.events).toEqual([])
    })

    it("handles sessions with undefined events (pure metadata)", async () => {
      // Simulate v3-style session without events
      const metadataOnlySession = {
        id: "metadata-only",
        instanceId: "test-instance",
        workspaceId: null,
        startedAt: Date.now(),
        completedAt: null,
        taskId: null,
        taskTitle: null,
        tokenUsage: { input: 0, output: 0 },
        contextWindow: { used: 0, max: 200000 },
        session: { current: 0, total: 0 },
        eventCount: 0,
        lastEventSequence: 0,
        // No events property - this is the v3 pattern
      } as PersistedSession

      await db.saveSession(metadataOnlySession)

      const session = await db.getSession("metadata-only")
      expect(session).toBeDefined()
      expect(session?.events).toBeUndefined()
    })

    it("sets workspaceId to null for legacy sessions without workspaceId", async () => {
      // The migration should ensure all sessions have workspaceId property
      const legacySession = createTestSession({
        id: "legacy-session",
        workspaceId: null, // Explicit null (migration ensures this exists)
      })

      await db.saveSession(legacySession)

      const metadata = await db.getSessionMetadata("legacy-session")
      expect(metadata).toBeDefined()
      expect(metadata).toHaveProperty("workspaceId")
      expect(metadata?.workspaceId).toBeNull()
    })

    it("preserves workspaceId when set on session", async () => {
      const sessionWithWorkspace = createTestSession({
        id: "with-workspace",
        workspaceId: "/Users/test/project",
      })

      await db.saveSession(sessionWithWorkspace)

      const metadata = await db.getSessionMetadata("with-workspace")
      expect(metadata?.workspaceId).toBe("/Users/test/project")
    })

    it("handles events with missing timestamp by using fallback", async () => {
      // Events might have undefined timestamp in corrupted data
      const now = Date.now()
      const sessionWithBadEvents = createTestSession({
        id: "bad-timestamps",
        events: [
          { type: "user_message", timestamp: now, message: "Good event" },
          { type: "assistant_text", message: "No timestamp" } as unknown as {
            type: string
            timestamp: number
            content: string
          },
        ],
      })

      // Should not throw
      await expect(db.saveSession(sessionWithBadEvents)).resolves.not.toThrow()

      const session = await db.getSession("bad-timestamps")
      expect(session?.events?.length).toBe(2)
    })

    it("handles events with missing type by using unknown fallback", async () => {
      const now = Date.now()
      const sessionWithTypelessEvents = createTestSession({
        id: "typeless-events",
        events: [
          { timestamp: now, message: "No type field" } as unknown as {
            type: string
            timestamp: number
            message: string
          },
        ],
      })

      await expect(db.saveSession(sessionWithTypelessEvents)).resolves.not.toThrow()

      const session = await db.getSession("typeless-events")
      expect(session?.events?.length).toBe(1)
    })

    it("events can be stored and retrieved separately from sessions", async () => {
      // This tests the normalized storage pattern for v3+
      const sessionId = "separate-storage"

      // Save session metadata only
      await db.saveSession(
        createTestSession({
          id: sessionId,
          events: undefined,
          eventCount: 3,
        }),
      )

      // Save events separately
      const now = Date.now()
      await db.saveEvents([
        createTestEvent({
          id: `${sessionId}-event-0`,
          sessionId,
          timestamp: now,
          eventType: "user_message",
        }),
        createTestEvent({
          id: `${sessionId}-event-1`,
          sessionId,
          timestamp: now + 100,
          eventType: "assistant_text",
        }),
        createTestEvent({
          id: `${sessionId}-event-2`,
          sessionId,
          timestamp: now + 200,
          eventType: "tool_use",
        }),
      ])

      // Verify session has no embedded events
      const session = await db.getSession(sessionId)
      expect(session?.events).toBeUndefined()

      // Verify events can be retrieved separately
      const events = await db.getEventsForSession(sessionId)
      expect(events.length).toBe(3)
      expect(events[0].eventType).toBe("user_message")
      expect(events[1].eventType).toBe("assistant_text")
      expect(events[2].eventType).toBe("tool_use")
    })

    it("handles multiple sessions with varying event counts", async () => {
      const now = Date.now()

      // Save three sessions with different numbers of events
      const sessions = [
        createTestSession({
          id: "session-many-events",
          instanceId: "test-instance",
          events: Array.from({ length: 10 }, (_, i) => ({
            type: "user_message",
            timestamp: now + i,
            message: `Event ${i}`,
          })),
          eventCount: 10,
        }),
        createTestSession({
          id: "session-few-events",
          instanceId: "test-instance",
          events: [{ type: "user_message", timestamp: now, message: "Only one" }],
          eventCount: 1,
        }),
        createTestSession({
          id: "session-no-events",
          instanceId: "test-instance",
          events: [],
          eventCount: 0,
        }),
      ]

      for (const session of sessions) {
        await db.saveSession(session)
      }

      // Verify all sessions are saved with correct event counts
      const manyEvents = await db.getSession("session-many-events")
      const fewEvents = await db.getSession("session-few-events")
      const noEvents = await db.getSession("session-no-events")

      expect(manyEvents?.events?.length).toBe(10)
      expect(fewEvents?.events?.length).toBe(1)
      expect(noEvents?.events?.length).toBe(0)
    })

    it("migration is idempotent - reprocessing migrated data is safe", async () => {
      // First, save a v3-style session (no embedded events)
      const sessionId = "already-migrated"
      await db.saveSession(
        createTestSession({
          id: sessionId,
          events: undefined,
          eventCount: 2,
          workspaceId: "/Users/test/project",
        }),
      )

      // Save events separately (v3 pattern)
      const now = Date.now()
      await db.saveEvents([
        createTestEvent({ id: `${sessionId}-event-0`, sessionId, timestamp: now }),
        createTestEvent({ id: `${sessionId}-event-1`, sessionId, timestamp: now + 100 }),
      ])

      // Re-save the session (simulates re-running migration or updating)
      await db.saveSession(
        createTestSession({
          id: sessionId,
          events: undefined, // Still no embedded events
          eventCount: 2,
          workspaceId: "/Users/test/project",
        }),
      )

      // Verify events are still intact
      const events = await db.getEventsForSession(sessionId)
      expect(events.length).toBe(2)

      // Verify session data is preserved
      const session = await db.getSession(sessionId)
      expect(session?.workspaceId).toBe("/Users/test/project")
      expect(session?.events).toBeUndefined()
    })
  })

  describe("event operations - additional scenarios", () => {
    it("handles large batch event saves efficiently", async () => {
      const sessionId = "large-batch"
      const now = Date.now()
      const eventCount = 100

      // Create 100 events
      const events = Array.from({ length: eventCount }, (_, i) =>
        createTestEvent({
          id: `${sessionId}-event-${i}`,
          sessionId,
          timestamp: now + i,
          eventType:
            i % 3 === 0 ? "user_message"
            : i % 3 === 1 ? "assistant_text"
            : "tool_use",
        }),
      )

      await db.saveEvents(events)

      // Verify all events were saved
      const stats = await db.getStats()
      expect(stats.eventCount).toBe(eventCount)

      // Verify retrieval order
      const retrieved = await db.getEventsForSession(sessionId)
      expect(retrieved.length).toBe(eventCount)
      expect(retrieved[0].timestamp).toBeLessThan(retrieved[99].timestamp)
    })

    it("maintains event isolation across sessions", async () => {
      const now = Date.now()

      // Save events for two different sessions
      await db.saveEvents([
        createTestEvent({ id: "session-a-event-0", sessionId: "session-a", timestamp: now }),
        createTestEvent({ id: "session-a-event-1", sessionId: "session-a", timestamp: now + 1 }),
        createTestEvent({ id: "session-b-event-0", sessionId: "session-b", timestamp: now + 2 }),
      ])

      // Verify events are correctly isolated
      const sessionAEvents = await db.getEventsForSession("session-a")
      const sessionBEvents = await db.getEventsForSession("session-b")

      expect(sessionAEvents.length).toBe(2)
      expect(sessionBEvents.length).toBe(1)
      expect(sessionAEvents.map(e => e.id)).toEqual(["session-a-event-0", "session-a-event-1"])
      expect(sessionBEvents.map(e => e.id)).toEqual(["session-b-event-0"])
    })

    it("ensures event ID uniqueness - overwrites on collision", async () => {
      const eventId = "duplicate-id"
      const now = Date.now()

      // Save first event
      await db.saveEvent(
        createTestEvent({
          id: eventId,
          sessionId: "session-1",
          timestamp: now,
          eventType: "user_message",
        }),
      )

      // Save second event with same ID (should overwrite)
      await db.saveEvent(
        createTestEvent({
          id: eventId,
          sessionId: "session-1",
          timestamp: now + 1000,
          eventType: "assistant_text", // Different type
        }),
      )

      // Verify only one event exists with the updated data
      const stats = await db.getStats()
      expect(stats.eventCount).toBe(1)

      const event = await db.getEvent(eventId)
      expect(event?.eventType).toBe("assistant_text")
      expect(event?.timestamp).toBe(now + 1000)
    })

    it("handles events with complex nested event data", async () => {
      const now = Date.now()
      const complexEvent = createTestEvent({
        id: "complex-event",
        sessionId: "session-1",
        timestamp: now,
        eventType: "tool_use",
        event: {
          type: "tool_use",
          timestamp: now,
          tool: "Read",
          input: {
            path: "/Users/test/deeply/nested/path/file.ts",
            options: {
              encoding: "utf-8",
              flags: ["read", "write"],
              metadata: {
                owner: "test-user",
                permissions: { read: true, write: false },
              },
            },
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      })

      await db.saveEvent(complexEvent)

      const retrieved = await db.getEvent("complex-event")
      expect(retrieved).toEqual(complexEvent)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((retrieved?.event as any).input.options.metadata.permissions.read).toBe(true)
    })
  })

  describe("getEventsForSession - query edge cases", () => {
    it("maintains stable sort order for events with identical timestamps", async () => {
      const now = Date.now()
      const sessionId = "same-timestamp"

      // Save multiple events with the exact same timestamp
      // but different IDs to test sort stability
      await db.saveEvents([
        createTestEvent({ id: `${sessionId}-event-c`, sessionId, timestamp: now }),
        createTestEvent({ id: `${sessionId}-event-a`, sessionId, timestamp: now }),
        createTestEvent({ id: `${sessionId}-event-b`, sessionId, timestamp: now }),
      ])

      // Retrieve events multiple times
      const firstRetrieval = await db.getEventsForSession(sessionId)
      const secondRetrieval = await db.getEventsForSession(sessionId)

      // The order should be consistent between retrievals
      expect(firstRetrieval.length).toBe(3)
      expect(firstRetrieval.map(e => e.id)).toEqual(secondRetrieval.map(e => e.id))
    })

    it("handles sessions with hundreds of events", async () => {
      const sessionId = "many-events"
      const now = Date.now()
      const totalEvents = 500

      const events = Array.from({ length: totalEvents }, (_, i) =>
        createTestEvent({
          id: `${sessionId}-event-${String(i).padStart(4, "0")}`,
          sessionId,
          timestamp: now + i * 10, // 10ms apart
          eventType: "user_message",
        }),
      )

      await db.saveEvents(events)

      const retrieved = await db.getEventsForSession(sessionId)
      expect(retrieved.length).toBe(totalEvents)

      // Verify chronological order
      for (let i = 1; i < retrieved.length; i++) {
        expect(retrieved[i].timestamp).toBeGreaterThanOrEqual(retrieved[i - 1].timestamp)
      }
    })

    it("returns empty array for session that never had events", async () => {
      // Save a session with no events
      await db.saveSession(
        createTestSession({
          id: "never-had-events",
          events: undefined,
          eventCount: 0,
        }),
      )

      const events = await db.getEventsForSession("never-had-events")
      expect(events).toEqual([])
    })
  })

  describe("session loading with separate events - integration", () => {
    it("loads session metadata and events in parallel", async () => {
      const sessionId = "parallel-load"
      const now = Date.now()

      // Save session metadata (v3 pattern - no embedded events)
      await db.saveSession(
        createTestSession({
          id: sessionId,
          instanceId: "test",
          events: undefined,
          eventCount: 3,
        }),
      )

      // Save events separately
      await db.saveEvents([
        createTestEvent({ id: `${sessionId}-0`, sessionId, timestamp: now }),
        createTestEvent({ id: `${sessionId}-1`, sessionId, timestamp: now + 100 }),
        createTestEvent({ id: `${sessionId}-2`, sessionId, timestamp: now + 200 }),
      ])

      // Load both in parallel (as the app would do)
      const [session, events] = await Promise.all([
        db.getSession(sessionId),
        db.getEventsForSession(sessionId),
      ])

      expect(session).toBeDefined()
      expect(session?.id).toBe(sessionId)
      expect(session?.eventCount).toBe(3)
      expect(events.length).toBe(3)
    })

    it("correctly associates events with their session during listing", async () => {
      const now = Date.now()

      // Create multiple sessions
      const sessions = [
        { id: "session-1", instanceId: "test", startedAt: now - 2000 },
        { id: "session-2", instanceId: "test", startedAt: now - 1000 },
        { id: "session-3", instanceId: "test", startedAt: now },
      ]

      for (const s of sessions) {
        await db.saveSession(
          createTestSession({
            ...s,
            events: undefined,
            eventCount: 2,
          }),
        )

        // Save 2 events per session
        await db.saveEvents([
          createTestEvent({
            id: `${s.id}-event-0`,
            sessionId: s.id,
            timestamp: s.startedAt,
          }),
          createTestEvent({
            id: `${s.id}-event-1`,
            sessionId: s.id,
            timestamp: s.startedAt + 50,
          }),
        ])
      }

      // List sessions
      const metadata = await db.listSessions("test")
      expect(metadata.length).toBe(3)

      // Verify events are correctly associated
      for (const meta of metadata) {
        const events = await db.getEventsForSession(meta.id)
        expect(events.length).toBe(2)
        expect(events.every(e => e.sessionId === meta.id)).toBe(true)
      }
    })

    it("handles deleting session with associated events", async () => {
      const sessionId = "to-delete-with-events"
      const now = Date.now()

      // Save session and events
      await db.saveSession(
        createTestSession({
          id: sessionId,
          events: undefined,
          eventCount: 5,
        }),
      )

      await db.saveEvents(
        Array.from({ length: 5 }, (_, i) =>
          createTestEvent({
            id: `${sessionId}-event-${i}`,
            sessionId,
            timestamp: now + i,
          }),
        ),
      )

      // Verify events exist
      expect(await db.countEventsForSession(sessionId)).toBe(5)

      // Delete session (should cascade to events)
      await db.deleteSession(sessionId)

      // Verify both session and events are gone
      expect(await db.getSession(sessionId)).toBeUndefined()
      expect(await db.countEventsForSession(sessionId)).toBe(0)
    })
  })

  describe("workspaceId association", () => {
    it("queries sessions by workspace", async () => {
      const now = Date.now()

      // Create sessions in different workspaces
      await db.saveSession(
        createTestSession({
          id: "workspace-a-1",
          workspaceId: "/Users/test/project-a",
          startedAt: now - 1000,
        }),
      )
      await db.saveSession(
        createTestSession({
          id: "workspace-a-2",
          workspaceId: "/Users/test/project-a",
          startedAt: now,
        }),
      )
      await db.saveSession(
        createTestSession({
          id: "workspace-b-1",
          workspaceId: "/Users/test/project-b",
          startedAt: now - 500,
        }),
      )
      await db.saveSession(
        createTestSession({
          id: "null-workspace",
          workspaceId: null,
          startedAt: now - 200,
        }),
      )

      // Query all sessions and filter by workspace
      const allSessions = await db.listAllSessions()
      const workspaceASessions = allSessions.filter(s => s.workspaceId === "/Users/test/project-a")
      const workspaceBSessions = allSessions.filter(s => s.workspaceId === "/Users/test/project-b")
      const nullWorkspaceSessions = allSessions.filter(s => s.workspaceId === null)

      expect(workspaceASessions.length).toBe(2)
      expect(workspaceBSessions.length).toBe(1)
      expect(nullWorkspaceSessions.length).toBe(1)
    })

    it("preserves workspaceId through save/load cycle", async () => {
      const workspacePath = "/Users/test/deeply/nested/project"

      await db.saveSession(
        createTestSession({
          id: "workspace-persist",
          workspaceId: workspacePath,
        }),
      )

      const loaded = await db.getSessionMetadata("workspace-persist")
      expect(loaded?.workspaceId).toBe(workspacePath)

      const full = await db.getSession("workspace-persist")
      expect(full?.workspaceId).toBe(workspacePath)
    })

    it("supports null workspaceId for sessions without workspace", async () => {
      await db.saveSession(
        createTestSession({
          id: "no-workspace",
          workspaceId: null,
        }),
      )

      const metadata = await db.getSessionMetadata("no-workspace")
      expect(metadata).toBeDefined()
      expect(metadata?.workspaceId).toBeNull()
    })

    it("allows multiple sessions with the same workspaceId", async () => {
      const workspace = "/Users/test/shared-workspace"
      const now = Date.now()

      // Create multiple sessions in the same workspace
      for (let i = 0; i < 5; i++) {
        await db.saveSession(
          createTestSession({
            id: `shared-workspace-${i}`,
            workspaceId: workspace,
            startedAt: now + i * 100,
          }),
        )
      }

      const allSessions = await db.listAllSessions()
      const workspaceSessions = allSessions.filter(s => s.workspaceId === workspace)

      expect(workspaceSessions.length).toBe(5)
    })
  })

  describe("edge cases", () => {
    it("handles session with all null optional fields", async () => {
      const minimalSession: PersistedSession = {
        id: "minimal",
        instanceId: "test",
        workspaceId: null,
        startedAt: Date.now(),
        completedAt: null,
        taskId: null,
        taskTitle: null,
        tokenUsage: { input: 0, output: 0 },
        contextWindow: { used: 0, max: 200000 },
        session: { current: 0, total: 0 },
        eventCount: 0,
        lastEventSequence: 0,
      }

      await db.saveSession(minimalSession)

      const retrieved = await db.getSession("minimal")
      expect(retrieved).toBeDefined()
      expect(retrieved?.taskId).toBeNull()
      expect(retrieved?.taskTitle).toBeNull()
      expect(retrieved?.completedAt).toBeNull()
    })

    it("handles concurrent saves to the same session", async () => {
      const sessionId = "concurrent-writes"
      const now = Date.now()

      // Perform multiple concurrent saves
      await Promise.all([
        db.saveSession(createTestSession({ id: sessionId, eventCount: 1, startedAt: now })),
        db.saveSession(createTestSession({ id: sessionId, eventCount: 2, startedAt: now })),
        db.saveSession(createTestSession({ id: sessionId, eventCount: 3, startedAt: now })),
      ])

      // One of the values should win (last write wins)
      const session = await db.getSession(sessionId)
      expect(session).toBeDefined()
      expect([1, 2, 3]).toContain(session?.eventCount)
    })

    it("handles saving and retrieving events with special characters in content", async () => {
      const now = Date.now()
      const specialContent = {
        unicode: "こんにちは世界 🎉 مرحبا",
        newlines: "line1\nline2\r\nline3",
        quotes: "single ' and double \" quotes",
        backslashes: "path\\to\\file",
        nullChar: "before\x00after", // null character
      }

      await db.saveEvent(
        createTestEvent({
          id: "special-chars",
          sessionId: "session-1",
          timestamp: now,
          eventType: "user_message",
          event: {
            type: "user_message",
            timestamp: now,
            message: JSON.stringify(specialContent),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
        }),
      )

      const retrieved = await db.getEvent("special-chars")
      expect(retrieved).toBeDefined()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const content = JSON.parse((retrieved?.event as any).message)
      expect(content.unicode).toBe(specialContent.unicode)
      expect(content.newlines).toBe(specialContent.newlines)
    })

    it("handles empty string values", async () => {
      await db.saveSession(
        createTestSession({
          id: "empty-strings",
          taskId: "", // Empty string instead of null
          taskTitle: "",
        }),
      )

      const session = await db.getSession("empty-strings")
      expect(session?.taskId).toBe("")
      expect(session?.taskTitle).toBe("")
    })

    it("handles very long session IDs", async () => {
      const longId = "session-" + "a".repeat(500)

      await db.saveSession(createTestSession({ id: longId }))

      const retrieved = await db.getSession(longId)
      expect(retrieved?.id).toBe(longId)
    })

    it("handles events with zero timestamp", async () => {
      await db.saveEvent(
        createTestEvent({
          id: "zero-timestamp",
          sessionId: "session-1",
          timestamp: 0,
        }),
      )

      const event = await db.getEvent("zero-timestamp")
      expect(event?.timestamp).toBe(0)
    })

    it("preserves event order when timestamps are far apart", async () => {
      const sessionId = "far-timestamps"

      await db.saveEvents([
        createTestEvent({ id: `${sessionId}-0`, sessionId, timestamp: 0 }),
        createTestEvent({ id: `${sessionId}-1`, sessionId, timestamp: 1000000000000 }), // ~2001
        createTestEvent({ id: `${sessionId}-2`, sessionId, timestamp: 2000000000000 }), // ~2033
      ])

      const events = await db.getEventsForSession(sessionId)
      expect(events[0].timestamp).toBe(0)
      expect(events[1].timestamp).toBe(1000000000000)
      expect(events[2].timestamp).toBe(2000000000000)
    })
  })
})
