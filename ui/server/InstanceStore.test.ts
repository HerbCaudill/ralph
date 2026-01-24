import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { mkdir, rm, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { randomBytes } from "node:crypto"
import {
  InstanceStore,
  getInstanceStore,
  resetInstanceStores,
  type PersistedInstance,
} from "./InstanceStore"

describe("InstanceStore", () => {
  let testDir: string
  let store: InstanceStore

  /**
   * Create a unique test directory for each test
   */
  beforeEach(async () => {
    testDir = join(tmpdir(), `instance-store-test-${randomBytes(8).toString("hex")}`)
    await mkdir(testDir, { recursive: true })
    store = new InstanceStore(testDir)
    resetInstanceStores()
    // Suppress expected console output during tests
    vi.spyOn(console, "log").mockImplementation(() => {})
    vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  /**
   * Clean up after each test
   */
  afterEach(async () => {
    vi.restoreAllMocks()
    try {
      await rm(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  /**
   * Helper to create a test instance
   */
  function createTestInstance(overrides: Partial<PersistedInstance> = {}): PersistedInstance {
    return {
      id: overrides.id ?? randomBytes(4).toString("hex"),
      name: overrides.name ?? "Test Instance",
      workspace: overrides.workspace ?? testDir,
      agentName: overrides.agentName ?? "Ralph-Test",
      worktreePath: overrides.worktreePath ?? null,
      branch: overrides.branch ?? null,
      status: overrides.status ?? "stopped",
      createdAt: overrides.createdAt ?? Date.now(),
      currentTaskId: overrides.currentTaskId ?? null,
    }
  }

  describe("constructor and paths", () => {
    it("stores the workspace path", () => {
      expect(store.getWorkspacePath()).toBe(testDir)
    })

    it("constructs the correct store path", () => {
      expect(store.getStorePath()).toBe(join(testDir, ".ralph", "instances.json"))
    })
  })

  describe("exists", () => {
    it("returns false when store file does not exist", async () => {
      expect(await store.exists()).toBe(false)
    })

    it("returns true when store file exists", async () => {
      await mkdir(join(testDir, ".ralph"), { recursive: true })
      await writeFile(
        join(testDir, ".ralph", "instances.json"),
        JSON.stringify({ version: 1, instances: {} }),
      )
      expect(await store.exists()).toBe(true)
    })
  })

  describe("save and get", () => {
    it("saves and retrieves an instance", async () => {
      const instance = createTestInstance({ id: "test-1", name: "Alice" })

      await store.save(instance)
      const retrieved = await store.get("test-1")

      expect(retrieved).toEqual(instance)
    })

    it("returns null for non-existent instance", async () => {
      const retrieved = await store.get("non-existent")
      expect(retrieved).toBeNull()
    })

    it("overwrites existing instance with same ID", async () => {
      const instance1 = createTestInstance({ id: "test-1", name: "Alice" })
      const instance2 = createTestInstance({ id: "test-1", name: "Bob" })

      await store.save(instance1)
      await store.save(instance2)
      const retrieved = await store.get("test-1")

      expect(retrieved?.name).toBe("Bob")
    })

    it("creates the .ralph directory if it does not exist", async () => {
      const instance = createTestInstance()
      await store.save(instance)

      // Verify the file was created
      const content = await readFile(store.getStorePath(), "utf-8")
      expect(content).toContain(instance.id)
    })
  })

  describe("getAll", () => {
    it("returns empty array when store is empty", async () => {
      const instances = await store.getAll()
      expect(instances).toEqual([])
    })

    it("returns all saved instances", async () => {
      const instance1 = createTestInstance({ id: "test-1", name: "Alice" })
      const instance2 = createTestInstance({ id: "test-2", name: "Bob" })

      await store.save(instance1)
      await store.save(instance2)

      const instances = await store.getAll()
      expect(instances).toHaveLength(2)
      expect(instances.find(i => i.id === "test-1")?.name).toBe("Alice")
      expect(instances.find(i => i.id === "test-2")?.name).toBe("Bob")
    })
  })

  describe("has", () => {
    it("returns false for non-existent instance", async () => {
      expect(await store.has("non-existent")).toBe(false)
    })

    it("returns true for existing instance", async () => {
      const instance = createTestInstance({ id: "test-1" })
      await store.save(instance)
      expect(await store.has("test-1")).toBe(true)
    })
  })

  describe("saveAll", () => {
    it("saves multiple instances at once", async () => {
      const instances = [
        createTestInstance({ id: "test-1", name: "Alice" }),
        createTestInstance({ id: "test-2", name: "Bob" }),
        createTestInstance({ id: "test-3", name: "Charlie" }),
      ]

      await store.saveAll(instances)

      const all = await store.getAll()
      expect(all).toHaveLength(3)
    })

    it("merges with existing instances", async () => {
      const existing = createTestInstance({ id: "existing", name: "Existing" })
      await store.save(existing)

      const newInstances = [
        createTestInstance({ id: "new-1", name: "New 1" }),
        createTestInstance({ id: "new-2", name: "New 2" }),
      ]
      await store.saveAll(newInstances)

      const all = await store.getAll()
      expect(all).toHaveLength(3)
      expect(all.find(i => i.id === "existing")).toBeDefined()
    })
  })

  describe("update", () => {
    it("updates specific fields of an instance", async () => {
      const instance = createTestInstance({ id: "test-1", name: "Alice", status: "stopped" })
      await store.save(instance)

      const updated = await store.update("test-1", { status: "running", name: "Alice Updated" })

      expect(updated?.status).toBe("running")
      expect(updated?.name).toBe("Alice Updated")
      expect(updated?.id).toBe("test-1") // ID unchanged
    })

    it("returns null for non-existent instance", async () => {
      const updated = await store.update("non-existent", { status: "running" })
      expect(updated).toBeNull()
    })

    it("persists updates to disk", async () => {
      const instance = createTestInstance({ id: "test-1", status: "stopped" })
      await store.save(instance)
      await store.update("test-1", { status: "running" })

      // Create a new store instance to verify persistence
      const newStore = new InstanceStore(testDir)
      const retrieved = await newStore.get("test-1")
      expect(retrieved?.status).toBe("running")
    })
  })

  describe("remove", () => {
    it("removes an existing instance", async () => {
      const instance = createTestInstance({ id: "test-1" })
      await store.save(instance)

      const removed = await store.remove("test-1")

      expect(removed).toBe(true)
      expect(await store.get("test-1")).toBeNull()
    })

    it("returns false for non-existent instance", async () => {
      const removed = await store.remove("non-existent")
      expect(removed).toBe(false)
    })

    it("does not affect other instances", async () => {
      const instance1 = createTestInstance({ id: "test-1" })
      const instance2 = createTestInstance({ id: "test-2" })
      await store.save(instance1)
      await store.save(instance2)

      await store.remove("test-1")

      expect(await store.get("test-1")).toBeNull()
      expect(await store.get("test-2")).not.toBeNull()
    })
  })

  describe("clear", () => {
    it("removes all instances", async () => {
      await store.save(createTestInstance({ id: "test-1" }))
      await store.save(createTestInstance({ id: "test-2" }))

      await store.clear()

      const all = await store.getAll()
      expect(all).toEqual([])
    })
  })

  describe("count", () => {
    it("returns 0 for empty store", async () => {
      expect(await store.count()).toBe(0)
    })

    it("returns correct count", async () => {
      await store.save(createTestInstance({ id: "test-1" }))
      await store.save(createTestInstance({ id: "test-2" }))
      await store.save(createTestInstance({ id: "test-3" }))

      expect(await store.count()).toBe(3)
    })
  })

  describe("getRunningInstances", () => {
    it("returns only non-stopped instances", async () => {
      await store.save(createTestInstance({ id: "stopped-1", status: "stopped" }))
      await store.save(createTestInstance({ id: "running-1", status: "running" }))
      await store.save(createTestInstance({ id: "paused-1", status: "paused" }))
      await store.save(createTestInstance({ id: "stopped-2", status: "stopped" }))

      const running = await store.getRunningInstances()

      expect(running).toHaveLength(2)
      expect(running.find(i => i.id === "running-1")).toBeDefined()
      expect(running.find(i => i.id === "paused-1")).toBeDefined()
    })

    it("returns empty array when all instances are stopped", async () => {
      await store.save(createTestInstance({ id: "stopped-1", status: "stopped" }))
      await store.save(createTestInstance({ id: "stopped-2", status: "stopped" }))

      const running = await store.getRunningInstances()
      expect(running).toEqual([])
    })
  })

  describe("markAllStopped", () => {
    it("sets all instances to stopped status", async () => {
      await store.save(createTestInstance({ id: "running-1", status: "running" }))
      await store.save(createTestInstance({ id: "paused-1", status: "paused" }))
      await store.save(createTestInstance({ id: "starting-1", status: "starting" }))

      await store.markAllStopped()

      const all = await store.getAll()
      expect(all.every(i => i.status === "stopped")).toBe(true)
    })
  })

  describe("updateStatus", () => {
    it("updates the status of an instance", async () => {
      await store.save(createTestInstance({ id: "test-1", status: "stopped" }))

      const updated = await store.updateStatus("test-1", "running")

      expect(updated).toBe(true)
      const instance = await store.get("test-1")
      expect(instance?.status).toBe("running")
    })

    it("returns false for non-existent instance", async () => {
      const updated = await store.updateStatus("non-existent", "running")
      expect(updated).toBe(false)
    })
  })

  describe("updateCurrentTask", () => {
    it("updates the current task ID", async () => {
      await store.save(createTestInstance({ id: "test-1", currentTaskId: null }))

      const updated = await store.updateCurrentTask("test-1", "task-123")

      expect(updated).toBe(true)
      const instance = await store.get("test-1")
      expect(instance?.currentTaskId).toBe("task-123")
    })

    it("can set current task ID to null", async () => {
      await store.save(createTestInstance({ id: "test-1", currentTaskId: "task-123" }))

      const updated = await store.updateCurrentTask("test-1", null)

      expect(updated).toBe(true)
      const instance = await store.get("test-1")
      expect(instance?.currentTaskId).toBeNull()
    })

    it("returns false for non-existent instance", async () => {
      const updated = await store.updateCurrentTask("non-existent", "task-123")
      expect(updated).toBe(false)
    })
  })

  describe("file format", () => {
    it("stores data in the correct format", async () => {
      const instance = createTestInstance({ id: "test-1", name: "Alice" })
      await store.save(instance)

      const content = await readFile(store.getStorePath(), "utf-8")
      const data = JSON.parse(content)

      expect(data.version).toBe(1)
      expect(data.instances).toBeDefined()
      expect(data.instances["test-1"]).toEqual(instance)
    })

    it("handles unknown version gracefully", async () => {
      await mkdir(join(testDir, ".ralph"), { recursive: true })
      await writeFile(
        store.getStorePath(),
        JSON.stringify({ version: 999, instances: { "old-instance": { id: "old-instance" } } }),
      )

      // Should create a fresh store, not crash
      const instances = await store.getAll()
      expect(instances).toEqual([])
    })
  })

  describe("getInstanceStore singleton", () => {
    it("returns the same store for the same workspace path", () => {
      const store1 = getInstanceStore(testDir)
      const store2 = getInstanceStore(testDir)
      expect(store1).toBe(store2)
    })

    it("returns different stores for different workspace paths", async () => {
      const testDir2 = join(tmpdir(), `instance-store-test-2-${randomBytes(8).toString("hex")}`)
      await mkdir(testDir2, { recursive: true })

      try {
        const store1 = getInstanceStore(testDir)
        const store2 = getInstanceStore(testDir2)
        expect(store1).not.toBe(store2)
      } finally {
        await rm(testDir2, { recursive: true, force: true })
      }
    })

    it("can be reset for testing", () => {
      const store1 = getInstanceStore(testDir)
      resetInstanceStores()
      const store2 = getInstanceStore(testDir)
      expect(store1).not.toBe(store2)
    })
  })

  describe("persistence scenarios", () => {
    it("simulates server restart by reading from disk", async () => {
      // Initial "server" saves instances
      const instance1 = createTestInstance({ id: "alice", name: "Alice", status: "running" })
      const instance2 = createTestInstance({ id: "bob", name: "Bob", status: "paused" })
      await store.save(instance1)
      await store.save(instance2)

      // Simulate server restart - create new store instance
      const newStore = new InstanceStore(testDir)
      const runningInstances = await newStore.getRunningInstances()

      expect(runningInstances).toHaveLength(2)
      expect(runningInstances.find(i => i.name === "Alice")).toBeDefined()
      expect(runningInstances.find(i => i.name === "Bob")).toBeDefined()
    })

    it("handles clean shutdown by marking all stopped", async () => {
      await store.save(createTestInstance({ id: "alice", status: "running" }))
      await store.save(createTestInstance({ id: "bob", status: "paused" }))

      // Clean shutdown marks all as stopped
      await store.markAllStopped()

      // After restart, no instances should be considered "running"
      const newStore = new InstanceStore(testDir)
      const runningInstances = await newStore.getRunningInstances()
      expect(runningInstances).toEqual([])
    })
  })
})
