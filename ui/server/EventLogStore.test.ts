import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest"
import { rm, mkdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { EventLogStore, type EventLog, type EventLogStoreSummary } from "./EventLogStore.js"
import type { RalphEvent } from "./RalphManager.js"

// API response types for tests
interface ApiResponse<T> {
  ok: boolean
  error?: string
  eventlog?: T
  eventlogs?: T[]
}

describe("EventLogStore", () => {
  const testDir = join(tmpdir(), `ralph-ui-test-${Date.now()}`)
  let store: EventLogStore

  beforeEach(async () => {
    // Clean and recreate test directory for each test
    try {
      await rm(testDir, { recursive: true, force: true })
    } catch {
      // Directory might not exist
    }
    await mkdir(testDir, { recursive: true })
    store = new EventLogStore({ baseDir: testDir })
  })

  afterAll(async () => {
    // Clean up test directory
    try {
      await rm(testDir, { recursive: true, force: true })
    } catch {
      // Directory might not exist
    }
  })

  describe("create", () => {
    it("creates an event log with generated ID", async () => {
      const events: RalphEvent[] = [{ type: "test", timestamp: Date.now(), data: "hello" }]

      const eventLog = await store.create(events)

      expect(eventLog.id).toMatch(/^[a-f0-9]{8}$/)
      expect(eventLog.events).toEqual(events)
      expect(eventLog.createdAt).toBeDefined()
      expect(new Date(eventLog.createdAt).getTime()).toBeGreaterThan(0)
    })

    it("creates an event log with metadata", async () => {
      const events: RalphEvent[] = [{ type: "test", timestamp: Date.now() }]
      const metadata = {
        taskId: "rui-123",
        title: "Test Task",
        source: "test",
      }

      const eventLog = await store.create(events, metadata)

      expect(eventLog.metadata).toEqual(metadata)
    })

    it("creates unique IDs for multiple logs", async () => {
      const events: RalphEvent[] = [{ type: "test", timestamp: Date.now() }]

      const log1 = await store.create(events)
      const log2 = await store.create(events)
      const log3 = await store.create(events)

      expect(log1.id).not.toBe(log2.id)
      expect(log2.id).not.toBe(log3.id)
      expect(log1.id).not.toBe(log3.id)
    })
  })

  describe("get", () => {
    it("retrieves a created event log by ID", async () => {
      const events: RalphEvent[] = [
        { type: "assistant", timestamp: Date.now(), content: "Hello world" },
      ]
      const metadata = { taskId: "rui-456" }

      const created = await store.create(events, metadata)
      const retrieved = await store.get(created.id)

      expect(retrieved).toEqual(created)
    })

    it("returns null for non-existent ID", async () => {
      const result = await store.get("nonexistent")

      expect(result).toBeNull()
    })
  })

  describe("list", () => {
    it("returns empty array when no logs exist", async () => {
      const summaries = await store.list()

      expect(summaries).toEqual([])
    })

    it("returns summaries without full event data", async () => {
      const events: RalphEvent[] = [
        { type: "test1", timestamp: Date.now() },
        { type: "test2", timestamp: Date.now() },
        { type: "test3", timestamp: Date.now() },
      ]
      const metadata = { taskId: "rui-789" }

      await store.create(events, metadata)
      const summaries = await store.list()

      expect(summaries).toHaveLength(1)
      expect(summaries[0]).toHaveProperty("id")
      expect(summaries[0]).toHaveProperty("createdAt")
      expect(summaries[0].eventCount).toBe(3)
      expect(summaries[0].metadata).toEqual(metadata)
      // Should NOT have the full events array
      expect(summaries[0]).not.toHaveProperty("events")
    })

    it("returns multiple logs sorted by createdAt descending (newest first)", async () => {
      const events: RalphEvent[] = [{ type: "test", timestamp: Date.now() }]

      // Create logs with small delay to ensure different timestamps
      const log1 = await store.create(events, { title: "First" })
      await new Promise(resolve => setTimeout(resolve, 10))
      const log2 = await store.create(events, { title: "Second" })
      await new Promise(resolve => setTimeout(resolve, 10))
      const log3 = await store.create(events, { title: "Third" })

      const summaries = await store.list()

      expect(summaries).toHaveLength(3)
      // Newest first
      expect(summaries[0].id).toBe(log3.id)
      expect(summaries[1].id).toBe(log2.id)
      expect(summaries[2].id).toBe(log1.id)
    })
  })
})

describe("EventLogStore API endpoints", () => {
  // Tests for the REST API endpoints
  // These test the integration via the actual server routes

  const testDir = join(tmpdir(), `ralph-ui-api-test-${Date.now()}`)
  let store: EventLogStore
  let port: number
  let server: import("node:http").Server
  let app: import("express").Express

  // Use beforeAll to create the server once for all tests in this suite
  beforeEach(async () => {
    // Clean and recreate test directory
    try {
      await rm(testDir, { recursive: true, force: true })
    } catch {
      // Directory might not exist
    }
    await mkdir(testDir, { recursive: true })
    store = new EventLogStore({ baseDir: testDir })

    // Create a simple test server for API tests
    const express = await import("express")
    const http = await import("node:http")

    app = express.default()
    app.use(express.default.json())

    // POST /api/eventlogs
    app.post("/api/eventlogs", async (req, res) => {
      try {
        const { events, metadata } = req.body as {
          events?: RalphEvent[]
          metadata?: { taskId?: string; title?: string }
        }

        if (!events || !Array.isArray(events)) {
          res.status(400).json({ ok: false, error: "Events array is required" })
          return
        }

        const eventLog = await store.create(events, metadata)
        res.status(201).json({ ok: true, eventlog: eventLog })
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create event log"
        res.status(500).json({ ok: false, error: message })
      }
    })

    // GET /api/eventlogs/:id
    app.get("/api/eventlogs/:id", async (req, res) => {
      try {
        const { id } = req.params
        const eventLog = await store.get(id)

        if (!eventLog) {
          res.status(404).json({ ok: false, error: "Event log not found" })
          return
        }

        res.status(200).json({ ok: true, eventlog: eventLog })
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to get event log"
        res.status(500).json({ ok: false, error: message })
      }
    })

    // GET /api/eventlogs
    app.get("/api/eventlogs", async (_req, res) => {
      try {
        const summaries = await store.list()
        res.status(200).json({ ok: true, eventlogs: summaries })
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to list event logs"
        res.status(500).json({ ok: false, error: message })
      }
    })

    // Find available port using a more unique random port
    port = 4100 + Math.floor(Math.random() * 1000)
    server = http.createServer(app)

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject)
      server.listen(port, "localhost", () => {
        server.removeListener("error", reject)
        resolve()
      })
    })
  })

  afterEach(async () => {
    // Close server after each test
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close(err => {
          if (err) reject(err)
          else resolve()
        })
      })
    }
  })

  afterAll(async () => {
    // Clean up test directory
    try {
      await rm(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe("POST /api/eventlogs", () => {
    it("creates an event log", async () => {
      const events = [
        { type: "user_message", timestamp: Date.now(), message: "Hello" },
        { type: "assistant", timestamp: Date.now(), content: "Hi there!" },
      ]

      const response = await fetch(`http://localhost:${port}/api/eventlogs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events }),
      })
      const data = (await response.json()) as ApiResponse<EventLog>

      expect(response.status).toBe(201)
      expect(data.ok).toBe(true)
      expect(data.eventlog!.id).toMatch(/^[a-f0-9]{8}$/)
      expect(data.eventlog!.events).toEqual(events)
    })

    it("creates an event log with metadata", async () => {
      const events = [{ type: "test", timestamp: Date.now() }]
      const metadata = { taskId: "rui-abc", title: "Test Task" }

      const response = await fetch(`http://localhost:${port}/api/eventlogs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events, metadata }),
      })
      const data = (await response.json()) as ApiResponse<EventLog>

      expect(response.status).toBe(201)
      expect(data.eventlog!.metadata).toEqual(metadata)
    })

    it("returns 400 when events is missing", async () => {
      const response = await fetch(`http://localhost:${port}/api/eventlogs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = (await response.json()) as ApiResponse<EventLog>

      expect(response.status).toBe(400)
      expect(data.ok).toBe(false)
      expect(data.error).toBe("Events array is required")
    })

    it("returns 400 when events is not an array", async () => {
      const response = await fetch(`http://localhost:${port}/api/eventlogs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: "not an array" }),
      })
      const data = (await response.json()) as ApiResponse<EventLog>

      expect(response.status).toBe(400)
      expect(data.ok).toBe(false)
    })
  })

  describe("GET /api/eventlogs/:id", () => {
    it("retrieves an event log by ID", async () => {
      const events = [{ type: "test", timestamp: Date.now() }]

      // Create first
      const createResponse = await fetch(`http://localhost:${port}/api/eventlogs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events }),
      })
      const createData = (await createResponse.json()) as ApiResponse<EventLog>
      const id = createData.eventlog!.id

      // Then retrieve
      const response = await fetch(`http://localhost:${port}/api/eventlogs/${id}`)
      const data = (await response.json()) as ApiResponse<EventLog>

      expect(response.status).toBe(200)
      expect(data.ok).toBe(true)
      expect(data.eventlog!.id).toBe(id)
      expect(data.eventlog!.events).toEqual(events)
    })

    it("returns 404 for non-existent ID", async () => {
      const response = await fetch(`http://localhost:${port}/api/eventlogs/nonexistent`)
      const data = (await response.json()) as ApiResponse<EventLog>

      expect(response.status).toBe(404)
      expect(data.ok).toBe(false)
      expect(data.error).toBe("Event log not found")
    })
  })

  describe("GET /api/eventlogs", () => {
    it("returns empty list when no logs exist", async () => {
      const response = await fetch(`http://localhost:${port}/api/eventlogs`)
      const data = (await response.json()) as ApiResponse<EventLogStoreSummary>

      expect(response.status).toBe(200)
      expect(data.ok).toBe(true)
      expect(data.eventlogs).toEqual([])
    })

    it("returns summaries of all event logs", async () => {
      const events1 = [{ type: "test1", timestamp: Date.now() }]
      const events2 = [
        { type: "test2a", timestamp: Date.now() },
        { type: "test2b", timestamp: Date.now() },
      ]

      await fetch(`http://localhost:${port}/api/eventlogs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: events1, metadata: { title: "Log 1" } }),
      })
      await fetch(`http://localhost:${port}/api/eventlogs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: events2, metadata: { title: "Log 2" } }),
      })

      const response = await fetch(`http://localhost:${port}/api/eventlogs`)
      const data = (await response.json()) as ApiResponse<EventLogStoreSummary>

      expect(response.status).toBe(200)
      expect(data.eventlogs).toHaveLength(2)
      // Newest first
      expect(data.eventlogs![0].eventCount).toBe(2)
      expect(data.eventlogs![0].metadata?.title).toBe("Log 2")
      expect(data.eventlogs![1].eventCount).toBe(1)
      expect(data.eventlogs![1].metadata?.title).toBe("Log 1")
    })
  })
})
