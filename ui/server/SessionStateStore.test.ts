import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdir, rm, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { randomBytes } from "node:crypto"
import {
  SessionStateStore,
  getSessionStateStore,
  resetSessionStateStores,
  type PersistedSessionState,
} from "./SessionStateStore"
import type { ConversationContext } from "./ClaudeAdapter"

describe("SessionStateStore", () => {
  let testDir: string
  let store: SessionStateStore

  /**
   * Create a unique test directory for each test
   */
  beforeEach(async () => {
    testDir = join(tmpdir(), `session-state-test-${randomBytes(8).toString("hex")}`)
    await mkdir(testDir, { recursive: true })
    store = new SessionStateStore(testDir)
    resetSessionStateStores()
  })

  /**
   * Clean up after each test
   */
  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  /**
   * Helper to create a test conversation context
   */
  function createTestContext(overrides: Partial<ConversationContext> = {}): ConversationContext {
    return {
      messages: overrides.messages ?? [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
      ],
      lastPrompt: overrides.lastPrompt ?? "Hello",
      usage: overrides.usage ?? {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      },
      timestamp: overrides.timestamp ?? Date.now(),
    }
  }

  /**
   * Helper to create a test session state
   */
  function createTestState(overrides: Partial<PersistedSessionState> = {}): PersistedSessionState {
    return {
      instanceId: overrides.instanceId ?? randomBytes(4).toString("hex"),
      conversationContext: overrides.conversationContext ?? createTestContext(),
      sessionId: overrides.sessionId,
      status: overrides.status ?? "running",
      currentTaskId: overrides.currentTaskId ?? null,
      savedAt: overrides.savedAt ?? Date.now(),
      version: 1,
    }
  }

  describe("constructor and paths", () => {
    it("stores the workspace path", () => {
      expect(store.getWorkspacePath()).toBe(testDir)
    })

    it("constructs the correct store directory", () => {
      expect(store.getStoreDir()).toBe(join(testDir, ".ralph", "sessions"))
    })
  })

  describe("exists", () => {
    it("returns false when store directory does not exist", async () => {
      expect(await store.exists()).toBe(false)
    })

    it("returns true when store directory exists", async () => {
      await mkdir(join(testDir, ".ralph", "sessions"), { recursive: true })
      expect(await store.exists()).toBe(true)
    })
  })

  describe("has", () => {
    it("returns false when state file does not exist", async () => {
      expect(await store.has("non-existent")).toBe(false)
    })

    it("returns true when state file exists", async () => {
      const state = createTestState({ instanceId: "test-1" })
      await store.save(state)
      expect(await store.has("test-1")).toBe(true)
    })
  })

  describe("save and load", () => {
    it("saves and loads session state", async () => {
      const state = createTestState({ instanceId: "test-1" })
      await store.save(state)
      const loaded = await store.load("test-1")

      expect(loaded).not.toBeNull()
      expect(loaded?.instanceId).toBe("test-1")
      expect(loaded?.conversationContext.messages).toEqual(state.conversationContext.messages)
    })

    it("returns null for non-existent state", async () => {
      const loaded = await store.load("non-existent")
      expect(loaded).toBeNull()
    })

    it("overwrites existing state with same instance ID", async () => {
      const state1 = createTestState({
        instanceId: "test-1",
        conversationContext: createTestContext({ lastPrompt: "First prompt" }),
      })
      const state2 = createTestState({
        instanceId: "test-1",
        conversationContext: createTestContext({ lastPrompt: "Second prompt" }),
      })

      await store.save(state1)
      await store.save(state2)
      const loaded = await store.load("test-1")

      expect(loaded?.conversationContext.lastPrompt).toBe("Second prompt")
    })

    it("creates the sessions directory if it does not exist", async () => {
      const state = createTestState({ instanceId: "test-1" })
      await store.save(state)

      // Verify the file was created
      const content = await readFile(join(store.getStoreDir(), "test-1.json"), "utf-8")
      expect(content).toContain("test-1")
    })

    it("updates savedAt timestamp on save", async () => {
      const oldTime = Date.now() - 60000
      const state = createTestState({ instanceId: "test-1", savedAt: oldTime })

      await store.save(state)
      const loaded = await store.load("test-1")

      expect(loaded?.savedAt).toBeGreaterThan(oldTime)
    })

    it("preserves session ID when present", async () => {
      const state = createTestState({
        instanceId: "test-1",
        sessionId: "session-abc-123",
      })
      await store.save(state)
      const loaded = await store.load("test-1")

      expect(loaded?.sessionId).toBe("session-abc-123")
    })
  })

  describe("delete", () => {
    it("deletes an existing state", async () => {
      const state = createTestState({ instanceId: "test-1" })
      await store.save(state)

      const deleted = await store.delete("test-1")

      expect(deleted).toBe(true)
      expect(await store.load("test-1")).toBeNull()
    })

    it("returns false for non-existent state", async () => {
      const deleted = await store.delete("non-existent")
      expect(deleted).toBe(false)
    })

    it("does not affect other states", async () => {
      await store.save(createTestState({ instanceId: "test-1" }))
      await store.save(createTestState({ instanceId: "test-2" }))

      await store.delete("test-1")

      expect(await store.load("test-1")).toBeNull()
      expect(await store.load("test-2")).not.toBeNull()
    })
  })

  describe("getAll", () => {
    it("returns empty array when store is empty", async () => {
      const states = await store.getAll()
      expect(states).toEqual([])
    })

    it("returns all saved states", async () => {
      await store.save(createTestState({ instanceId: "test-1" }))
      await store.save(createTestState({ instanceId: "test-2" }))
      await store.save(createTestState({ instanceId: "test-3" }))

      const states = await store.getAll()

      expect(states).toHaveLength(3)
      expect(states.map(s => s.instanceId).sort()).toEqual(["test-1", "test-2", "test-3"])
    })

    it("skips malformed state files", async () => {
      await store.save(createTestState({ instanceId: "good" }))

      // Create a malformed file
      await mkdir(store.getStoreDir(), { recursive: true })
      await writeFile(join(store.getStoreDir(), "bad.json"), "{ invalid json", "utf-8")

      const states = await store.getAll()

      expect(states).toHaveLength(1)
      expect(states[0].instanceId).toBe("good")
    })
  })

  describe("getAllInstanceIds", () => {
    it("returns empty array when store is empty", async () => {
      const ids = await store.getAllInstanceIds()
      expect(ids).toEqual([])
    })

    it("returns all instance IDs", async () => {
      await store.save(createTestState({ instanceId: "test-1" }))
      await store.save(createTestState({ instanceId: "test-2" }))

      const ids = await store.getAllInstanceIds()

      expect(ids.sort()).toEqual(["test-1", "test-2"])
    })
  })

  describe("count", () => {
    it("returns 0 for empty store", async () => {
      expect(await store.count()).toBe(0)
    })

    it("returns correct count", async () => {
      await store.save(createTestState({ instanceId: "test-1" }))
      await store.save(createTestState({ instanceId: "test-2" }))
      await store.save(createTestState({ instanceId: "test-3" }))

      expect(await store.count()).toBe(3)
    })
  })

  describe("cleanupStale", () => {
    it("removes states older than threshold", async () => {
      const now = Date.now()
      const twoHoursAgo = now - 2 * 60 * 60 * 1000

      // Save a fresh state and a stale state
      await store.save(createTestState({ instanceId: "fresh", savedAt: now }))

      // Manually write stale state with old timestamp
      await mkdir(store.getStoreDir(), { recursive: true })
      const staleState = createTestState({ instanceId: "stale", savedAt: twoHoursAgo })
      await writeFile(join(store.getStoreDir(), "stale.json"), JSON.stringify(staleState), "utf-8")

      // Run cleanup with 1 hour threshold
      const removed = await store.cleanupStale(60 * 60 * 1000)

      expect(removed).toBe(1)
      expect(await store.load("fresh")).not.toBeNull()
      expect(await store.load("stale")).toBeNull()
    })

    it("returns 0 when no stale states exist", async () => {
      await store.save(createTestState({ instanceId: "fresh" }))

      const removed = await store.cleanupStale()

      expect(removed).toBe(0)
      expect(await store.count()).toBe(1)
    })

    it("handles empty store", async () => {
      const removed = await store.cleanupStale()
      expect(removed).toBe(0)
    })
  })

  describe("clear", () => {
    it("removes all states", async () => {
      await store.save(createTestState({ instanceId: "test-1" }))
      await store.save(createTestState({ instanceId: "test-2" }))

      await store.clear()

      expect(await store.count()).toBe(0)
    })
  })

  describe("file format", () => {
    it("stores data in the correct format", async () => {
      const state = createTestState({ instanceId: "test-1" })
      await store.save(state)

      const content = await readFile(join(store.getStoreDir(), "test-1.json"), "utf-8")
      const data = JSON.parse(content)

      expect(data.version).toBe(1)
      expect(data.instanceId).toBe("test-1")
      expect(data.conversationContext).toBeDefined()
      expect(data.savedAt).toBeDefined()
    })

    it("handles unknown version gracefully", async () => {
      await mkdir(store.getStoreDir(), { recursive: true })
      await writeFile(
        join(store.getStoreDir(), "old.json"),
        JSON.stringify({ version: 999, instanceId: "old", conversationContext: {} }),
      )

      const loaded = await store.load("old")
      expect(loaded).toBeNull()
    })

    it("handles malformed state gracefully", async () => {
      await mkdir(store.getStoreDir(), { recursive: true })
      await writeFile(
        join(store.getStoreDir(), "bad.json"),
        JSON.stringify({ version: 1 }), // Missing required fields
      )

      const loaded = await store.load("bad")
      expect(loaded).toBeNull()
    })
  })

  describe("getSessionStateStore singleton", () => {
    it("returns the same store for the same workspace path", () => {
      const store1 = getSessionStateStore(testDir)
      const store2 = getSessionStateStore(testDir)
      expect(store1).toBe(store2)
    })

    it("returns different stores for different workspace paths", async () => {
      const testDir2 = join(tmpdir(), `session-state-test-2-${randomBytes(8).toString("hex")}`)
      await mkdir(testDir2, { recursive: true })

      try {
        const store1 = getSessionStateStore(testDir)
        const store2 = getSessionStateStore(testDir2)
        expect(store1).not.toBe(store2)
      } finally {
        await rm(testDir2, { recursive: true, force: true })
      }
    })

    it("can be reset for testing", () => {
      const store1 = getSessionStateStore(testDir)
      resetSessionStateStores()
      const store2 = getSessionStateStore(testDir)
      expect(store1).not.toBe(store2)
    })
  })

  describe("persistence scenarios", () => {
    it("simulates page reload by reading from disk", async () => {
      // Initial session saves state
      const state = createTestState({
        instanceId: "session-1",
        conversationContext: createTestContext({
          messages: [
            { role: "user", content: "Help me fix this bug" },
            { role: "assistant", content: "I see the issue..." },
          ],
        }),
        status: "running",
        currentTaskId: "task-123",
      })
      await store.save(state)

      // Simulate page reload - create new store instance
      const newStore = new SessionStateStore(testDir)
      const restored = await newStore.load("session-1")

      expect(restored).not.toBeNull()
      expect(restored?.conversationContext.messages).toHaveLength(2)
      expect(restored?.status).toBe("running")
      expect(restored?.currentTaskId).toBe("task-123")
    })

    it("handles completed session cleanup", async () => {
      // Save state during session
      await store.save(createTestState({ instanceId: "session-1", status: "running" }))

      // Session completes - delete state
      await store.delete("session-1")

      // After reload, no state should exist
      const newStore = new SessionStateStore(testDir)
      const restored = await newStore.load("session-1")
      expect(restored).toBeNull()
    })

    it("preserves multiple instance states independently", async () => {
      await store.save(
        createTestState({
          instanceId: "instance-1",
          currentTaskId: "task-a",
        }),
      )
      await store.save(
        createTestState({
          instanceId: "instance-2",
          currentTaskId: "task-b",
        }),
      )

      const newStore = new SessionStateStore(testDir)
      const state1 = await newStore.load("instance-1")
      const state2 = await newStore.load("instance-2")

      expect(state1?.currentTaskId).toBe("task-a")
      expect(state2?.currentTaskId).toBe("task-b")
    })
  })
})
