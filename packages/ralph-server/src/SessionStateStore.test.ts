import { describe, it, expect, beforeEach, afterEach } from "vitest"
import {
  SessionStateStore,
  getSessionStateStore,
  resetSessionStateStores,
  type PersistedSessionState,
} from "./SessionStateStore.js"
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"

describe("SessionStateStore", () => {
  let tempDir: string
  let store: SessionStateStore

  const createState = (overrides: Partial<PersistedSessionState> = {}): PersistedSessionState => ({
    instanceId: "inst-1",
    conversationContext: {
      messages: [
        { role: "user", content: "hello", timestamp: 1000 },
        { role: "assistant", content: "hi there", timestamp: 1001 },
      ],
      lastPrompt: "hello",
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      timestamp: Date.now(),
    },
    status: "running",
    currentTaskId: "task-1",
    savedAt: Date.now(),
    version: 1,
    ...overrides,
  })

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "session-state-store-test-"))
    store = new SessionStateStore(tempDir)
    resetSessionStateStores()
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it("can be instantiated", () => {
    expect(store).toBeInstanceOf(SessionStateStore)
    expect(store.getWorkspacePath()).toBe(tempDir)
    expect(store.getStoreDir()).toBe(join(tempDir, ".ralph", "sessions"))
  })

  describe("exists", () => {
    it("returns false when store directory does not exist", async () => {
      expect(await store.exists()).toBe(false)
    })

    it("returns true after saving state", async () => {
      await store.save(createState())
      expect(await store.exists()).toBe(true)
    })
  })

  describe("has", () => {
    it("returns false when state does not exist", async () => {
      expect(await store.has("inst-1")).toBe(false)
    })

    it("returns true after saving", async () => {
      await store.save(createState())
      expect(await store.has("inst-1")).toBe(true)
    })
  })

  describe("save/load", () => {
    it("saves and loads session state", async () => {
      const state = createState()
      await store.save(state)

      const loaded = await store.load("inst-1")
      expect(loaded).not.toBeNull()
      expect(loaded!.instanceId).toBe("inst-1")
      expect(loaded!.conversationContext.messages).toHaveLength(2)
      expect(loaded!.status).toBe("running")
      expect(loaded!.version).toBe(1)
    })

    it("returns null for non-existent instance", async () => {
      expect(await store.load("nonexistent")).toBeNull()
    })

    it("overwrites savedAt on save", async () => {
      const before = Date.now()
      await store.save(createState({ savedAt: 0 }))
      const loaded = await store.load("inst-1")
      expect(loaded!.savedAt).toBeGreaterThanOrEqual(before)
    })
  })

  describe("delete", () => {
    it("deletes session state", async () => {
      await store.save(createState())
      expect(await store.delete("inst-1")).toBe(true)
      expect(await store.load("inst-1")).toBeNull()
    })

    it("returns false for non-existent instance", async () => {
      expect(await store.delete("nonexistent")).toBe(false)
    })
  })

  describe("getAll", () => {
    it("returns empty array when no states exist", async () => {
      expect(await store.getAll()).toEqual([])
    })

    it("returns all saved states", async () => {
      await store.save(createState({ instanceId: "a" }))
      await store.save(createState({ instanceId: "b" }))

      const all = await store.getAll()
      expect(all).toHaveLength(2)
    })
  })

  describe("getAllInstanceIds", () => {
    it("returns empty array when no states exist", async () => {
      expect(await store.getAllInstanceIds()).toEqual([])
    })

    it("returns all instance IDs", async () => {
      await store.save(createState({ instanceId: "a" }))
      await store.save(createState({ instanceId: "b" }))

      const ids = await store.getAllInstanceIds()
      expect(ids.sort()).toEqual(["a", "b"])
    })
  })

  describe("count", () => {
    it("returns 0 when empty", async () => {
      expect(await store.count()).toBe(0)
    })

    it("returns correct count", async () => {
      await store.save(createState({ instanceId: "a" }))
      await store.save(createState({ instanceId: "b" }))
      expect(await store.count()).toBe(2)
    })
  })

  describe("cleanupStale", () => {
    it("removes states older than threshold", async () => {
      // save() overwrites savedAt with Date.now(), so we need to write the
      // "old" state file directly to get a genuinely old timestamp.
      const sessionsDir = join(tempDir, ".ralph", "sessions")
      await mkdir(sessionsDir, { recursive: true })

      const oldState: PersistedSessionState = {
        ...createState({ instanceId: "old" }),
        savedAt: 1000, // very old timestamp
      }
      await writeFile(join(sessionsDir, "old.json"), JSON.stringify(oldState, null, 2), "utf-8")

      // Save a "new" state normally (gets current timestamp)
      await store.save(createState({ instanceId: "new" }))

      // Clean up anything older than 1 hour
      const removed = await store.cleanupStale(60 * 60 * 1000)

      // The old state should be removed
      expect(removed).toBe(1)
      expect(await store.has("old")).toBe(false)
      expect(await store.has("new")).toBe(true)
    })

    it("returns 0 when no stale states exist", async () => {
      await store.save(createState())
      const removed = await store.cleanupStale(60 * 60 * 1000) // 1 hour
      expect(removed).toBe(0)
    })
  })

  describe("clear", () => {
    it("removes all saved states", async () => {
      await store.save(createState({ instanceId: "a" }))
      await store.save(createState({ instanceId: "b" }))

      await store.clear()
      expect(await store.count()).toBe(0)
    })
  })
})

describe("getSessionStateStore", () => {
  beforeEach(() => {
    resetSessionStateStores()
  })

  it("returns the same store for the same workspace", () => {
    const s1 = getSessionStateStore("/tmp/ws")
    const s2 = getSessionStateStore("/tmp/ws")
    expect(s1).toBe(s2)
  })

  it("returns different stores for different workspaces", () => {
    const s1 = getSessionStateStore("/tmp/ws1")
    const s2 = getSessionStateStore("/tmp/ws2")
    expect(s1).not.toBe(s2)
  })
})
