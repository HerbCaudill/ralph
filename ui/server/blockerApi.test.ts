import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import { createServer, type Server } from "node:http"
import express, { type Express, type Request, type Response } from "express"
import { EventEmitter } from "node:events"
import { BdProxy, type SpawnFn, type BdDepResult } from "./BdProxy.js"

/**
 * Create a mock process helper for testing.
 */
function createMockProcess() {
  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter
    stderr: EventEmitter
    kill: ReturnType<typeof vi.fn>
  }
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  proc.kill = vi.fn()
  return proc
}

/**
 * Create an Express app with blocker API endpoints for testing.
 */
function createTestApp(getBdProxy: () => BdProxy): Express {
  const app = express()
  app.use(express.json())

  // Add a blocker to a task (the blocker blocks this task)
  app.post("/api/tasks/:id/blockers", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string
      const { blockerId } = req.body as { blockerId?: string }

      if (!blockerId?.trim()) {
        res.status(400).json({ ok: false, error: "Blocker ID is required" })
        return
      }

      const bdProxy = getBdProxy()
      const result = await bdProxy.addBlocker(id, blockerId.trim())

      res.status(201).json({ ok: true, result })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add blocker"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Remove a blocker from a task
  app.delete("/api/tasks/:id/blockers/:blockerId", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string
      const blockerId = req.params.blockerId as string

      if (!blockerId?.trim()) {
        res.status(400).json({ ok: false, error: "Blocker ID is required" })
        return
      }

      const bdProxy = getBdProxy()
      const result = await bdProxy.removeBlocker(id, blockerId.trim())

      res.status(200).json({ ok: true, result })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to remove blocker"
      res.status(500).json({ ok: false, error: message })
    }
  })

  return app
}

describe("Blocker API endpoints", () => {
  let server: Server
  let mockProcess: ReturnType<typeof createMockProcess>
  let mockSpawn: ReturnType<typeof vi.fn>
  let bdProxy: BdProxy
  let port: number

  beforeAll(async () => {
    mockProcess = createMockProcess()
    mockSpawn = vi.fn().mockReturnValue(mockProcess)
    bdProxy = new BdProxy({ spawn: mockSpawn as unknown as SpawnFn })

    const app = createTestApp(() => bdProxy)
    server = createServer(app)

    // Use port 0 to let the OS assign an available port
    await new Promise<void>(resolve => {
      server.listen(0, "localhost", () => {
        const address = server.address()
        port = typeof address === "object" && address ? address.port : 0
        resolve()
      })
    })
  })

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Server close timeout"))
      }, 5000)
      server.close(err => {
        clearTimeout(timeout)
        if (err) reject(err)
        else resolve()
      })
    })
  })

  describe("POST /api/tasks/:id/blockers", () => {
    it("adds a blocker successfully", async () => {
      const expectedResult: BdDepResult = {
        issue_id: "rui-blocked",
        depends_on_id: "rui-blocker",
        status: "added",
        type: "blocks",
      }

      // Create new mock process BEFORE making the request
      mockProcess = createMockProcess()
      mockSpawn.mockReturnValue(mockProcess)

      // Make the request
      const fetchPromise = fetch(`http://localhost:${port}/api/tasks/rui-blocked/blockers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockerId: "rui-blocker" }),
      })

      // Wait a tick for the request to reach the server and spawn the process
      await new Promise(resolve => setTimeout(resolve, 10))

      // Simulate successful response
      mockProcess.stdout.emit("data", Buffer.from(JSON.stringify(expectedResult)))
      mockProcess.emit("close", 0)

      const response = await fetchPromise
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data).toEqual({ ok: true, result: expectedResult })
    })

    it("returns 400 when blockerId is missing", async () => {
      const response = await fetch(`http://localhost:${port}/api/tasks/rui-blocked/blockers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toEqual({ ok: false, error: "Blocker ID is required" })
    })

    it("returns 400 when blockerId is empty string", async () => {
      const response = await fetch(`http://localhost:${port}/api/tasks/rui-blocked/blockers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockerId: "   " }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toEqual({ ok: false, error: "Blocker ID is required" })
    })

    it("returns 500 on bd command failure", async () => {
      // Create new mock process BEFORE making the request
      mockProcess = createMockProcess()
      mockSpawn.mockReturnValue(mockProcess)

      // Make the request
      const fetchPromise = fetch(`http://localhost:${port}/api/tasks/rui-invalid/blockers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockerId: "rui-blocker" }),
      })

      // Wait a tick for the request to reach the server and spawn the process
      await new Promise(resolve => setTimeout(resolve, 10))

      // Simulate error response
      mockProcess.stderr.emit("data", Buffer.from("Issue not found"))
      mockProcess.emit("close", 1)

      const response = await fetchPromise
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.ok).toBe(false)
      expect(data.error).toContain("Issue not found")
    })
  })

  describe("DELETE /api/tasks/:id/blockers/:blockerId", () => {
    it("removes a blocker successfully", async () => {
      const expectedResult: BdDepResult = {
        issue_id: "rui-blocked",
        depends_on_id: "rui-blocker",
        status: "removed",
      }

      // Create new mock process BEFORE making the request
      mockProcess = createMockProcess()
      mockSpawn.mockReturnValue(mockProcess)

      // Make the request
      const fetchPromise = fetch(
        `http://localhost:${port}/api/tasks/rui-blocked/blockers/rui-blocker`,
        {
          method: "DELETE",
        },
      )

      // Wait a tick for the request to reach the server and spawn the process
      await new Promise(resolve => setTimeout(resolve, 10))

      // Simulate successful response
      mockProcess.stdout.emit("data", Buffer.from(JSON.stringify(expectedResult)))
      mockProcess.emit("close", 0)

      const response = await fetchPromise
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ ok: true, result: expectedResult })
    })

    it("returns 500 on bd command failure", async () => {
      // Create new mock process BEFORE making the request
      mockProcess = createMockProcess()
      mockSpawn.mockReturnValue(mockProcess)

      // Make the request
      const fetchPromise = fetch(
        `http://localhost:${port}/api/tasks/rui-blocked/blockers/rui-invalid`,
        {
          method: "DELETE",
        },
      )

      // Wait a tick for the request to reach the server and spawn the process
      await new Promise(resolve => setTimeout(resolve, 10))

      // Simulate error response
      mockProcess.stderr.emit("data", Buffer.from("Dependency not found"))
      mockProcess.emit("close", 1)

      const response = await fetchPromise
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.ok).toBe(false)
      expect(data.error).toContain("Dependency not found")
    })
  })
})
