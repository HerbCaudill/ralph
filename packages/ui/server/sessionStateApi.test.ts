import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest"
import { createServer, type Server } from "node:http"
import express, { type Express, type Request, type Response } from "express"
import { EventEmitter } from "node:events"
import { mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { RalphManager, type RalphManagerOptions } from "./RalphManager.js"
import { RalphRegistry, type RalphInstanceState } from "./RalphRegistry.js"
import type { RalphStatus } from "./RalphManager.js"
import { SessionStateStore, type PersistedSessionState } from "./SessionStateStore.js"

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

function createTestApp(getRegistry: () => RalphRegistry): Express {
  const app = express()
  app.use(express.json())

  // Get saved session state for an instance
  app.get("/api/ralph/:instanceId/session-state", async (req: Request, res: Response) => {
    const instanceId = req.params.instanceId as string
    const registry = getRegistry()

    if (!registry.has(instanceId)) {
      res.status(404).json({ ok: false, error: `Instance '${instanceId}' not found` })
      return
    }

    try {
      const state = await registry.loadSessionState(instanceId)

      if (!state) {
        res.status(404).json({ ok: false, error: "No saved session state found" })
        return
      }

      res.status(200).json({ ok: true, state })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load session state"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Restore conversation context from saved state
  app.post("/api/ralph/:instanceId/restore-state", async (req: Request, res: Response) => {
    const instanceId = req.params.instanceId as string
    const registry = getRegistry()

    const instance = registry.get(instanceId)
    if (!instance) {
      res.status(404).json({ ok: false, error: `Instance '${instanceId}' not found` })
      return
    }

    try {
      const state = await registry.loadSessionState(instanceId)

      if (!state) {
        res.status(404).json({ ok: false, error: "No saved session state found" })
        return
      }

      // Update the instance's current task from the saved state
      if (state.currentTaskId !== null) {
        instance.currentTaskId = state.currentTaskId
        instance.currentTaskTitle = state.currentTaskId
      }

      res.status(200).json({
        ok: true,
        restored: {
          instanceId: state.instanceId,
          status: state.status,
          currentTaskId: state.currentTaskId,
          savedAt: state.savedAt,
          messageCount: state.conversationContext.messages.length,
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to restore session state"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Delete saved session state (for "start fresh")
  app.delete("/api/ralph/:instanceId/session-state", async (req: Request, res: Response) => {
    const instanceId = req.params.instanceId as string
    const registry = getRegistry()

    if (!registry.has(instanceId)) {
      res.status(404).json({ ok: false, error: `Instance '${instanceId}' not found` })
      return
    }

    try {
      const deleted = await registry.deleteSessionState(instanceId)

      if (!deleted) {
        res.status(404).json({ ok: false, error: "No saved session state found" })
        return
      }

      res.status(200).json({ ok: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete session state"
      res.status(500).json({ ok: false, error: message })
    }
  })

  return app
}

// Tests

describe("Session State API endpoints", () => {
  let server: Server
  let registry: RalphRegistry
  let tempDir: string
  let sessionStateStore: SessionStateStore
  const port = 3100 // Use a unique port for session state API tests

  beforeAll(async () => {
    // Create a temp directory for the session state store
    tempDir = await mkdtemp(join(tmpdir(), "ralph-session-state-api-test-"))
    sessionStateStore = new SessionStateStore(tempDir)

    const managerOptions: RalphManagerOptions = {
      spawn: () => createMockChildProcess() as ReturnType<RalphManagerOptions["spawn"] & {}>,
    }
    registry = new RalphRegistry({
      defaultManagerOptions: managerOptions,
      sessionStateStore,
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
    // Clean up temp directory
    await rm(tempDir, { recursive: true, force: true })
  })

  beforeEach(async () => {
    // Clean up any existing instances before each test
    await registry.disposeAll()
    // Clear any saved session states
    await sessionStateStore.clear()
  })

  afterEach(async () => {
    // Clean up after each test
    await registry.disposeAll()
    await sessionStateStore.clear()
  })

  describe("GET /api/ralph/:instanceId/session-state", () => {
    it("returns 404 when instance does not exist", async () => {
      const response = await fetch(`http://localhost:${port}/api/ralph/nonexistent/session-state`)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toEqual({ ok: false, error: "Instance 'nonexistent' not found" })
    })

    it("returns 404 when no saved state exists", async () => {
      registry.create({
        id: "test-1",
        name: "Test 1",
        agentName: "Agent-1",
        worktreePath: null,
        workspaceId: null,
        branch: null,
      })

      const response = await fetch(`http://localhost:${port}/api/ralph/test-1/session-state`)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toEqual({ ok: false, error: "No saved session state found" })
    })

    it("returns saved session state", async () => {
      registry.create({
        id: "test-1",
        name: "Test 1",
        agentName: "Agent-1",
        worktreePath: null,
        workspaceId: null,
        branch: null,
      })

      // Save some session state directly
      const savedState: PersistedSessionState = {
        instanceId: "test-1",
        conversationContext: {
          messages: [
            { role: "user", content: "Hello", timestamp: 1000 },
            { role: "assistant", content: "Hi there!", timestamp: 1001 },
          ],
          lastPrompt: "Hello",
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          timestamp: 1001,
        },
        status: "running",
        currentTaskId: "task-123",
        savedAt: Date.now(),
        version: 1,
      }
      await sessionStateStore.save(savedState)

      const response = await fetch(`http://localhost:${port}/api/ralph/test-1/session-state`)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.ok).toBe(true)
      expect(data.state.instanceId).toBe("test-1")
      expect(data.state.status).toBe("running")
      expect(data.state.currentTaskId).toBe("task-123")
      expect(data.state.conversationContext.messages).toHaveLength(2)
      expect(data.state.conversationContext.messages[0].content).toBe("Hello")
    })
  })

  describe("POST /api/ralph/:instanceId/restore-state", () => {
    it("returns 404 when instance does not exist", async () => {
      const response = await fetch(`http://localhost:${port}/api/ralph/nonexistent/restore-state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toEqual({ ok: false, error: "Instance 'nonexistent' not found" })
    })

    it("returns 404 when no saved state exists", async () => {
      registry.create({
        id: "test-1",
        name: "Test 1",
        agentName: "Agent-1",
        worktreePath: null,
        workspaceId: null,
        branch: null,
      })

      const response = await fetch(`http://localhost:${port}/api/ralph/test-1/restore-state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toEqual({ ok: false, error: "No saved session state found" })
    })

    it("restores session state and returns summary", async () => {
      const instance = registry.create({
        id: "test-1",
        name: "Test 1",
        agentName: "Agent-1",
        worktreePath: null,
        workspaceId: null,
        branch: null,
      })

      // Save some session state directly
      const savedAt = Date.now()
      const savedState: PersistedSessionState = {
        instanceId: "test-1",
        conversationContext: {
          messages: [
            { role: "user", content: "Hello", timestamp: 1000 },
            { role: "assistant", content: "Hi there!", timestamp: 1001 },
            { role: "user", content: "How are you?", timestamp: 1002 },
          ],
          lastPrompt: "How are you?",
          usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
          timestamp: 1002,
        },
        status: "running",
        currentTaskId: "task-456",
        savedAt,
        version: 1,
      }
      await sessionStateStore.save(savedState)

      // Verify the instance doesn't have a current task before restoration
      expect(instance.currentTaskId).toBeNull()

      const response = await fetch(`http://localhost:${port}/api/ralph/test-1/restore-state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.ok).toBe(true)
      expect(data.restored.instanceId).toBe("test-1")
      expect(data.restored.status).toBe("running")
      expect(data.restored.currentTaskId).toBe("task-456")
      expect(data.restored.messageCount).toBe(3)

      // Verify the instance's current task was updated
      expect(instance.currentTaskId).toBe("task-456")
    })

    it("does not update current task when state has null taskId", async () => {
      const instance = registry.create({
        id: "test-1",
        name: "Test 1",
        agentName: "Agent-1",
        worktreePath: null,
        workspaceId: null,
        branch: null,
      })

      // Save session state with null currentTaskId
      const savedState: PersistedSessionState = {
        instanceId: "test-1",
        conversationContext: {
          messages: [{ role: "user", content: "Hello", timestamp: 1000 }],
          lastPrompt: "Hello",
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          timestamp: 1000,
        },
        status: "running",
        currentTaskId: null,
        savedAt: Date.now(),
        version: 1,
      }
      await sessionStateStore.save(savedState)

      const response = await fetch(`http://localhost:${port}/api/ralph/test-1/restore-state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.ok).toBe(true)
      expect(data.restored.currentTaskId).toBeNull()

      // Instance should still have null current task
      expect(instance.currentTaskId).toBeNull()
    })
  })

  describe("DELETE /api/ralph/:instanceId/session-state", () => {
    it("returns 404 when instance does not exist", async () => {
      const response = await fetch(`http://localhost:${port}/api/ralph/nonexistent/session-state`, {
        method: "DELETE",
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toEqual({ ok: false, error: "Instance 'nonexistent' not found" })
    })

    it("returns 404 when no saved state exists", async () => {
      registry.create({
        id: "test-1",
        name: "Test 1",
        agentName: "Agent-1",
        worktreePath: null,
        workspaceId: null,
        branch: null,
      })

      const response = await fetch(`http://localhost:${port}/api/ralph/test-1/session-state`, {
        method: "DELETE",
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toEqual({ ok: false, error: "No saved session state found" })
    })

    it("deletes saved session state", async () => {
      registry.create({
        id: "test-1",
        name: "Test 1",
        agentName: "Agent-1",
        worktreePath: null,
        workspaceId: null,
        branch: null,
      })

      // Save some session state directly
      const savedState: PersistedSessionState = {
        instanceId: "test-1",
        conversationContext: {
          messages: [{ role: "user", content: "Hello", timestamp: 1000 }],
          lastPrompt: "Hello",
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          timestamp: 1000,
        },
        status: "running",
        currentTaskId: null,
        savedAt: Date.now(),
        version: 1,
      }
      await sessionStateStore.save(savedState)

      // Verify state exists
      const stateBefore = await sessionStateStore.load("test-1")
      expect(stateBefore).not.toBeNull()

      const response = await fetch(`http://localhost:${port}/api/ralph/test-1/session-state`, {
        method: "DELETE",
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ ok: true })

      // Verify state was deleted
      const stateAfter = await sessionStateStore.load("test-1")
      expect(stateAfter).toBeNull()
    })
  })
})
