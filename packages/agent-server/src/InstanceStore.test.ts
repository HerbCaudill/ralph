import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { InstanceStore, getInstanceStore, resetInstanceStores, type PersistedInstance } from "./InstanceStore.js"
import { mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"

describe("InstanceStore", () => {
  let tempDir: string
  let store: InstanceStore

  const createInstance = (overrides: Partial<PersistedInstance> = {}): PersistedInstance => ({
    id: "inst-1",
    name: "TestInstance",
    workspace: tempDir,
    agentName: "Ralph-1",
    worktreePath: null,
    branch: null,
    status: "stopped",
    createdAt: Date.now(),
    currentTaskId: null,
    ...overrides,
  })

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "instance-store-test-"))
    store = new InstanceStore(tempDir)
    resetInstanceStores()
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it("can be instantiated", () => {
    expect(store).toBeInstanceOf(InstanceStore)
    expect(store.getWorkspacePath()).toBe(tempDir)
    expect(store.getStorePath()).toBe(join(tempDir, ".ralph", "instances.json"))
  })

  describe("exists", () => {
    it("returns false when store file does not exist", async () => {
      expect(await store.exists()).toBe(false)
    })

    it("returns true after saving an instance", async () => {
      await store.save(createInstance())
      expect(await store.exists()).toBe(true)
    })
  })

  describe("save/get/getAll", () => {
    it("saves and retrieves an instance", async () => {
      const instance = createInstance()
      await store.save(instance)

      const retrieved = await store.get("inst-1")
      expect(retrieved).toEqual(instance)
    })

    it("returns null for non-existent instance", async () => {
      expect(await store.get("nonexistent")).toBeNull()
    })

    it("returns all saved instances", async () => {
      await store.save(createInstance({ id: "a", name: "A" }))
      await store.save(createInstance({ id: "b", name: "B" }))

      const all = await store.getAll()
      expect(all).toHaveLength(2)
    })
  })

  describe("has", () => {
    it("returns true for existing instance", async () => {
      await store.save(createInstance())
      expect(await store.has("inst-1")).toBe(true)
    })

    it("returns false for non-existent instance", async () => {
      expect(await store.has("nonexistent")).toBe(false)
    })
  })

  describe("saveAll", () => {
    it("saves multiple instances at once", async () => {
      await store.saveAll([
        createInstance({ id: "a", name: "A" }),
        createInstance({ id: "b", name: "B" }),
      ])

      expect(await store.count()).toBe(2)
    })
  })

  describe("update", () => {
    it("updates specific fields", async () => {
      await store.save(createInstance())
      const updated = await store.update("inst-1", { status: "running" })

      expect(updated).not.toBeNull()
      expect(updated!.status).toBe("running")
      expect(updated!.name).toBe("TestInstance") // unchanged
    })

    it("returns null for non-existent instance", async () => {
      expect(await store.update("nonexistent", { status: "running" })).toBeNull()
    })
  })

  describe("remove", () => {
    it("removes an instance", async () => {
      await store.save(createInstance())
      expect(await store.remove("inst-1")).toBe(true)
      expect(await store.get("inst-1")).toBeNull()
    })

    it("returns false for non-existent instance", async () => {
      expect(await store.remove("nonexistent")).toBe(false)
    })
  })

  describe("clear", () => {
    it("removes all instances", async () => {
      await store.save(createInstance({ id: "a", name: "A" }))
      await store.save(createInstance({ id: "b", name: "B" }))

      await store.clear()
      expect(await store.count()).toBe(0)
    })
  })

  describe("count", () => {
    it("returns 0 for empty store", async () => {
      expect(await store.count()).toBe(0)
    })

    it("returns correct count", async () => {
      await store.save(createInstance({ id: "a" }))
      await store.save(createInstance({ id: "b" }))
      expect(await store.count()).toBe(2)
    })
  })

  describe("getRunningInstances", () => {
    it("returns only non-stopped instances", async () => {
      await store.save(createInstance({ id: "running", status: "running" }))
      await store.save(createInstance({ id: "stopped", status: "stopped" }))
      await store.save(createInstance({ id: "paused", status: "paused" }))

      const running = await store.getRunningInstances()
      expect(running).toHaveLength(2)
      expect(running.map(i => i.id).sort()).toEqual(["paused", "running"])
    })
  })

  describe("markAllStopped", () => {
    it("marks all instances as stopped", async () => {
      await store.save(createInstance({ id: "a", status: "running" }))
      await store.save(createInstance({ id: "b", status: "paused" }))

      await store.markAllStopped()

      const all = await store.getAll()
      expect(all.every(i => i.status === "stopped")).toBe(true)
    })
  })

  describe("updateStatus", () => {
    it("updates instance status", async () => {
      await store.save(createInstance())
      expect(await store.updateStatus("inst-1", "running")).toBe(true)

      const instance = await store.get("inst-1")
      expect(instance!.status).toBe("running")
    })

    it("returns false for non-existent instance", async () => {
      expect(await store.updateStatus("nonexistent", "running")).toBe(false)
    })
  })

  describe("updateCurrentTask", () => {
    it("updates current task ID", async () => {
      await store.save(createInstance())
      expect(await store.updateCurrentTask("inst-1", "task-42")).toBe(true)

      const instance = await store.get("inst-1")
      expect(instance!.currentTaskId).toBe("task-42")
    })
  })
})

describe("getInstanceStore", () => {
  beforeEach(() => {
    resetInstanceStores()
  })

  it("returns the same store for the same workspace", () => {
    const store1 = getInstanceStore("/tmp/workspace")
    const store2 = getInstanceStore("/tmp/workspace")
    expect(store1).toBe(store2)
  })

  it("returns different stores for different workspaces", () => {
    const store1 = getInstanceStore("/tmp/workspace1")
    const store2 = getInstanceStore("/tmp/workspace2")
    expect(store1).not.toBe(store2)
  })
})

describe("resetInstanceStores", () => {
  it("clears the store cache", () => {
    const store1 = getInstanceStore("/tmp/workspace")
    resetInstanceStores()
    const store2 = getInstanceStore("/tmp/workspace")
    expect(store1).not.toBe(store2)
  })
})
