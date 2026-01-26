import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { mkdir, rm, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { randomBytes } from "node:crypto"
import {
  SessionEventPersister,
  getSessionEventPersister,
  resetSessionEventPersisters,
} from "./SessionEventPersister"
import type { RalphEvent } from "./RalphManager"

describe("SessionEventPersister", () => {
  let testDir: string
  let persister: SessionEventPersister

  /**
   * Create a unique test directory for each test
   */
  beforeEach(async () => {
    testDir = join(tmpdir(), `session-event-test-${randomBytes(8).toString("hex")}`)
    await mkdir(testDir, { recursive: true })
    persister = new SessionEventPersister(testDir)
    resetSessionEventPersisters()
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
   * Helper to create a test event
   */
  function createTestEvent(overrides: Partial<RalphEvent> = {}): RalphEvent {
    return {
      type: overrides.type ?? "message",
      timestamp: overrides.timestamp ?? Date.now(),
      ...overrides,
    }
  }

  describe("constructor and paths", () => {
    it("stores the workspace path", () => {
      expect(persister.getWorkspacePath()).toBe(testDir)
    })

    it("constructs the correct store directory", () => {
      expect(persister.getStoreDir()).toBe(join(testDir, ".ralph"))
    })
  })

  describe("has", () => {
    it("returns false when event file does not exist", async () => {
      expect(await persister.has("non-existent")).toBe(false)
    })

    it("returns true when event file exists", async () => {
      await persister.appendEvent("test-1", createTestEvent())
      expect(await persister.has("test-1")).toBe(true)
    })
  })

  describe("appendEvent and readEvents", () => {
    it("appends and reads a single event", async () => {
      const event = createTestEvent({ type: "user_message", content: "Hello" })
      await persister.appendEvent("test-1", event)
      const events = await persister.readEvents("test-1")

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe("user_message")
      expect(events[0].content).toBe("Hello")
    })

    it("returns empty array for non-existent instance", async () => {
      const events = await persister.readEvents("non-existent")
      expect(events).toEqual([])
    })

    it("appends multiple events in sequence", async () => {
      await persister.appendEvent("test-1", createTestEvent({ type: "event-1" }))
      await persister.appendEvent("test-1", createTestEvent({ type: "event-2" }))
      await persister.appendEvent("test-1", createTestEvent({ type: "event-3" }))

      const events = await persister.readEvents("test-1")

      expect(events).toHaveLength(3)
      expect(events[0].type).toBe("event-1")
      expect(events[1].type).toBe("event-2")
      expect(events[2].type).toBe("event-3")
    })

    it("creates the .ralph directory if it does not exist", async () => {
      await persister.appendEvent("test-1", createTestEvent())

      // Verify the file was created
      const content = await readFile(
        join(testDir, ".ralph", "session-events-test-1.jsonl"),
        "utf-8",
      )
      expect(content).toContain("message")
    })

    it("preserves complex event data", async () => {
      const event = createTestEvent({
        type: "tool_use",
        tool: "Read",
        input: { path: "/foo/bar.ts" },
        nested: { deep: { value: [1, 2, 3] } },
      })
      await persister.appendEvent("test-1", event)
      const events = await persister.readEvents("test-1")

      expect(events[0].type).toBe("tool_use")
      expect(events[0].tool).toBe("Read")
      expect(events[0].input).toEqual({ path: "/foo/bar.ts" })
      expect(events[0].nested).toEqual({ deep: { value: [1, 2, 3] } })
    })
  })

  describe("appendEvents", () => {
    it("appends multiple events at once", async () => {
      const events = [
        createTestEvent({ type: "event-1" }),
        createTestEvent({ type: "event-2" }),
        createTestEvent({ type: "event-3" }),
      ]
      await persister.appendEvents("test-1", events)

      const readBack = await persister.readEvents("test-1")

      expect(readBack).toHaveLength(3)
      expect(readBack.map(e => e.type)).toEqual(["event-1", "event-2", "event-3"])
    })

    it("handles empty array", async () => {
      await persister.appendEvents("test-1", [])
      expect(await persister.has("test-1")).toBe(false)
    })

    it("works with existing events", async () => {
      await persister.appendEvent("test-1", createTestEvent({ type: "existing" }))
      await persister.appendEvents("test-1", [
        createTestEvent({ type: "new-1" }),
        createTestEvent({ type: "new-2" }),
      ])

      const events = await persister.readEvents("test-1")

      expect(events).toHaveLength(3)
      expect(events.map(e => e.type)).toEqual(["existing", "new-1", "new-2"])
    })
  })

  describe("clear", () => {
    it("deletes an existing event file", async () => {
      await persister.appendEvent("test-1", createTestEvent())

      const deleted = await persister.clear("test-1")

      expect(deleted).toBe(true)
      expect(await persister.readEvents("test-1")).toEqual([])
      expect(await persister.has("test-1")).toBe(false)
    })

    it("returns false for non-existent file", async () => {
      const deleted = await persister.clear("non-existent")
      expect(deleted).toBe(false)
    })

    it("does not affect other instances", async () => {
      await persister.appendEvent("test-1", createTestEvent({ type: "event-1" }))
      await persister.appendEvent("test-2", createTestEvent({ type: "event-2" }))

      await persister.clear("test-1")

      expect(await persister.readEvents("test-1")).toEqual([])
      const events2 = await persister.readEvents("test-2")
      expect(events2).toHaveLength(1)
      expect(events2[0].type).toBe("event-2")
    })
  })

  describe("reset", () => {
    it("creates empty file if none exists", async () => {
      await persister.reset("test-1")

      expect(await persister.has("test-1")).toBe(true)
      expect(await persister.readEvents("test-1")).toEqual([])
    })

    it("clears existing events", async () => {
      await persister.appendEvent("test-1", createTestEvent())
      await persister.appendEvent("test-1", createTestEvent())

      await persister.reset("test-1")

      expect(await persister.readEvents("test-1")).toEqual([])
    })
  })

  describe("getEventCount", () => {
    it("returns 0 for non-existent file", async () => {
      expect(await persister.getEventCount("non-existent")).toBe(0)
    })

    it("returns 0 for empty file", async () => {
      await persister.reset("test-1")
      expect(await persister.getEventCount("test-1")).toBe(0)
    })

    it("returns correct count", async () => {
      await persister.appendEvent("test-1", createTestEvent())
      await persister.appendEvent("test-1", createTestEvent())
      await persister.appendEvent("test-1", createTestEvent())

      expect(await persister.getEventCount("test-1")).toBe(3)
    })
  })

  describe("clearAll", () => {
    it("clears all session event files", async () => {
      await persister.appendEvent("test-1", createTestEvent())
      await persister.appendEvent("test-2", createTestEvent())
      await persister.appendEvent("test-3", createTestEvent())

      await persister.clearAll()

      expect(await persister.has("test-1")).toBe(false)
      expect(await persister.has("test-2")).toBe(false)
      expect(await persister.has("test-3")).toBe(false)
    })

    it("handles non-existent directory", async () => {
      const newPersister = new SessionEventPersister(join(testDir, "new-workspace"))
      await newPersister.clearAll() // Should not throw
    })
  })

  describe("file format", () => {
    it("stores data in JSONL format", async () => {
      const event1 = createTestEvent({ type: "event-1", timestamp: 1000 })
      const event2 = createTestEvent({ type: "event-2", timestamp: 2000 })
      await persister.appendEvent("test-1", event1)
      await persister.appendEvent("test-1", event2)

      const content = await readFile(
        join(testDir, ".ralph", "session-events-test-1.jsonl"),
        "utf-8",
      )
      const lines = content.trim().split("\n")

      expect(lines).toHaveLength(2)
      expect(JSON.parse(lines[0]).type).toBe("event-1")
      expect(JSON.parse(lines[1]).type).toBe("event-2")
    })

    it("handles invalid JSON lines gracefully", async () => {
      await mkdir(join(testDir, ".ralph"), { recursive: true })
      await writeFile(
        join(testDir, ".ralph", "session-events-test-1.jsonl"),
        '{"type":"valid"}\ninvalid json line\n{"type":"also-valid"}\n',
        "utf-8",
      )

      const events = await persister.readEvents("test-1")

      expect(events).toHaveLength(2)
      expect(events[0].type).toBe("valid")
      expect(events[1].type).toBe("also-valid")
    })

    it("handles empty lines gracefully", async () => {
      await mkdir(join(testDir, ".ralph"), { recursive: true })
      await writeFile(
        join(testDir, ".ralph", "session-events-test-1.jsonl"),
        '{"type":"event-1"}\n\n\n{"type":"event-2"}\n',
        "utf-8",
      )

      const events = await persister.readEvents("test-1")

      expect(events).toHaveLength(2)
    })
  })

  describe("getSessionEventPersister singleton", () => {
    it("returns the same persister for the same workspace path", () => {
      const p1 = getSessionEventPersister(testDir)
      const p2 = getSessionEventPersister(testDir)
      expect(p1).toBe(p2)
    })

    it("returns different persisters for different workspace paths", async () => {
      const testDir2 = join(tmpdir(), `session-event-test-2-${randomBytes(8).toString("hex")}`)
      await mkdir(testDir2, { recursive: true })

      try {
        const p1 = getSessionEventPersister(testDir)
        const p2 = getSessionEventPersister(testDir2)
        expect(p1).not.toBe(p2)
      } finally {
        await rm(testDir2, { recursive: true, force: true })
      }
    })

    it("can be reset for testing", () => {
      const p1 = getSessionEventPersister(testDir)
      resetSessionEventPersisters()
      const p2 = getSessionEventPersister(testDir)
      expect(p1).not.toBe(p2)
    })
  })

  describe("persistence scenarios", () => {
    it("simulates page reload by reading from disk", async () => {
      // Initial session writes events
      await persister.appendEvent(
        "session-1",
        createTestEvent({ type: "user_message", content: "Hello" }),
      )
      await persister.appendEvent(
        "session-1",
        createTestEvent({ type: "assistant", content: "Hi!" }),
      )
      await persister.appendEvent("session-1", createTestEvent({ type: "tool_use", tool: "Read" }))

      // Simulate page reload - create new persister instance
      const newPersister = new SessionEventPersister(testDir)
      const restored = await newPersister.readEvents("session-1")

      expect(restored).toHaveLength(3)
      expect(restored[0].content).toBe("Hello")
      expect(restored[1].content).toBe("Hi!")
      expect(restored[2].tool).toBe("Read")
    })

    it("handles completed session cleanup", async () => {
      // Write events during session
      await persister.appendEvent("session-1", createTestEvent())
      await persister.appendEvent("session-1", createTestEvent())

      // Session completes - clear events
      await persister.clear("session-1")

      // After reload, no events should exist
      const newPersister = new SessionEventPersister(testDir)
      const restored = await newPersister.readEvents("session-1")
      expect(restored).toEqual([])
    })

    it("preserves multiple instance events independently", async () => {
      await persister.appendEvent("instance-1", createTestEvent({ type: "task-a" }))
      await persister.appendEvent("instance-2", createTestEvent({ type: "task-b" }))

      const newPersister = new SessionEventPersister(testDir)
      const events1 = await newPersister.readEvents("instance-1")
      const events2 = await newPersister.readEvents("instance-2")

      expect(events1[0].type).toBe("task-a")
      expect(events2[0].type).toBe("task-b")
    })
  })
})
