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
import { IterationStateStore, type PersistedIterationState } from "./IterationStateStore.js"

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

  // Get saved iteration state for an instance
  app.get("/api/ralph/:instanceId/iteration-state", async (req: Request, res: Response) => {
    const instanceId = req.params.instanceId as string
    const registry = getRegistry()

    if (!registry.has(instanceId)) {
      res.status(404).json({ ok: false, error: `Instance '${instanceId}' not found` })
      return
    }

    try {
      const state = await registry.loadIterationState(instanceId)

      if (!state) {
        res.status(404).json({ ok: false, error: "No saved iteration state found" })
        return
      }

      res.status(200).json({ ok: true, state })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load iteration state"
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
      const state = await registry.loadIterationState(instanceId)

      if (!state) {
        res.status(404).json({ ok: false, error: "No saved iteration state found" })
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
      const message = err instanceof Error ? err.message : "Failed to restore iteration state"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Delete saved iteration state (for "start fresh")
  app.delete("/api/ralph/:instanceId/iteration-state", async (req: Request, res: Response) => {
    const instanceId = req.params.instanceId as string
    const registry = getRegistry()

    if (!registry.has(instanceId)) {
      res.status(404).json({ ok: false, error: `Instance '${instanceId}' not found` })
      return
    }

    try {
      const deleted = await registry.deleteIterationState(instanceId)

      if (!deleted) {
        res.status(404).json({ ok: false, error: "No saved iteration state found" })
        return
      }

      res.status(200).json({ ok: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete iteration state"
      res.status(500).json({ ok: false, error: message })
    }
  })

  return app
}

// Tests

describe("Iteration State API endpoints", () => {
  let server: Server
  let registry: RalphRegistry
  let tempDir: string
  let iterationStateStore: IterationStateStore
  const port = 3097 // Use a unique port for iteration state API tests

  beforeAll(async () => {
    // Create a temp directory for the iteration state store
    tempDir = await mkdtemp(join(tmpdir(), "ralph-iteration-state-api-test-"))
    iterationStateStore = new IterationStateStore(tempDir)

    const managerOptions: RalphManagerOptions = {
      spawn: () => createMockChildProcess() as ReturnType<RalphManagerOptions["spawn"] & {}>,
    }
    registry = new RalphRegistry({
      defaultManagerOptions: managerOptions,
      iterationStateStore,
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
    // Clear any saved iteration states
    await iterationStateStore.clear()
  })

  afterEach(async () => {
    // Clean up after each test
    await registry.disposeAll()
    await iterationStateStore.clear()
  })

  describe("GET /api/ralph/:instanceId/iteration-state", () => {
    it("returns 404 when instance does not exist", async () => {
      const response = await fetch(`http://localhost:${port}/api/ralph/nonexistent/iteration-state`)
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
        branch: null,
      })

      const response = await fetch(`http://localhost:${port}/api/ralph/test-1/iteration-state`)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toEqual({ ok: false, error: "No saved iteration state found" })
    })

    it("returns saved iteration state", async () => {
      registry.create({
        id: "test-1",
        name: "Test 1",
        agentName: "Agent-1",
        worktreePath: null,
        branch: null,
      })

      // Save some iteration state directly
      const savedState: PersistedIterationState = {
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
      await iterationStateStore.save(savedState)

      const response = await fetch(`http://localhost:${port}/api/ralph/test-1/iteration-state`)
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
        branch: null,
      })

      const response = await fetch(`http://localhost:${port}/api/ralph/test-1/restore-state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toEqual({ ok: false, error: "No saved iteration state found" })
    })

    it("restores iteration state and returns summary", async () => {
      const instance = registry.create({
        id: "test-1",
        name: "Test 1",
        agentName: "Agent-1",
        worktreePath: null,
        branch: null,
      })

      // Save some iteration state directly
      const savedAt = Date.now()
      const savedState: PersistedIterationState = {
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
      await iterationStateStore.save(savedState)

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
        branch: null,
      })

      // Save iteration state with null currentTaskId
      const savedState: PersistedIterationState = {
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
      await iterationStateStore.save(savedState)

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

  describe("DELETE /api/ralph/:instanceId/iteration-state", () => {
    it("returns 404 when instance does not exist", async () => {
      const response = await fetch(
        `http://localhost:${port}/api/ralph/nonexistent/iteration-state`,
        {
          method: "DELETE",
        },
      )
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
        branch: null,
      })

      const response = await fetch(`http://localhost:${port}/api/ralph/test-1/iteration-state`, {
        method: "DELETE",
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toEqual({ ok: false, error: "No saved iteration state found" })
    })

    it("deletes saved iteration state", async () => {
      registry.create({
        id: "test-1",
        name: "Test 1",
        agentName: "Agent-1",
        worktreePath: null,
        branch: null,
      })

      // Save some iteration state directly
      const savedState: PersistedIterationState = {
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
      await iterationStateStore.save(savedState)

      // Verify state exists
      const stateBefore = await iterationStateStore.load("test-1")
      expect(stateBefore).not.toBeNull()

      const response = await fetch(`http://localhost:${port}/api/ralph/test-1/iteration-state`, {
        method: "DELETE",
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ ok: true })

      // Verify state was deleted
      const stateAfter = await iterationStateStore.load("test-1")
      expect(stateAfter).toBeNull()
    })
  })
})
