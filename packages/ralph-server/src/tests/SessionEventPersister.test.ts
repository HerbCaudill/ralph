import { describe, it, expect, beforeEach, afterEach } from "vitest"
import {
  SessionEventPersister,
  getSessionEventPersister,
  resetSessionEventPersisters,
} from ".././SessionEventPersister.js"
import type { RalphEvent } from ".././RalphManager.js"
import { mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"

describe("SessionEventPersister", () => {
  let tempDir: string
  let persister: SessionEventPersister

  const event1: RalphEvent = { type: "message", content: "hello", timestamp: 1000 }
  const event2: RalphEvent = { type: "tool_use", tool: "bash", timestamp: 2000 }

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "session-event-persister-test-"))
    persister = new SessionEventPersister(tempDir)
    resetSessionEventPersisters()
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it("can be instantiated", () => {
    expect(persister).toBeInstanceOf(SessionEventPersister)
    expect(persister.getWorkspacePath()).toBe(tempDir)
    expect(persister.getStoreDir()).toBe(join(tempDir, ".ralph"))
  })

  describe("has", () => {
    it("returns false when no events exist", async () => {
      expect(await persister.has("inst-1")).toBe(false)
    })

    it("returns true after appending events", async () => {
      await persister.appendEvent("inst-1", event1)
      expect(await persister.has("inst-1")).toBe(true)
    })
  })

  describe("appendEvent/readEvents", () => {
    it("appends and reads a single event", async () => {
      await persister.appendEvent("inst-1", event1)

      const events = await persister.readEvents("inst-1")
      expect(events).toHaveLength(1)
      expect(events[0]).toEqual(event1)
    })

    it("appends multiple events individually", async () => {
      await persister.appendEvent("inst-1", event1)
      await persister.appendEvent("inst-1", event2)

      const events = await persister.readEvents("inst-1")
      expect(events).toHaveLength(2)
    })

    it("returns empty array for non-existent instance", async () => {
      const events = await persister.readEvents("nonexistent")
      expect(events).toEqual([])
    })
  })

  describe("appendEvents", () => {
    it("appends multiple events at once", async () => {
      await persister.appendEvents("inst-1", [event1, event2])

      const events = await persister.readEvents("inst-1")
      expect(events).toHaveLength(2)
      expect(events[0]).toEqual(event1)
      expect(events[1]).toEqual(event2)
    })

    it("is a no-op for empty array", async () => {
      await persister.appendEvents("inst-1", [])
      expect(await persister.has("inst-1")).toBe(false)
    })
  })

  describe("clear", () => {
    it("removes event file for an instance", async () => {
      await persister.appendEvent("inst-1", event1)
      expect(await persister.clear("inst-1")).toBe(true)
      expect(await persister.has("inst-1")).toBe(false)
    })

    it("returns false for non-existent instance", async () => {
      expect(await persister.clear("nonexistent")).toBe(false)
    })
  })

  describe("reset", () => {
    it("creates an empty event file", async () => {
      await persister.appendEvent("inst-1", event1)
      await persister.reset("inst-1")

      const events = await persister.readEvents("inst-1")
      expect(events).toEqual([])
    })
  })

  describe("getEventCount", () => {
    it("returns 0 for non-existent instance", async () => {
      expect(await persister.getEventCount("nonexistent")).toBe(0)
    })

    it("returns correct count", async () => {
      await persister.appendEvents("inst-1", [event1, event2])
      expect(await persister.getEventCount("inst-1")).toBe(2)
    })

    it("returns 0 after reset", async () => {
      await persister.appendEvent("inst-1", event1)
      await persister.reset("inst-1")
      expect(await persister.getEventCount("inst-1")).toBe(0)
    })
  })

  describe("clearAll", () => {
    it("removes all event files", async () => {
      await persister.appendEvent("inst-1", event1)
      await persister.appendEvent("inst-2", event2)

      await persister.clearAll()

      expect(await persister.has("inst-1")).toBe(false)
      expect(await persister.has("inst-2")).toBe(false)
    })

    it("does not throw when directory does not exist", async () => {
      const freshPersister = new SessionEventPersister("/tmp/nonexistent-dir-" + Date.now())
      await expect(freshPersister.clearAll()).resolves.toBeUndefined()
    })
  })

  describe("isolation", () => {
    it("keeps events separate per instance", async () => {
      await persister.appendEvent("inst-1", event1)
      await persister.appendEvent("inst-2", event2)

      const events1 = await persister.readEvents("inst-1")
      const events2 = await persister.readEvents("inst-2")

      expect(events1).toHaveLength(1)
      expect(events1[0].type).toBe("message")

      expect(events2).toHaveLength(1)
      expect(events2[0].type).toBe("tool_use")
    })
  })
})

describe("getSessionEventPersister", () => {
  beforeEach(() => {
    resetSessionEventPersisters()
  })

  it("returns the same persister for the same workspace", () => {
    const p1 = getSessionEventPersister("/tmp/ws")
    const p2 = getSessionEventPersister("/tmp/ws")
    expect(p1).toBe(p2)
  })

  it("returns different persisters for different workspaces", () => {
    const p1 = getSessionEventPersister("/tmp/ws1")
    const p2 = getSessionEventPersister("/tmp/ws2")
    expect(p1).not.toBe(p2)
  })
})
