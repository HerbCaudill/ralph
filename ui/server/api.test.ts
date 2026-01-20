import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest"
import { createServer, type Server } from "node:http"
import express, { type Express, type Request, type Response } from "express"
import { EventEmitter } from "node:events"
import { RalphManager, type RalphManagerOptions } from "./RalphManager.js"

// Test setup - create app with mock RalphManager

function createMockChildProcess() {
  const proc = new EventEmitter() as EventEmitter & {
    stdin: { writable: boolean; write: (data: string) => void }
    stdout: EventEmitter
    stderr: EventEmitter
    kill: (signal?: string) => void
    pid: number
  }

  proc.stdin = {
    writable: true,
    write: () => {},
  }
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  proc.kill = (signal?: string) => {
    // SIGTSTP and SIGCONT don't terminate the process
    if (signal === "SIGTSTP" || signal === "SIGCONT") {
      return
    }
    proc.emit("exit", 0, null)
  }
  proc.pid = 12345

  // Emit spawn on next tick
  setImmediate(() => proc.emit("spawn"))

  return proc
}

function createTestApp(getManager: () => RalphManager): Express {
  const app = express()
  app.use(express.json())

  app.post("/api/start", async (req: Request, res: Response) => {
    try {
      const manager = getManager()
      if (manager.isRunning) {
        res.status(409).json({ ok: false, error: "Ralph is already running" })
        return
      }

      const { iterations } = req.body as { iterations?: number }
      await manager.start(iterations)
      res.status(200).json({ ok: true, status: manager.status })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start"
      res.status(500).json({ ok: false, error: message })
    }
  })

  app.post("/api/stop", async (_req: Request, res: Response) => {
    try {
      const manager = getManager()
      if (!manager.isRunning && manager.status !== "paused") {
        res.status(409).json({ ok: false, error: "Ralph is not running" })
        return
      }

      await manager.stop()
      res.status(200).json({ ok: true, status: manager.status })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to stop"
      res.status(500).json({ ok: false, error: message })
    }
  })

  app.post("/api/pause", (_req: Request, res: Response) => {
    try {
      const manager = getManager()
      manager.pause()
      res.status(200).json({ ok: true, status: manager.status })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to pause"
      res.status(500).json({ ok: false, error: message })
    }
  })

  app.post("/api/resume", (_req: Request, res: Response) => {
    try {
      const manager = getManager()
      manager.resume()
      res.status(200).json({ ok: true, status: manager.status })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to resume"
      res.status(500).json({ ok: false, error: message })
    }
  })

  app.post("/api/message", (req: Request, res: Response) => {
    try {
      const manager = getManager()
      if (!manager.isRunning) {
        res.status(409).json({ ok: false, error: "Ralph is not running" })
        return
      }

      const { message } = req.body as { message?: string | object }
      if (message === undefined) {
        res.status(400).json({ ok: false, error: "Message is required" })
        return
      }

      manager.send(message)
      res.status(200).json({ ok: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send message"
      res.status(500).json({ ok: false, error: msg })
    }
  })

  app.get("/api/status", (_req: Request, res: Response) => {
    const manager = getManager()
    res.status(200).json({ ok: true, status: manager.status })
  })

  return app
}

// Tests

describe("REST API endpoints", () => {
  let server: Server
  let manager: RalphManager
  const port = 3097 // Use a unique port for API tests (different from broadcast.test.ts 3098)

  beforeAll(async () => {
    const managerOptions: RalphManagerOptions = {
      spawn: () => createMockChildProcess() as ReturnType<RalphManagerOptions["spawn"] & {}>,
    }
    manager = new RalphManager(managerOptions)

    const app = createTestApp(() => manager)
    server = createServer(app)

    await new Promise<void>(resolve => {
      server.listen(port, "localhost", () => resolve())
    })
  })

  afterAll(async () => {
    if (manager.isRunning) {
      await manager.stop()
    }
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

  beforeEach(async () => {
    // Ensure manager is stopped before each test (also check paused state)
    if (manager.isRunning || manager.status === "paused") {
      await manager.stop()
    }
  })

  afterEach(async () => {
    // Clean up after each test (also check paused state)
    if (manager.isRunning || manager.status === "paused") {
      await manager.stop()
    }
  })

  describe("GET /api/status", () => {
    it("returns stopped status when not running", async () => {
      const response = await fetch(`http://localhost:${port}/api/status`)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ ok: true, status: "stopped" })
    })

    it("returns running status after start", async () => {
      await manager.start()

      const response = await fetch(`http://localhost:${port}/api/status`)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ ok: true, status: "running" })
    })
  })

  describe("POST /api/start", () => {
    it("starts ralph successfully", async () => {
      const response = await fetch(`http://localhost:${port}/api/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ ok: true, status: "running" })
    })

    it("starts ralph with iterations parameter", async () => {
      const response = await fetch(`http://localhost:${port}/api/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ iterations: 5 }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ ok: true, status: "running" })
    })

    it("returns 409 when already running", async () => {
      await manager.start()

      const response = await fetch(`http://localhost:${port}/api/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data).toEqual({ ok: false, error: "Ralph is already running" })
    })
  })

  describe("POST /api/stop", () => {
    it("stops ralph successfully", async () => {
      await manager.start()

      const response = await fetch(`http://localhost:${port}/api/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ ok: true, status: "stopped" })
    })

    it("returns 409 when not running", async () => {
      const response = await fetch(`http://localhost:${port}/api/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data).toEqual({ ok: false, error: "Ralph is not running" })
    })
  })

  describe("POST /api/message", () => {
    it("sends string message successfully", async () => {
      await manager.start()

      const response = await fetch(`http://localhost:${port}/api/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "hello" }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ ok: true })
    })

    it("sends object message successfully", async () => {
      await manager.start()

      const response = await fetch(`http://localhost:${port}/api/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: { type: "test", data: 123 } }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ ok: true })
    })

    it("returns 400 when message is missing", async () => {
      await manager.start()

      const response = await fetch(`http://localhost:${port}/api/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toEqual({ ok: false, error: "Message is required" })
    })

    it("returns 409 when not running", async () => {
      const response = await fetch(`http://localhost:${port}/api/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "hello" }),
      })
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data).toEqual({ ok: false, error: "Ralph is not running" })
    })
  })

  describe("POST /api/pause", () => {
    it("pauses ralph successfully when running", async () => {
      await manager.start()

      const response = await fetch(`http://localhost:${port}/api/pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ ok: true, status: "paused" })
    })

    it("returns 500 when not running", async () => {
      const response = await fetch(`http://localhost:${port}/api/pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toEqual({ ok: false, error: "Ralph is not running" })
    })
  })

  describe("POST /api/resume", () => {
    it("resumes ralph successfully when paused", async () => {
      await manager.start()
      manager.pause()

      const response = await fetch(`http://localhost:${port}/api/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ ok: true, status: "running" })
    })

    it("returns 500 when not paused", async () => {
      await manager.start()

      const response = await fetch(`http://localhost:${port}/api/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toEqual({ ok: false, error: "Cannot resume ralph in running state" })
    })
  })
})
