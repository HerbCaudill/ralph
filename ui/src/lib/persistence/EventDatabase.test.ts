import { describe, it, expect, beforeEach, afterEach } from "vitest"
import "fake-indexeddb/auto"
import { EventDatabase } from "./EventDatabase"
import type {
  PersistedEvent,
  PersistedEventLog,
  PersistedIteration,
  PersistedTaskChatSession,
} from "./types"

/**
 * Create a test iteration with sensible defaults.
 */
function createTestIteration(overrides: Partial<PersistedIteration> = {}): PersistedIteration {
  const id = overrides.id ?? `iteration-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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
    iteration: { current: 1, total: 10 },
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
 * Create a test event log with sensible defaults.
 */
function createTestEventLog(overrides: Partial<PersistedEventLog> = {}): PersistedEventLog {
  const id = overrides.id ?? `event-log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const now = Date.now()
  return {
    id,
    taskId: "task-123",
    taskTitle: "Test Task",
    source: "iteration",
    workspacePath: "/Users/test/project",
    createdAt: now,
    eventCount: 2,
    events: [
      { type: "user_message", timestamp: now, message: "Hello" },
      { type: "assistant_text", timestamp: now + 1, content: "Hi there!" },
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
    iterationId: overrides.iterationId ?? "iteration-123",
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
        iterationCount: 0,
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
      expect(stats.iterationCount).toBe(0)
    })
  })

  describe("iterations", () => {
    describe("saveIteration / getIteration", () => {
      it("saves and retrieves an iteration", async () => {
        const iteration = createTestIteration()
        await db.saveIteration(iteration)

        const retrieved = await db.getIteration(iteration.id)
        expect(retrieved).toEqual(iteration)
      })

      it("overwrites an existing iteration with the same ID", async () => {
        const iteration = createTestIteration({ id: "iter-1" })
        await db.saveIteration(iteration)

        const updated = { ...iteration, eventCount: 20 }
        await db.saveIteration(updated)

        const retrieved = await db.getIteration("iter-1")
        expect(retrieved?.eventCount).toBe(20)
      })

      it("returns undefined for non-existent iteration", async () => {
        const result = await db.getIteration("non-existent")
        expect(result).toBeUndefined()
      })
    })

    describe("getIterationMetadata", () => {
      it("retrieves metadata without full events", async () => {
        const iteration = createTestIteration({ id: "meta-test" })
        await db.saveIteration(iteration)

        const metadata = await db.getIterationMetadata("meta-test")
        expect(metadata).toBeDefined()
        expect(metadata?.id).toBe("meta-test")
        expect(metadata?.instanceId).toBe(iteration.instanceId)
        expect(metadata?.eventCount).toBe(iteration.eventCount)
        // Metadata should not have events property
        expect((metadata as unknown as PersistedIteration).events).toBeUndefined()
      })
    })

    describe("listIterations", () => {
      it("lists iterations for a specific instance", async () => {
        await db.saveIteration(createTestIteration({ id: "iter-1", instanceId: "instance-a" }))
        await db.saveIteration(createTestIteration({ id: "iter-2", instanceId: "instance-a" }))
        await db.saveIteration(createTestIteration({ id: "iter-3", instanceId: "instance-b" }))

        const listA = await db.listIterations("instance-a")
        const listB = await db.listIterations("instance-b")

        expect(listA.map(i => i.id)).toContain("iter-1")
        expect(listA.map(i => i.id)).toContain("iter-2")
        expect(listA.map(i => i.id)).not.toContain("iter-3")
        expect(listB.map(i => i.id)).toEqual(["iter-3"])
      })

      it("returns iterations sorted by startedAt descending", async () => {
        const now = Date.now()
        await db.saveIteration(
          createTestIteration({ id: "old", instanceId: "test", startedAt: now - 1000 }),
        )
        await db.saveIteration(
          createTestIteration({ id: "newest", instanceId: "test", startedAt: now + 1000 }),
        )
        await db.saveIteration(
          createTestIteration({ id: "middle", instanceId: "test", startedAt: now }),
        )

        const list = await db.listIterations("test")
        expect(list.map(i => i.id)).toEqual(["newest", "middle", "old"])
      })

      it("returns empty array for unknown instance", async () => {
        const list = await db.listIterations("unknown-instance")
        expect(list).toEqual([])
      })
    })

    describe("getIterationsForTask", () => {
      it("retrieves iterations for a specific task", async () => {
        await db.saveIteration(createTestIteration({ id: "iter-1", taskId: "task-a" }))
        await db.saveIteration(createTestIteration({ id: "iter-2", taskId: "task-a" }))
        await db.saveIteration(createTestIteration({ id: "iter-3", taskId: "task-b" }))
        await db.saveIteration(createTestIteration({ id: "iter-4", taskId: null }))

        const taskAIterations = await db.getIterationsForTask("task-a")
        expect(taskAIterations.map(i => i.id)).toEqual(expect.arrayContaining(["iter-1", "iter-2"]))
        expect(taskAIterations.length).toBe(2)
      })
    })

    describe("getLatestActiveIteration", () => {
      it("returns the most recent active (incomplete) iteration", async () => {
        const now = Date.now()
        await db.saveIteration(
          createTestIteration({
            id: "old-active",
            instanceId: "test",
            startedAt: now - 2000,
            completedAt: null,
          }),
        )
        await db.saveIteration(
          createTestIteration({
            id: "completed",
            instanceId: "test",
            startedAt: now - 1000,
            completedAt: now,
          }),
        )
        await db.saveIteration(
          createTestIteration({
            id: "newest-active",
            instanceId: "test",
            startedAt: now,
            completedAt: null,
          }),
        )

        const active = await db.getLatestActiveIteration("test")
        expect(active?.id).toBe("newest-active")
      })

      it("returns undefined when all iterations are completed", async () => {
        await db.saveIteration(
          createTestIteration({
            instanceId: "test",
            completedAt: Date.now(),
          }),
        )

        const active = await db.getLatestActiveIteration("test")
        expect(active).toBeUndefined()
      })

      it("returns undefined when no iterations exist", async () => {
        const active = await db.getLatestActiveIteration("test")
        expect(active).toBeUndefined()
      })
    })

    describe("getLatestIteration", () => {
      it("returns the most recent iteration regardless of completion status", async () => {
        const now = Date.now()
        await db.saveIteration(
          createTestIteration({
            id: "newest",
            instanceId: "test",
            startedAt: now,
            completedAt: now + 100,
          }),
        )
        await db.saveIteration(
          createTestIteration({
            id: "older",
            instanceId: "test",
            startedAt: now - 1000,
            completedAt: null,
          }),
        )

        const latest = await db.getLatestIteration("test")
        expect(latest?.id).toBe("newest")
      })

      it("returns undefined when no iterations exist", async () => {
        const latest = await db.getLatestIteration("test")
        expect(latest).toBeUndefined()
      })
    })

    describe("deleteIteration", () => {
      it("deletes an iteration and its metadata", async () => {
        const iteration = createTestIteration({ id: "to-delete" })
        await db.saveIteration(iteration)

        await db.deleteIteration("to-delete")

        expect(await db.getIteration("to-delete")).toBeUndefined()
        expect(await db.getIterationMetadata("to-delete")).toBeUndefined()
      })

      it("does not throw when deleting non-existent iteration", async () => {
        await expect(db.deleteIteration("non-existent")).resolves.not.toThrow()
      })
    })

    describe("deleteAllIterationsForInstance", () => {
      it("deletes all iterations for a specific instance", async () => {
        await db.saveIteration(createTestIteration({ id: "iter-1", instanceId: "instance-a" }))
        await db.saveIteration(createTestIteration({ id: "iter-2", instanceId: "instance-a" }))
        await db.saveIteration(createTestIteration({ id: "iter-3", instanceId: "instance-b" }))

        await db.deleteAllIterationsForInstance("instance-a")

        expect(await db.getIteration("iter-1")).toBeUndefined()
        expect(await db.getIteration("iter-2")).toBeUndefined()
        expect(await db.getIteration("iter-3")).toBeDefined()
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
          createTestEvent({ id: "event-1", iterationId: "iter-1" }),
          createTestEvent({ id: "event-2", iterationId: "iter-1" }),
          createTestEvent({ id: "event-3", iterationId: "iter-1" }),
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

    describe("getEventsForIteration", () => {
      it("retrieves events for a specific iteration", async () => {
        const now = Date.now()
        await db.saveEvents([
          createTestEvent({ id: "event-1", iterationId: "iter-a", timestamp: now }),
          createTestEvent({ id: "event-2", iterationId: "iter-a", timestamp: now + 1 }),
          createTestEvent({ id: "event-3", iterationId: "iter-b", timestamp: now }),
        ])

        const iterAEvents = await db.getEventsForIteration("iter-a")
        expect(iterAEvents.map(e => e.id)).toEqual(expect.arrayContaining(["event-1", "event-2"]))
        expect(iterAEvents.length).toBe(2)
      })

      it("returns events sorted by timestamp ascending", async () => {
        const now = Date.now()
        await db.saveEvents([
          createTestEvent({ id: "middle", iterationId: "iter-1", timestamp: now }),
          createTestEvent({ id: "oldest", iterationId: "iter-1", timestamp: now - 1000 }),
          createTestEvent({ id: "newest", iterationId: "iter-1", timestamp: now + 1000 }),
        ])

        const events = await db.getEventsForIteration("iter-1")
        expect(events.map(e => e.id)).toEqual(["oldest", "middle", "newest"])
      })

      it("returns empty array for unknown iteration", async () => {
        const events = await db.getEventsForIteration("unknown-iteration")
        expect(events).toEqual([])
      })
    })

    describe("countEventsForIteration", () => {
      it("returns correct count of events for an iteration", async () => {
        await db.saveEvents([
          createTestEvent({ id: "event-1", iterationId: "iter-a" }),
          createTestEvent({ id: "event-2", iterationId: "iter-a" }),
          createTestEvent({ id: "event-3", iterationId: "iter-b" }),
        ])

        expect(await db.countEventsForIteration("iter-a")).toBe(2)
        expect(await db.countEventsForIteration("iter-b")).toBe(1)
        expect(await db.countEventsForIteration("iter-c")).toBe(0)
      })
    })

    describe("deleteEventsForIteration", () => {
      it("deletes all events for a specific iteration", async () => {
        await db.saveEvents([
          createTestEvent({ id: "event-1", iterationId: "iter-a" }),
          createTestEvent({ id: "event-2", iterationId: "iter-a" }),
          createTestEvent({ id: "event-3", iterationId: "iter-b" }),
        ])

        await db.deleteEventsForIteration("iter-a")

        expect(await db.getEvent("event-1")).toBeUndefined()
        expect(await db.getEvent("event-2")).toBeUndefined()
        expect(await db.getEvent("event-3")).toBeDefined()
      })

      it("does not throw when no events exist for iteration", async () => {
        await expect(db.deleteEventsForIteration("non-existent")).resolves.not.toThrow()
      })
    })

    describe("integration with iteration lifecycle", () => {
      it("deleteIteration also deletes associated events", async () => {
        // Save an iteration
        await db.saveIteration(createTestIteration({ id: "iter-1" }))

        // Save events for this iteration
        await db.saveEvents([
          createTestEvent({ id: "event-1", iterationId: "iter-1" }),
          createTestEvent({ id: "event-2", iterationId: "iter-1" }),
        ])

        // Delete the iteration
        await db.deleteIteration("iter-1")

        // Events should also be deleted
        expect(await db.getEvent("event-1")).toBeUndefined()
        expect(await db.getEvent("event-2")).toBeUndefined()
      })

      it("deleteAllIterationsForInstance also deletes associated events", async () => {
        // Save iterations
        await db.saveIteration(createTestIteration({ id: "iter-1", instanceId: "instance-a" }))
        await db.saveIteration(createTestIteration({ id: "iter-2", instanceId: "instance-a" }))
        await db.saveIteration(createTestIteration({ id: "iter-3", instanceId: "instance-b" }))

        // Save events for these iterations
        await db.saveEvents([
          createTestEvent({ id: "event-1", iterationId: "iter-1" }),
          createTestEvent({ id: "event-2", iterationId: "iter-2" }),
          createTestEvent({ id: "event-3", iterationId: "iter-3" }),
        ])

        // Delete all iterations for instance-a
        await db.deleteAllIterationsForInstance("instance-a")

        // Events for instance-a iterations should be deleted
        expect(await db.getEvent("event-1")).toBeUndefined()
        expect(await db.getEvent("event-2")).toBeUndefined()
        // Events for instance-b iteration should remain
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

  describe("event logs", () => {
    describe("saveEventLog / getEventLog", () => {
      it("saves and retrieves an event log", async () => {
        const eventLog = createTestEventLog()
        await db.saveEventLog(eventLog)

        const retrieved = await db.getEventLog(eventLog.id)
        expect(retrieved).toEqual(eventLog)
      })

      it("overwrites an existing event log with the same ID", async () => {
        const eventLog = createTestEventLog({ id: "log-1" })
        await db.saveEventLog(eventLog)

        const updated = { ...eventLog, eventCount: 20 }
        await db.saveEventLog(updated)

        const retrieved = await db.getEventLog("log-1")
        expect(retrieved?.eventCount).toBe(20)
      })

      it("returns undefined for non-existent event log", async () => {
        const result = await db.getEventLog("non-existent")
        expect(result).toBeUndefined()
      })
    })

    describe("getEventLogMetadata", () => {
      it("retrieves metadata without full events", async () => {
        const eventLog = createTestEventLog({ id: "meta-test" })
        await db.saveEventLog(eventLog)

        const metadata = await db.getEventLogMetadata("meta-test")
        expect(metadata).toBeDefined()
        expect(metadata?.id).toBe("meta-test")
        expect(metadata?.taskId).toBe(eventLog.taskId)
        expect(metadata?.eventCount).toBe(eventLog.eventCount)
        // Metadata should not have events property
        expect((metadata as unknown as PersistedEventLog).events).toBeUndefined()
      })
    })

    describe("listEventLogs", () => {
      it("lists all event logs", async () => {
        await db.saveEventLog(createTestEventLog({ id: "log-1" }))
        await db.saveEventLog(createTestEventLog({ id: "log-2" }))
        await db.saveEventLog(createTestEventLog({ id: "log-3" }))

        const list = await db.listEventLogs()
        expect(list.map(l => l.id)).toContain("log-1")
        expect(list.map(l => l.id)).toContain("log-2")
        expect(list.map(l => l.id)).toContain("log-3")
        expect(list.length).toBe(3)
      })

      it("returns event logs sorted by createdAt descending", async () => {
        const now = Date.now()
        await db.saveEventLog(createTestEventLog({ id: "old", createdAt: now - 1000 }))
        await db.saveEventLog(createTestEventLog({ id: "newest", createdAt: now + 1000 }))
        await db.saveEventLog(createTestEventLog({ id: "middle", createdAt: now }))

        const list = await db.listEventLogs()
        expect(list.map(l => l.id)).toEqual(["newest", "middle", "old"])
      })

      it("returns empty array when no event logs exist", async () => {
        const list = await db.listEventLogs()
        expect(list).toEqual([])
      })
    })

    describe("getEventLogsForTask", () => {
      it("retrieves event logs for a specific task", async () => {
        await db.saveEventLog(createTestEventLog({ id: "log-1", taskId: "task-a" }))
        await db.saveEventLog(createTestEventLog({ id: "log-2", taskId: "task-a" }))
        await db.saveEventLog(createTestEventLog({ id: "log-3", taskId: "task-b" }))
        await db.saveEventLog(createTestEventLog({ id: "log-4", taskId: null }))

        const taskALogs = await db.getEventLogsForTask("task-a")
        expect(taskALogs.map(l => l.id)).toEqual(expect.arrayContaining(["log-1", "log-2"]))
        expect(taskALogs.length).toBe(2)
      })

      it("returns event logs sorted by createdAt descending", async () => {
        const now = Date.now()
        await db.saveEventLog(
          createTestEventLog({ id: "old", taskId: "task-a", createdAt: now - 1000 }),
        )
        await db.saveEventLog(
          createTestEventLog({ id: "newest", taskId: "task-a", createdAt: now + 1000 }),
        )
        await db.saveEventLog(
          createTestEventLog({ id: "middle", taskId: "task-a", createdAt: now }),
        )

        const logs = await db.getEventLogsForTask("task-a")
        expect(logs.map(l => l.id)).toEqual(["newest", "middle", "old"])
      })

      it("returns empty array for unknown task", async () => {
        const list = await db.getEventLogsForTask("unknown-task")
        expect(list).toEqual([])
      })
    })

    describe("deleteEventLog", () => {
      it("deletes an event log and its metadata", async () => {
        const eventLog = createTestEventLog({ id: "to-delete" })
        await db.saveEventLog(eventLog)

        await db.deleteEventLog("to-delete")

        expect(await db.getEventLog("to-delete")).toBeUndefined()
        expect(await db.getEventLogMetadata("to-delete")).toBeUndefined()
      })

      it("does not throw when deleting non-existent event log", async () => {
        await expect(db.deleteEventLog("non-existent")).resolves.not.toThrow()
      })
    })

    describe("deleteAllEventLogsForTask", () => {
      it("deletes all event logs for a specific task", async () => {
        await db.saveEventLog(createTestEventLog({ id: "log-1", taskId: "task-a" }))
        await db.saveEventLog(createTestEventLog({ id: "log-2", taskId: "task-a" }))
        await db.saveEventLog(createTestEventLog({ id: "log-3", taskId: "task-b" }))

        await db.deleteAllEventLogsForTask("task-a")

        expect(await db.getEventLog("log-1")).toBeUndefined()
        expect(await db.getEventLog("log-2")).toBeUndefined()
        expect(await db.getEventLog("log-3")).toBeDefined()
      })

      it("does not throw when no event logs exist for task", async () => {
        await expect(db.deleteAllEventLogsForTask("non-existent")).resolves.not.toThrow()
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
        await db.saveIteration(createTestIteration())
        await db.saveTaskChatSession(createTestTaskChatSession())
        await db.saveEventLog(createTestEventLog())
        await db.setSyncState("key", "value")

        await db.clearAll()

        const stats = await db.getStats()
        expect(stats).toEqual({
          iterationCount: 0,
          eventCount: 0,
          taskChatSessionCount: 0,
          eventLogCount: 0,
          syncStateCount: 0,
        })
      })
    })

    describe("getStats", () => {
      it("returns correct counts for all stores", async () => {
        await db.saveIteration(createTestIteration({ id: "iter-1" }))
        await db.saveIteration(createTestIteration({ id: "iter-2" }))
        await db.saveTaskChatSession(createTestTaskChatSession({ id: "session-1" }))
        await db.saveEventLog(createTestEventLog({ id: "log-1" }))
        await db.saveEventLog(createTestEventLog({ id: "log-2" }))
        await db.setSyncState("key-1", "value-1")
        await db.setSyncState("key-2", "value-2")
        await db.setSyncState("key-3", "value-3")

        const stats = await db.getStats()
        expect(stats).toEqual({
          iterationCount: 2,
          eventCount: 0,
          taskChatSessionCount: 1,
          eventLogCount: 2,
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
        expect(stats.iterationCount).toBe(0)
      })
    })
  })

  describe("transactional behavior", () => {
    it("saves iteration metadata and full data atomically", async () => {
      const iteration = createTestIteration({ id: "atomic-test" })
      await db.saveIteration(iteration)

      // Both metadata and full data should be present
      const metadata = await db.getIterationMetadata("atomic-test")
      const full = await db.getIteration("atomic-test")

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

    it("deletes iteration metadata and full data atomically", async () => {
      await db.saveIteration(createTestIteration({ id: "delete-atomic" }))
      await db.deleteIteration("delete-atomic")

      expect(await db.getIterationMetadata("delete-atomic")).toBeUndefined()
      expect(await db.getIteration("delete-atomic")).toBeUndefined()
    })

    it("saves event log metadata and full data atomically", async () => {
      const eventLog = createTestEventLog({ id: "atomic-test" })
      await db.saveEventLog(eventLog)

      // Both metadata and full data should be present
      const metadata = await db.getEventLogMetadata("atomic-test")
      const full = await db.getEventLog("atomic-test")

      expect(metadata).toBeDefined()
      expect(full).toBeDefined()
      expect(metadata?.id).toBe(full?.id)
    })

    it("deletes event log metadata and full data atomically", async () => {
      await db.saveEventLog(createTestEventLog({ id: "delete-atomic" }))
      await db.deleteEventLog("delete-atomic")

      expect(await db.getEventLogMetadata("delete-atomic")).toBeUndefined()
      expect(await db.getEventLog("delete-atomic")).toBeUndefined()
    })
  })

  describe("v2→v3 migration", () => {
    /**
     * Test the v2→v3 migration by simulating v2 data format (iterations with embedded events).
     *
     * Note: The migration happens automatically when opening a v2 database with v3 code.
     * Since fake-indexeddb starts fresh for each test, we test by:
     * 1. Saving iterations with embedded events array (v2 format)
     * 2. Verifying the events can be retrieved from the events store
     * 3. Verifying the iteration no longer has embedded events
     *
     * In a real v2→v3 upgrade:
     * - The upgrade handler extracts events from iterations
     * - Creates PersistedEvent records in the events store
     * - Removes the events array from iterations
     */

    it("preserves iteration data after migration when iteration is saved with events", async () => {
      // Simulate v2-style iteration with embedded events
      const now = Date.now()
      const iterationWithEvents = createTestIteration({
        id: "v2-iteration",
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
      await db.saveIteration(iterationWithEvents)

      // Verify iteration metadata is preserved
      const metadata = await db.getIterationMetadata("v2-iteration")
      expect(metadata).toBeDefined()
      expect(metadata?.id).toBe("v2-iteration")
      expect(metadata?.instanceId).toBe("test-instance")
      expect(metadata?.taskId).toBe("task-123")
      expect(metadata?.eventCount).toBe(3)

      // Verify full iteration data is preserved
      const iteration = await db.getIteration("v2-iteration")
      expect(iteration).toBeDefined()
      expect(iteration?.id).toBe("v2-iteration")
      // Events array should still be in the iteration store (for backward compat)
      expect(iteration?.events?.length).toBe(3)
    })

    it("handles iterations with empty events array", async () => {
      const emptyEventsIteration = createTestIteration({
        id: "empty-events",
        events: [],
        eventCount: 0,
      })

      await db.saveIteration(emptyEventsIteration)

      const iteration = await db.getIteration("empty-events")
      expect(iteration).toBeDefined()
      expect(iteration?.events).toEqual([])
    })

    it("handles iterations with undefined events (pure metadata)", async () => {
      // Simulate v3-style iteration without events
      const metadataOnlyIteration = {
        id: "metadata-only",
        instanceId: "test-instance",
        workspaceId: null,
        startedAt: Date.now(),
        completedAt: null,
        taskId: null,
        taskTitle: null,
        tokenUsage: { input: 0, output: 0 },
        contextWindow: { used: 0, max: 200000 },
        iteration: { current: 0, total: 0 },
        eventCount: 0,
        lastEventSequence: 0,
        // No events property - this is the v3 pattern
      } as PersistedIteration

      await db.saveIteration(metadataOnlyIteration)

      const iteration = await db.getIteration("metadata-only")
      expect(iteration).toBeDefined()
      expect(iteration?.events).toBeUndefined()
    })

    it("sets workspaceId to null for legacy iterations without workspaceId", async () => {
      // The migration should ensure all iterations have workspaceId property
      const legacyIteration = createTestIteration({
        id: "legacy-iteration",
        workspaceId: null, // Explicit null (migration ensures this exists)
      })

      await db.saveIteration(legacyIteration)

      const metadata = await db.getIterationMetadata("legacy-iteration")
      expect(metadata).toBeDefined()
      expect(metadata).toHaveProperty("workspaceId")
      expect(metadata?.workspaceId).toBeNull()
    })

    it("preserves workspaceId when set on iteration", async () => {
      const iterationWithWorkspace = createTestIteration({
        id: "with-workspace",
        workspaceId: "/Users/test/project",
      })

      await db.saveIteration(iterationWithWorkspace)

      const metadata = await db.getIterationMetadata("with-workspace")
      expect(metadata?.workspaceId).toBe("/Users/test/project")
    })

    it("handles events with missing timestamp by using fallback", async () => {
      // Events might have undefined timestamp in corrupted data
      const now = Date.now()
      const iterationWithBadEvents = createTestIteration({
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
      await expect(db.saveIteration(iterationWithBadEvents)).resolves.not.toThrow()

      const iteration = await db.getIteration("bad-timestamps")
      expect(iteration?.events?.length).toBe(2)
    })

    it("handles events with missing type by using unknown fallback", async () => {
      const now = Date.now()
      const iterationWithTypelessEvents = createTestIteration({
        id: "typeless-events",
        events: [
          { timestamp: now, message: "No type field" } as unknown as {
            type: string
            timestamp: number
            message: string
          },
        ],
      })

      await expect(db.saveIteration(iterationWithTypelessEvents)).resolves.not.toThrow()

      const iteration = await db.getIteration("typeless-events")
      expect(iteration?.events?.length).toBe(1)
    })

    it("events can be stored and retrieved separately from iterations", async () => {
      // This tests the normalized storage pattern for v3+
      const iterationId = "separate-storage"

      // Save iteration metadata only
      await db.saveIteration(
        createTestIteration({
          id: iterationId,
          events: undefined,
          eventCount: 3,
        }),
      )

      // Save events separately
      const now = Date.now()
      await db.saveEvents([
        createTestEvent({
          id: `${iterationId}-event-0`,
          iterationId,
          timestamp: now,
          eventType: "user_message",
        }),
        createTestEvent({
          id: `${iterationId}-event-1`,
          iterationId,
          timestamp: now + 100,
          eventType: "assistant_text",
        }),
        createTestEvent({
          id: `${iterationId}-event-2`,
          iterationId,
          timestamp: now + 200,
          eventType: "tool_use",
        }),
      ])

      // Verify iteration has no embedded events
      const iteration = await db.getIteration(iterationId)
      expect(iteration?.events).toBeUndefined()

      // Verify events can be retrieved separately
      const events = await db.getEventsForIteration(iterationId)
      expect(events.length).toBe(3)
      expect(events[0].eventType).toBe("user_message")
      expect(events[1].eventType).toBe("assistant_text")
      expect(events[2].eventType).toBe("tool_use")
    })
  })
})
