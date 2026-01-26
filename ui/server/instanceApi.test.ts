import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest"
import { createServer, type Server } from "node:http"
import express, { type Express, type Request, type Response } from "express"
import { EventEmitter } from "node:events"
import { RalphManager, type RalphManagerOptions } from "./RalphManager.js"
import { RalphRegistry, type RalphInstanceState } from "./RalphRegistry.js"
import type { RalphStatus } from "./RalphManager.js"

// Test setup - create mock child process

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

/**
 * Serialize a RalphInstanceState for API responses.
 */
function serializeInstanceState(
  state: RalphInstanceState,
): Omit<RalphInstanceState, "manager"> & { status: RalphStatus } {
  return {
    id: state.id,
    name: state.name,
    agentName: state.agentName,
    worktreePath: state.worktreePath,
    branch: state.branch,
    createdAt: state.createdAt,
    currentTaskId: state.currentTaskId,
    currentTaskTitle: state.currentTaskTitle,
    status: state.manager.status,
  }
}

function createTestApp(getRegistry: () => RalphRegistry): Express {
  const app = express()
  app.use(express.json())

  // List all instances
  app.get("/api/instances", (_req: Request, res: Response) => {
    const registry = getRegistry()
    const instances = registry.getAll().map(serializeInstanceState)
    res.status(200).json({ ok: true, instances })
  })

  // Get a specific instance
  app.get("/api/ralph/:instanceId", (req: Request, res: Response) => {
    const instanceId = req.params.instanceId as string
    const registry = getRegistry()
    const instance = registry.get(instanceId)

    if (!instance) {
      res.status(404).json({ ok: false, error: `Instance '${instanceId}' not found` })
      return
    }

    res.status(200).json({ ok: true, instance: serializeInstanceState(instance) })
  })

  // Get instance status
  app.get("/api/ralph/:instanceId/status", (req: Request, res: Response) => {
    const instanceId = req.params.instanceId as string
    const registry = getRegistry()
    const instance = registry.get(instanceId)

    if (!instance) {
      res.status(404).json({ ok: false, error: `Instance '${instanceId}' not found` })
      return
    }

    res.status(200).json({ ok: true, status: instance.manager.status })
  })

  // Start a specific instance
  app.post("/api/ralph/:instanceId/start", async (req: Request, res: Response) => {
    const instanceId = req.params.instanceId as string
    const registry = getRegistry()
    const instance = registry.get(instanceId)

    if (!instance) {
      res.status(404).json({ ok: false, error: `Instance '${instanceId}' not found` })
      return
    }

    try {
      if (instance.manager.isRunning) {
        res.status(409).json({ ok: false, error: "Instance is already running" })
        return
      }

      const { sessions } = req.body as { sessions?: number }
      await instance.manager.start(sessions)
      res.status(200).json({ ok: true, status: instance.manager.status })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Stop a specific instance
  app.post("/api/ralph/:instanceId/stop", async (req: Request, res: Response) => {
    const instanceId = req.params.instanceId as string
    const registry = getRegistry()
    const instance = registry.get(instanceId)

    if (!instance) {
      res.status(404).json({ ok: false, error: `Instance '${instanceId}' not found` })
      return
    }

    try {
      if (!instance.manager.isRunning && instance.manager.status !== "paused") {
        res.status(409).json({ ok: false, error: "Instance is not running" })
        return
      }

      await instance.manager.stop()
      res.status(200).json({ ok: true, status: instance.manager.status })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to stop"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Pause a specific instance
  app.post("/api/ralph/:instanceId/pause", (req: Request, res: Response) => {
    const instanceId = req.params.instanceId as string
    const registry = getRegistry()
    const instance = registry.get(instanceId)

    if (!instance) {
      res.status(404).json({ ok: false, error: `Instance '${instanceId}' not found` })
      return
    }

    try {
      instance.manager.pause()
      res.status(200).json({ ok: true, status: instance.manager.status })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to pause"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Resume a specific instance
  app.post("/api/ralph/:instanceId/resume", (req: Request, res: Response) => {
    const instanceId = req.params.instanceId as string
    const registry = getRegistry()
    const instance = registry.get(instanceId)

    if (!instance) {
      res.status(404).json({ ok: false, error: `Instance '${instanceId}' not found` })
      return
    }

    try {
      instance.manager.resume()
      res.status(200).json({ ok: true, status: instance.manager.status })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to resume"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Send message to a specific instance
  app.post("/api/ralph/:instanceId/message", (req: Request, res: Response) => {
    const instanceId = req.params.instanceId as string
    const registry = getRegistry()
    const instance = registry.get(instanceId)

    if (!instance) {
      res.status(404).json({ ok: false, error: `Instance '${instanceId}' not found` })
      return
    }

    try {
      if (!instance.manager.canAcceptMessages) {
        res.status(409).json({ ok: false, error: "Instance is not running" })
        return
      }

      const { message } = req.body as { message?: string | object }
      if (message === undefined) {
        res.status(400).json({ ok: false, error: "Message is required" })
        return
      }

      const payload = typeof message === "string" ? { type: "message", text: message } : message
      instance.manager.send(payload)
      res.status(200).json({ ok: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send message"
      res.status(500).json({ ok: false, error: msg })
    }
  })

  // Get event history for a specific instance
  app.get("/api/ralph/:instanceId/events", (req: Request, res: Response) => {
    const instanceId = req.params.instanceId as string
    const registry = getRegistry()

    if (!registry.has(instanceId)) {
      res.status(404).json({ ok: false, error: `Instance '${instanceId}' not found` })
      return
    }

    const events = registry.getEventHistory(instanceId)
    res.status(200).json({ ok: true, events })
  })

  // Clear event history for a specific instance
  app.delete("/api/ralph/:instanceId/events", (req: Request, res: Response) => {
    const instanceId = req.params.instanceId as string
    const registry = getRegistry()

    if (!registry.has(instanceId)) {
      res.status(404).json({ ok: false, error: `Instance '${instanceId}' not found` })
      return
    }

    registry.clearEventHistory(instanceId)
    res.status(200).json({ ok: true })
  })

  // Get current task for a specific instance
  app.get("/api/ralph/:instanceId/current-task", (req: Request, res: Response) => {
    const instanceId = req.params.instanceId as string
    const registry = getRegistry()

    const task = registry.getCurrentTask(instanceId)
    if (task === undefined) {
      res.status(404).json({ ok: false, error: `Instance '${instanceId}' not found` })
      return
    }

    res.status(200).json({
      ok: true,
      taskId: task.taskId,
      taskTitle: task.taskTitle,
    })
  })

  // Create a new instance
  app.post("/api/instances", async (req: Request, res: Response) => {
    try {
      const { id, name, agentName, worktreePath, branch } = req.body as {
        id?: string
        name?: string
        agentName?: string
        worktreePath?: string | null
        branch?: string | null
      }

      if (!id?.trim()) {
        res.status(400).json({ ok: false, error: "Instance ID is required" })
        return
      }

      if (!name?.trim()) {
        res.status(400).json({ ok: false, error: "Instance name is required" })
        return
      }

      const registry = getRegistry()

      if (registry.has(id)) {
        res.status(409).json({ ok: false, error: `Instance '${id}' already exists` })
        return
      }

      const instance = registry.create({
        id: id.trim(),
        name: name.trim(),
        agentName: agentName?.trim() || name.trim(),
        worktreePath: worktreePath ?? null,
        branch: branch ?? null,
      })
      res.status(201).json({ ok: true, instance: serializeInstanceState(instance) })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create instance"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Delete an instance
  app.delete("/api/ralph/:instanceId", async (req: Request, res: Response) => {
    const instanceId = req.params.instanceId as string
    const registry = getRegistry()

    if (!registry.has(instanceId)) {
      res.status(404).json({ ok: false, error: `Instance '${instanceId}' not found` })
      return
    }

    try {
      await registry.dispose(instanceId)
      res.status(200).json({ ok: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete instance"
      res.status(500).json({ ok: false, error: message })
    }
  })

  return app
}

// Tests

describe("Instance API endpoints", () => {
  let server: Server
  let registry: RalphRegistry
  const port = 3096 // Use a unique port for instance API tests

  beforeAll(async () => {
    const managerOptions: RalphManagerOptions = {
      spawn: () => createMockChildProcess() as ReturnType<RalphManagerOptions["spawn"] & {}>,
    }
    registry = new RalphRegistry({
      defaultManagerOptions: managerOptions,
    })

    const app = createTestApp(() => registry)
    server = createServer(app)

    await new Promise<void>(resolve => {
      server.listen(port, "localhost", () => resolve())
    })
  })

  afterAll(async () => {
    await registry.disposeAll()
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
    // Clean up any existing instances before each test
    await registry.disposeAll()
  })

  afterEach(async () => {
    // Clean up after each test
    await registry.disposeAll()
  })

  describe("GET /api/instances", () => {
    it("returns empty array when no instances exist", async () => {
      const response = await fetch(`http://localhost:${port}/api/instances`)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ ok: true, instances: [] })
    })

    it("returns all instances", async () => {
      registry.create({
        id: "test-1",
        name: "Test 1",
        agentName: "Agent-1",
        worktreePath: null,
        branch: null,
      })
      registry.create({
        id: "test-2",
        name: "Test 2",
        agentName: "Agent-2",
        worktreePath: null,
        branch: null,
      })

      const response = await fetch(`http://localhost:${port}/api/instances`)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.ok).toBe(true)
      expect(data.instances).toHaveLength(2)
      expect(data.instances[0].id).toBe("test-1")
      expect(data.instances[1].id).toBe("test-2")
    })
  })

  describe("GET /api/ralph/:instanceId", () => {
    it("returns 404 when instance does not exist", async () => {
      const response = await fetch(`http://localhost:${port}/api/ralph/nonexistent`)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toEqual({ ok: false, error: "Instance 'nonexistent' not found" })
    })

    it("returns instance details", async () => {
      registry.create({
        id: "test-1",
        name: "Test 1",
        agentName: "Agent-1",
        worktreePath: "/path/to/worktree",
        branch: "feature-branch",
      })

      const response = await fetch(`http://localhost:${port}/api/ralph/test-1`)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.ok).toBe(true)
      expect(data.instance.id).toBe("test-1")
      expect(data.instance.name).toBe("Test 1")
      expect(data.instance.agentName).toBe("Agent-1")
      expect(data.instance.worktreePath).toBe("/path/to/worktree")
      expect(data.instance.branch).toBe("feature-branch")
      expect(data.instance.status).toBe("stopped")
    })
  })

  describe("GET /api/ralph/:instanceId/status", () => {
    it("returns 404 when instance does not exist", async () => {
      const response = await fetch(`http://localhost:${port}/api/ralph/nonexistent/status`)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toEqual({ ok: false, error: "Instance 'nonexistent' not found" })
    })

    it("returns stopped status for new instance", async () => {
      registry.create({
        id: "test-1",
        name: "Test 1",
        agentName: "Agent-1",
        worktreePath: null,
        branch: null,
      })

      const response = await fetch(`http://localhost:${port}/api/ralph/test-1/status`)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ ok: true, status: "stopped" })
    })
  })

  describe("POST /api/ralph/:instanceId/start", () => {
    it("returns 404 when instance does not exist", async () => {
      const response = await fetch(`http://localhost:${port}/api/ralph/nonexistent/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toEqual({ ok: false, error: "Instance 'nonexistent' not found" })
    })

    it("starts instance successfully", async () => {
      registry.create({
        id: "test-1",
        name: "Test 1",
        agentName: "Agent-1",
        worktreePath: null,
        branch: null,
      })

      const response = await fetch(`http://localhost:${port}/api/ralph/test-1/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ ok: true, status: "running" })
    })

    it("starts instance with sessions parameter", async () => {
      registry.create({
        id: "test-1",
        name: "Test 1",
        agentName: "Agent-1",
        worktreePath: null,
        branch: null,
      })

      const response = await fetch(`http://localhost:${port}/api/ralph/test-1/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessions: 5 }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ ok: true, status: "running" })
    })

    it("returns 409 when instance is already running", async () => {
      const state = registry.create({
        id: "test-1",
        name: "Test 1",
        agentName: "Agent-1",
        worktreePath: null,
        branch: null,
      })
      await state.manager.start()

      const response = await fetch(`http://localhost:${port}/api/ralph/test-1/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data).toEqual({ ok: false, error: "Instance is already running" })
    })
  })

  describe("POST /api/ralph/:instanceId/stop", () => {
    it("returns 404 when instance does not exist", async () => {
      const response = await fetch(`http://localhost:${port}/api/ralph/nonexistent/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toEqual({ ok: false, error: "Instance 'nonexistent' not found" })
    })

    it("stops running instance successfully", async () => {
      const state = registry.create({
        id: "test-1",
        name: "Test 1",
        agentName: "Agent-1",
        worktreePath: null,
        branch: null,
      })
      await state.manager.start()

      const response = await fetch(`http://localhost:${port}/api/ralph/test-1/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ ok: true, status: "stopped" })
    })

    it("returns 409 when instance is not running", async () => {
      registry.create({
        id: "test-1",
        name: "Test 1",
        agentName: "Agent-1",
        worktreePath: null,
        branch: null,
      })

      const response = await fetch(`http://localhost:${port}/api/ralph/test-1/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data).toEqual({ ok: false, error: "Instance is not running" })
    })
  })

  describe("POST /api/ralph/:instanceId/pause", () => {
    it("returns 404 when instance does not exist", async () => {
      const response = await fetch(`http://localhost:${port}/api/ralph/nonexistent/pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toEqual({ ok: false, error: "Instance 'nonexistent' not found" })
    })

    it("pauses running instance successfully", async () => {
      const state = registry.create({
        id: "test-1",
        name: "Test 1",
        agentName: "Agent-1",
        worktreePath: null,
        branch: null,
      })
      await state.manager.start()

      const response = await fetch(`http://localhost:${port}/api/ralph/test-1/pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ ok: true, status: "pausing" })
    })
  })

  describe("POST /api/ralph/:instanceId/resume", () => {
    it("returns 404 when instance does not exist", async () => {
      const response = await fetch(`http://localhost:${port}/api/ralph/nonexistent/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toEqual({ ok: false, error: "Instance 'nonexistent' not found" })
    })

    it("resumes paused instance successfully", async () => {
      const state = registry.create({
        id: "test-1",
        name: "Test 1",
        agentName: "Agent-1",
        worktreePath: null,
        branch: null,
      })
      await state.manager.start()
      state.manager.pause()
      // @ts-expect-error - accessing private method for testing
      state.manager.setStatus("paused")

      const response = await fetch(`http://localhost:${port}/api/ralph/test-1/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ ok: true, status: "running" })
    })
  })

  describe("POST /api/ralph/:instanceId/message", () => {
    it("returns 404 when instance does not exist", async () => {
      const response = await fetch(`http://localhost:${port}/api/ralph/nonexistent/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "hello" }),
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toEqual({ ok: false, error: "Instance 'nonexistent' not found" })
    })

    it("sends message to running instance", async () => {
      const state = registry.create({
        id: "test-1",
        name: "Test 1",
        agentName: "Agent-1",
        worktreePath: null,
        branch: null,
      })
      await state.manager.start()

      const response = await fetch(`http://localhost:${port}/api/ralph/test-1/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "hello" }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ ok: true })
    })

    it("returns 409 when instance is not running", async () => {
      registry.create({
        id: "test-1",
        name: "Test 1",
        agentName: "Agent-1",
        worktreePath: null,
        branch: null,
      })

      const response = await fetch(`http://localhost:${port}/api/ralph/test-1/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "hello" }),
      })
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data).toEqual({ ok: false, error: "Instance is not running" })
    })

    it("returns 400 when message is missing", async () => {
      const state = registry.create({
        id: "test-1",
        name: "Test 1",
        agentName: "Agent-1",
        worktreePath: null,
        branch: null,
      })
      await state.manager.start()

      const response = await fetch(`http://localhost:${port}/api/ralph/test-1/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toEqual({ ok: false, error: "Message is required" })
    })
  })

  describe("GET /api/ralph/:instanceId/events", () => {
    it("returns 404 when instance does not exist", async () => {
      const response = await fetch(`http://localhost:${port}/api/ralph/nonexistent/events`)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toEqual({ ok: false, error: "Instance 'nonexistent' not found" })
    })

    it("returns empty array for new instance", async () => {
      registry.create({
        id: "test-1",
        name: "Test 1",
        agentName: "Agent-1",
        worktreePath: null,
        branch: null,
      })

      const response = await fetch(`http://localhost:${port}/api/ralph/test-1/events`)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ ok: true, events: [] })
    })
  })

  describe("DELETE /api/ralph/:instanceId/events", () => {
    it("returns 404 when instance does not exist", async () => {
      const response = await fetch(`http://localhost:${port}/api/ralph/nonexistent/events`, {
        method: "DELETE",
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toEqual({ ok: false, error: "Instance 'nonexistent' not found" })
    })

    it("clears event history for instance", async () => {
      registry.create({
        id: "test-1",
        name: "Test 1",
        agentName: "Agent-1",
        worktreePath: null,
        branch: null,
      })

      const response = await fetch(`http://localhost:${port}/api/ralph/test-1/events`, {
        method: "DELETE",
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ ok: true })
    })
  })

  describe("GET /api/ralph/:instanceId/current-task", () => {
    it("returns 404 when instance does not exist", async () => {
      const response = await fetch(`http://localhost:${port}/api/ralph/nonexistent/current-task`)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toEqual({ ok: false, error: "Instance 'nonexistent' not found" })
    })

    it("returns null task for new instance", async () => {
      registry.create({
        id: "test-1",
        name: "Test 1",
        agentName: "Agent-1",
        worktreePath: null,
        branch: null,
      })

      const response = await fetch(`http://localhost:${port}/api/ralph/test-1/current-task`)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ ok: true, taskId: null, taskTitle: null })
    })
  })

  describe("POST /api/instances", () => {
    it("creates a new instance", async () => {
      const response = await fetch(`http://localhost:${port}/api/instances`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "new-instance",
          name: "New Instance",
          agentName: "Agent-New",
          worktreePath: "/path/to/worktree",
          branch: "feature-branch",
        }),
      })
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.ok).toBe(true)
      expect(data.instance.id).toBe("new-instance")
      expect(data.instance.name).toBe("New Instance")
      expect(data.instance.agentName).toBe("Agent-New")
      expect(data.instance.worktreePath).toBe("/path/to/worktree")
      expect(data.instance.branch).toBe("feature-branch")
      expect(data.instance.status).toBe("stopped")
    })

    it("uses name as agentName when not provided", async () => {
      const response = await fetch(`http://localhost:${port}/api/instances`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "new-instance",
          name: "New Instance",
        }),
      })
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.ok).toBe(true)
      expect(data.instance.agentName).toBe("New Instance")
    })

    it("returns 400 when id is missing", async () => {
      const response = await fetch(`http://localhost:${port}/api/instances`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "New Instance",
        }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toEqual({ ok: false, error: "Instance ID is required" })
    })

    it("returns 400 when name is missing", async () => {
      const response = await fetch(`http://localhost:${port}/api/instances`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "new-instance",
        }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toEqual({ ok: false, error: "Instance name is required" })
    })

    it("returns 409 when instance already exists", async () => {
      registry.create({
        id: "test-1",
        name: "Test 1",
        agentName: "Agent-1",
        worktreePath: null,
        branch: null,
      })

      const response = await fetch(`http://localhost:${port}/api/instances`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "test-1",
          name: "Test 1 Again",
        }),
      })
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data).toEqual({ ok: false, error: "Instance 'test-1' already exists" })
    })
  })

  describe("DELETE /api/ralph/:instanceId", () => {
    it("returns 404 when instance does not exist", async () => {
      const response = await fetch(`http://localhost:${port}/api/ralph/nonexistent`, {
        method: "DELETE",
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toEqual({ ok: false, error: "Instance 'nonexistent' not found" })
    })

    it("deletes an existing instance", async () => {
      registry.create({
        id: "test-1",
        name: "Test 1",
        agentName: "Agent-1",
        worktreePath: null,
        branch: null,
      })

      const response = await fetch(`http://localhost:${port}/api/ralph/test-1`, {
        method: "DELETE",
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ ok: true })
      expect(registry.has("test-1")).toBe(false)
    })

    it("stops running instance before deleting", async () => {
      const state = registry.create({
        id: "test-1",
        name: "Test 1",
        agentName: "Agent-1",
        worktreePath: null,
        branch: null,
      })
      await state.manager.start()
      expect(state.manager.isRunning).toBe(true)

      const response = await fetch(`http://localhost:${port}/api/ralph/test-1`, {
        method: "DELETE",
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ ok: true })
      expect(registry.has("test-1")).toBe(false)
    })
  })
})
