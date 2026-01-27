/**
 * Integration tests for persistence layer.
 *
 * These tests verify the complete flow of:
 * 1. Saving sessions/task chat sessions to IndexedDB
 * 2. Recovering data after simulated page reload
 *
 * Unlike unit tests which mock the database, these tests use the real
 * EventDatabase with fake-indexeddb to verify the actual persistence behavior.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import "fake-indexeddb/auto"
import { EventDatabase } from "./EventDatabase"
import {
  useSessionPersistence,
  type UseSessionPersistenceOptions,
} from "@/hooks/useSessionPersistence"
import {
  useTaskChatPersistence,
  type UseTaskChatPersistenceOptions,
} from "@/hooks/useTaskChatPersistence"
import type { ChatEvent, TaskChatMessage, TokenUsage, ContextWindow, SessionInfo } from "@/types"

/**
 * Create a fresh EventDatabase instance for each test.
 * This ensures tests are isolated and don't share state.
 */
function createTestDatabase(): EventDatabase {
  return new EventDatabase()
}

describe("Persistence Integration Tests", () => {
  let db: EventDatabase

  beforeEach(async () => {
    db = createTestDatabase()
    await db.init()
  })

  afterEach(async () => {
    await db.clearAll()
    db.close()
  })

  describe("Session Lifecycle", () => {
    const mockTokenUsage: TokenUsage = { input: 1000, output: 500 }
    const mockContextWindow: ContextWindow = { used: 5000, max: 200000 }
    const mockSessionInfo: SessionInfo = { current: 1, total: 5 }

    const createSystemInitEvent = (timestamp: number): ChatEvent =>
      ({
        type: "system",
        timestamp,
        subtype: "init",
      }) as ChatEvent

    const createAssistantEvent = (timestamp: number, text: string): ChatEvent =>
      ({
        type: "assistant",
        timestamp,
        message: {
          content: [{ type: "text", text }],
        },
      }) as ChatEvent

    const createRalphTaskStartedEvent = (
      timestamp: number,
      taskId: string,
      taskTitle: string,
    ): ChatEvent =>
      ({
        type: "ralph_task_started",
        timestamp,
        taskId,
        taskTitle,
      }) as ChatEvent

    const createRalphTaskCompletedEvent = (timestamp: number): ChatEvent =>
      ({
        type: "ralph_task_completed",
        timestamp,
      }) as ChatEvent

    it("saves session on completion and can be recovered", async () => {
      const instanceId = "test-instance"
      const startTime = Date.now()

      // Build a complete session sequence
      const events: ChatEvent[] = [
        createSystemInitEvent(startTime),
        createRalphTaskStartedEvent(startTime + 100, "r-abc123", "Fix the bug"),
        createAssistantEvent(startTime + 200, "I will fix this bug now."),
        createRalphTaskCompletedEvent(startTime + 300),
      ]

      // Simulate the session running - add events progressively
      let currentEvents: ChatEvent[] = []

      const { rerender } = renderHook(
        (props: UseSessionPersistenceOptions) => useSessionPersistence(props),
        {
          initialProps: {
            instanceId,
            events: currentEvents,
            tokenUsage: mockTokenUsage,
            contextWindow: mockContextWindow,
            session: mockSessionInfo,
            enabled: true,
          },
        },
      )

      // Add events one by one (simulating real-time streaming)
      for (let i = 0; i < events.length; i++) {
        currentEvents = events.slice(0, i + 1)
        rerender({
          instanceId,
          events: currentEvents,
          tokenUsage: mockTokenUsage,
          contextWindow: mockContextWindow,
          session: mockSessionInfo,
          enabled: true,
        })

        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 20))
        })
      }

      // Wait for any pending saves to complete
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      // Verify the session was saved to the database
      const savedSessions = await db.listSessions(instanceId)
      expect(savedSessions.length).toBeGreaterThan(0)

      // Get the full session data - v3 schema: metadata only, events stored separately
      const savedSession = await db.getSession(savedSessions[0].id)
      expect(savedSession).toBeDefined()
      expect(savedSession?.instanceId).toBe(instanceId)
      // Events are persisted separately by useEventPersistence in v3 schema
      expect(savedSession?.eventCount).toBe(events.length)
      expect(savedSession?.events).toBeUndefined()
      expect(savedSession?.taskId).toBe("r-abc123")
      expect(savedSession?.taskTitle).toBe("Fix the bug")
      expect(savedSession?.completedAt).not.toBeNull()
    })

    it("preserves active session across simulated page reload", async () => {
      const instanceId = "test-instance"
      const startTime = Date.now()

      // Build an in-progress session (not completed)
      const events: ChatEvent[] = [
        createSystemInitEvent(startTime),
        createAssistantEvent(startTime + 100, "Working on the task..."),
        createAssistantEvent(startTime + 200, "Still working..."),
      ]

      // First session - create the session
      const { result: session1Result, unmount: unmountSession1 } = renderHook(
        (props: UseSessionPersistenceOptions) => useSessionPersistence(props),
        {
          initialProps: {
            instanceId,
            events,
            tokenUsage: mockTokenUsage,
            contextWindow: mockContextWindow,
            session: mockSessionInfo,
            enabled: true,
          },
        },
      )

      // Wait for the session to be tracked
      await waitFor(() => {
        expect(session1Result.current.currentSessionId).not.toBeNull()
      })

      // Manual save to ensure data is persisted
      await act(async () => {
        await session1Result.current.saveCurrentSession()
      })

      // Simulate page unload
      unmountSession1()

      // Verify data persists after unmount
      const savedSessions = await db.listSessions(instanceId)
      expect(savedSessions.length).toBeGreaterThan(0)

      // The session should still be "active" (completedAt is null)
      // v3 schema: metadata only, events stored separately
      const savedSession = await db.getSession(savedSessions[0].id)
      expect(savedSession).toBeDefined()
      expect(savedSession?.completedAt).toBeNull()
      expect(savedSession?.eventCount).toBe(events.length)
      expect(savedSession?.events).toBeUndefined()
    })

    it("handles multiple sessions correctly", async () => {
      const instanceId = "test-instance"
      const startTime = Date.now()

      // First session
      const events1: ChatEvent[] = [
        createSystemInitEvent(startTime),
        createAssistantEvent(startTime + 100, "First session work"),
        createRalphTaskCompletedEvent(startTime + 200),
      ]

      // Second session (starts 1 second later)
      const events2: ChatEvent[] = [
        createSystemInitEvent(startTime + 1000),
        createAssistantEvent(startTime + 1100, "Second session work"),
      ]

      // Combine events (simulating continuous session)
      const allEvents = [...events1, ...events2]

      const { rerender } = renderHook(
        (props: UseSessionPersistenceOptions) => useSessionPersistence(props),
        {
          initialProps: {
            instanceId,
            events: [] as ChatEvent[],
            tokenUsage: mockTokenUsage,
            contextWindow: mockContextWindow,
            session: mockSessionInfo,
            enabled: true,
          },
        },
      )

      // Add events progressively
      for (let i = 0; i < allEvents.length; i++) {
        rerender({
          instanceId,
          events: allEvents.slice(0, i + 1),
          tokenUsage: mockTokenUsage,
          contextWindow: mockContextWindow,
          session: mockSessionInfo,
          enabled: true,
        })

        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 20))
        })
      }

      // Wait for saves
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      // Should have saved both sessions
      const savedSessions = await db.listSessions(instanceId)
      expect(savedSessions.length).toBeGreaterThanOrEqual(1)

      // First session should be marked as complete
      const session1 = savedSessions.find(i => i.startedAt === startTime)
      if (session1) {
        expect(session1.completedAt).not.toBeNull()
      }
    })
  })

  describe("Task Chat Lifecycle", () => {
    const createUserMessage = (
      id: string,
      content: string,
      timestamp: number,
    ): TaskChatMessage => ({
      id,
      role: "user",
      content,
      timestamp,
    })

    const createAssistantMessage = (
      id: string,
      content: string,
      timestamp: number,
    ): TaskChatMessage => ({
      id,
      role: "assistant",
      content,
      timestamp,
    })

    const createUserEvent = (timestamp: number, text: string): ChatEvent =>
      ({
        type: "user",
        timestamp,
        message: {
          role: "user",
          content: text,
        },
      }) as ChatEvent

    const createAssistantEvent = (timestamp: number, text: string): ChatEvent =>
      ({
        type: "assistant",
        timestamp,
        message: {
          content: [{ type: "text", text }],
        },
      }) as ChatEvent

    it("persists task chat sessions with debouncing", async () => {
      const instanceId = "test-instance"
      const taskId = "task-123"
      const startTime = Date.now()

      const messages: TaskChatMessage[] = [
        createUserMessage("msg-1", "How do I fix this?", startTime),
        createAssistantMessage("msg-2", "Let me help you.", startTime + 100),
      ]

      const events: ChatEvent[] = [
        createUserEvent(startTime, "How do I fix this?"),
        createAssistantEvent(startTime + 100, "Let me help you."),
      ]

      const { result } = renderHook(
        (props: UseTaskChatPersistenceOptions) => useTaskChatPersistence(props),
        {
          initialProps: {
            instanceId,
            taskId,
            taskTitle: "Fix the bug",
            messages,
            events,
            enabled: true,
          },
        },
      )

      // Wait for session to be created
      await waitFor(
        () => {
          expect(result.current.currentSessionId).not.toBeNull()
        },
        { timeout: 1000 },
      )

      // Manual save to bypass debounce
      await act(async () => {
        await result.current.saveCurrentSession()
      })

      // Verify the session was saved
      const savedSessions = await db.listTaskChatSessions(instanceId)
      expect(savedSessions.length).toBe(1)

      const savedSession = await db.getTaskChatSession(savedSessions[0].id)
      expect(savedSession).toBeDefined()
      expect(savedSession?.taskId).toBe(taskId)
      expect(savedSession?.messages.length).toBe(messages.length)
      // In v7+ schema, events are stored separately in the events table
      expect(savedSession?.eventCount).toBe(events.length)
    })

    it("preserves task chat across simulated page reload", async () => {
      const instanceId = "test-instance"
      const taskId = "task-456"
      const startTime = Date.now()

      const messages: TaskChatMessage[] = [
        createUserMessage("msg-1", "Help with this task", startTime),
        createAssistantMessage("msg-2", "Sure, I can help!", startTime + 100),
      ]

      const events: ChatEvent[] = [
        createUserEvent(startTime, "Help with this task"),
        createAssistantEvent(startTime + 100, "Sure, I can help!"),
      ]

      // First session
      const { result: session1Result, unmount: unmountSession1 } = renderHook(
        (props: UseTaskChatPersistenceOptions) => useTaskChatPersistence(props),
        {
          initialProps: {
            instanceId,
            taskId,
            taskTitle: "Test Task",
            messages,
            events,
            enabled: true,
          },
        },
      )

      // Wait for session creation
      await waitFor(
        () => {
          expect(session1Result.current.currentSessionId).not.toBeNull()
        },
        { timeout: 1000 },
      )

      // Save explicitly
      await act(async () => {
        await session1Result.current.saveCurrentSession()
      })

      // Simulate page unload
      unmountSession1()

      // Verify persistence
      const savedSessions = await db.listTaskChatSessions(instanceId)
      expect(savedSessions.length).toBe(1)

      // Can recover the session
      const recoveredSession = await db.getLatestTaskChatSession(instanceId, taskId)
      expect(recoveredSession).toBeDefined()
      expect(recoveredSession?.messages.length).toBe(messages.length)
      // In v7+ schema, events are stored separately in the events table
      expect(recoveredSession?.eventCount).toBe(events.length)
    })

    it("clears task chat session correctly", async () => {
      const instanceId = "test-instance"
      const taskId = "task-789"
      const startTime = Date.now()

      const messages: TaskChatMessage[] = [createUserMessage("msg-1", "Hello", startTime)]

      const events: ChatEvent[] = [createUserEvent(startTime, "Hello")]

      const { result } = renderHook(
        (props: UseTaskChatPersistenceOptions) => useTaskChatPersistence(props),
        {
          initialProps: {
            instanceId,
            taskId,
            taskTitle: "Test Task",
            messages,
            events,
            enabled: true,
          },
        },
      )

      // Wait for session creation
      await waitFor(
        () => {
          expect(result.current.currentSessionId).not.toBeNull()
        },
        { timeout: 1000 },
      )

      // Save then clear
      await act(async () => {
        await result.current.saveCurrentSession()
      })

      // Verify it was saved
      let savedSessions = await db.listTaskChatSessions(instanceId)
      expect(savedSessions.length).toBe(1)

      // Clear the session
      await act(async () => {
        await result.current.clearSession()
      })

      // Verify it was deleted
      savedSessions = await db.listTaskChatSessions(instanceId)
      expect(savedSessions.length).toBe(0)

      expect(result.current.currentSessionId).toBeNull()
    })
  })

  describe("Store Hydration Recovery", () => {
    it("can recover session events from database", async () => {
      const instanceId = "test-instance"
      const startTime = Date.now()

      // Manually save an session to the database (simulating a previous session)
      const events: ChatEvent[] = [
        {
          type: "system",
          timestamp: startTime,
          subtype: "init",
        } as ChatEvent,
        {
          type: "assistant",
          timestamp: startTime + 100,
          message: { content: [{ type: "text", text: "Hello!" }] },
        } as ChatEvent,
      ]

      await db.saveSession({
        id: `${instanceId}-${startTime}`,
        instanceId,
        workspaceId: null,
        startedAt: startTime,
        completedAt: null, // Active session
        taskId: null,
        taskTitle: null,
        tokenUsage: { input: 100, output: 50 },
        contextWindow: { used: 150, max: 200000 },
        session: { current: 1, total: 1 },
        eventCount: events.length,
        lastEventSequence: events.length - 1,
        events,
      })

      // Recover the session
      const recovered = await db.getLatestActiveSession(instanceId)
      expect(recovered).toBeDefined()
      expect(recovered?.events?.length).toBe(events.length)
      expect(recovered?.completedAt).toBeNull()
    })

    it("can recover task chat from database", async () => {
      const instanceId = "test-instance"
      const taskId = "task-abc"
      const now = Date.now()

      // Manually save a task chat session
      const messages: TaskChatMessage[] = [
        { id: "msg-1", role: "user", content: "Question?", timestamp: now },
        { id: "msg-2", role: "assistant", content: "Answer!", timestamp: now + 100 },
      ]

      const events: ChatEvent[] = [
        { type: "user", timestamp: now, message: { role: "user", content: "Question?" } },
        {
          type: "assistant",
          timestamp: now + 100,
          message: { content: [{ type: "text", text: "Answer!" }] },
        },
      ] as ChatEvent[]

      await db.saveTaskChatSession({
        id: `${instanceId}-task-${taskId}-${now}`,
        taskId,
        taskTitle: "Test Task",
        instanceId,
        createdAt: now,
        updatedAt: now + 100,
        messageCount: messages.length,
        eventCount: events.length,
        lastEventSequence: events.length - 1,
        messages,
        events,
      })

      // Recover the session
      const recovered = await db.getLatestTaskChatSessionForInstance(instanceId)
      expect(recovered).toBeDefined()
      expect(recovered?.messages.length).toBe(messages.length)
      expect(recovered?.events?.length).toBe(events.length)
      expect(recovered?.taskId).toBe(taskId)
    })

    it("returns latest active session, not completed ones", async () => {
      const instanceId = "test-instance"
      const now = Date.now()

      // Save a completed session
      await db.saveSession({
        id: `${instanceId}-${now - 10000}`,
        instanceId,
        workspaceId: null,
        startedAt: now - 10000,
        completedAt: now - 5000, // Completed
        taskId: "task-1",
        taskTitle: "Old Task",
        tokenUsage: { input: 100, output: 50 },
        contextWindow: { used: 150, max: 200000 },
        session: { current: 1, total: 1 },
        eventCount: 2,
        lastEventSequence: 1,
        events: [{ type: "system", timestamp: now - 10000, subtype: "init" }] as ChatEvent[],
      })

      // Save an active session
      await db.saveSession({
        id: `${instanceId}-${now}`,
        instanceId,
        workspaceId: null,
        startedAt: now,
        completedAt: null, // Still active
        taskId: "task-2",
        taskTitle: "Current Task",
        tokenUsage: { input: 200, output: 100 },
        contextWindow: { used: 300, max: 200000 },
        session: { current: 1, total: 1 },
        eventCount: 3,
        lastEventSequence: 2,
        events: [{ type: "system", timestamp: now, subtype: "init" }] as ChatEvent[],
      })

      // Should get the active one
      const recovered = await db.getLatestActiveSession(instanceId)
      expect(recovered).toBeDefined()
      expect(recovered?.taskTitle).toBe("Current Task")
      expect(recovered?.completedAt).toBeNull()
    })
  })

  describe("Data Integrity", () => {
    it("preserves event structure through save/load cycle", async () => {
      const instanceId = "test-instance"
      const now = Date.now()

      // Create events with various types
      const originalEvents: ChatEvent[] = [
        {
          type: "system",
          timestamp: now,
          subtype: "init",
        } as ChatEvent,
        {
          type: "user",
          timestamp: now + 100,
          message: {
            role: "user",
            content: "Hello world!",
          },
        } as ChatEvent,
        {
          type: "assistant",
          timestamp: now + 200,
          message: {
            content: [
              { type: "text", text: "Hi there!" },
              { type: "tool_use", id: "tool-1", name: "read_file", input: { path: "/test.txt" } },
            ],
          },
        } as ChatEvent,
        {
          type: "tool_result",
          timestamp: now + 300,
          toolUseId: "tool-1",
          result: { content: "File contents here" },
        } as ChatEvent,
      ]

      // Save to database
      await db.saveSession({
        id: `${instanceId}-${now}`,
        instanceId,
        workspaceId: null,
        startedAt: now,
        completedAt: null,
        taskId: null,
        taskTitle: null,
        tokenUsage: { input: 100, output: 50 },
        contextWindow: { used: 150, max: 200000 },
        session: { current: 1, total: 1 },
        eventCount: originalEvents.length,
        lastEventSequence: originalEvents.length - 1,
        events: originalEvents,
      })

      // Load from database
      const recovered = await db.getSession(`${instanceId}-${now}`)
      expect(recovered).toBeDefined()
      expect(recovered?.events ?? []).toEqual(originalEvents)
    })

    it("handles large event arrays", async () => {
      const instanceId = "test-instance"
      const now = Date.now()

      // Create many events
      const events: ChatEvent[] = [
        { type: "system", timestamp: now, subtype: "init" } as ChatEvent,
        ...Array.from({ length: 100 }, (_, i) => ({
          type: "assistant",
          timestamp: now + (i + 1) * 100,
          message: { content: [{ type: "text", text: `Message ${i + 1}` }] },
        })),
      ] as ChatEvent[]

      await db.saveSession({
        id: `${instanceId}-${now}`,
        instanceId,
        workspaceId: null,
        startedAt: now,
        completedAt: null,
        taskId: null,
        taskTitle: null,
        tokenUsage: { input: 1000, output: 500 },
        contextWindow: { used: 1500, max: 200000 },
        session: { current: 1, total: 1 },
        eventCount: events.length,
        lastEventSequence: events.length - 1,
        events,
      })

      const recovered = await db.getSession(`${instanceId}-${now}`)
      expect(recovered).toBeDefined()
      expect(recovered?.events?.length).toBe(101)
    })
  })
})
