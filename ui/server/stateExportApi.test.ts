import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest"
import { createServer, type Server } from "node:http"
import express, { type Express, type Request, type Response } from "express"
import { EventEmitter } from "node:events"
import { type RalphManagerOptions } from "./RalphManager.js"
import { RalphRegistry, type RalphInstanceState } from "./RalphRegistry.js"
import type { RalphStatus } from "./RalphManager.js"
import path from "node:path"

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
    workspaceId: state.workspaceId,
    branch: state.branch,
    createdAt: state.createdAt,
    currentTaskId: state.currentTaskId,
    currentTaskTitle: state.currentTaskTitle,
    status: state.manager.status,
  }
}

/**
 * Create an Express app with the state export endpoint for testing.
 */
function createTestApp(options: {
  getRegistry: () => RalphRegistry
  isDevMode: () => boolean
  workspacePath: string
  mockMkdir: (path: string, options: { recursive: boolean }) => Promise<void>
  mockWriteFile: (path: string, data: string, encoding: string) => Promise<void>
}): Express {
  const app = express()
  app.use(express.json())

  // Export current state to .ralph/state.latest.json (dev mode only)
  app.post("/api/state/export", async (_req: Request, res: Response) => {
    if (!options.isDevMode()) {
      res.status(403).json({ ok: false, error: "State export is only available in dev mode" })
      return
    }

    try {
      const registry = options.getRegistry()
      const instances = registry.getAll().map(serializeInstanceState)
      const workspacePath = options.workspacePath

      const state = {
        exportedAt: new Date().toISOString(),
        instances,
      }

      const ralphDir = path.join(workspacePath, ".ralph")
      await options.mockMkdir(ralphDir, { recursive: true })
      await options.mockWriteFile(
        path.join(ralphDir, "state.latest.json"),
        JSON.stringify(state, null, 2),
        "utf-8",
      )

      res.status(200).json({ ok: true, savedAt: Date.now() })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to export state"
      res.status(500).json({ ok: false, error: message })
    }
  })

  return app
}

// Tests

describe("POST /api/state/export", () => {
  let server: Server
  let registry: RalphRegistry
  let devMode: boolean
  let mockMkdir: ReturnType<typeof vi.fn>
  let mockWriteFile: ReturnType<typeof vi.fn>
  const port = 3099 // Use a unique port for state export API tests
  const workspacePath = "/tmp/test-workspace"

  beforeAll(async () => {
    const managerOptions: RalphManagerOptions = {
      spawn: () => createMockChildProcess() as ReturnType<RalphManagerOptions["spawn"] & {}>,
    }
    registry = new RalphRegistry({
      defaultManagerOptions: managerOptions,
    })

    devMode = true
    mockMkdir = vi.fn().mockResolvedValue(undefined)
    mockWriteFile = vi.fn().mockResolvedValue(undefined)

    const app = createTestApp({
      getRegistry: () => registry,
      isDevMode: () => devMode,
      workspacePath,
      mockMkdir,
      mockWriteFile,
    })
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
    await registry.disposeAll()
    devMode = true
    mockMkdir.mockClear()
    mockWriteFile.mockClear()
    mockMkdir.mockResolvedValue(undefined)
    mockWriteFile.mockResolvedValue(undefined)
  })

  afterEach(async () => {
    await registry.disposeAll()
  })

  it("returns 403 when not in dev mode", async () => {
    devMode = false

    const response = await fetch(`http://localhost:${port}/api/state/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data).toEqual({ ok: false, error: "State export is only available in dev mode" })
  })

  it("writes state to the correct file path", async () => {
    registry.create({
      id: "test-1",
      name: "Test 1",
      agentName: "Agent-1",
      worktreePath: null,
      workspaceId: null,
      branch: null,
    })

    const response = await fetch(`http://localhost:${port}/api/state/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })

    expect(response.status).toBe(200)
    expect(mockMkdir).toHaveBeenCalledWith(
      path.join(workspacePath, ".ralph"),
      { recursive: true },
    )
    expect(mockWriteFile).toHaveBeenCalledWith(
      path.join(workspacePath, ".ralph", "state.latest.json"),
      expect.any(String),
      "utf-8",
    )
  })

  it("writes serialized instance state as JSON", async () => {
    registry.create({
      id: "inst-1",
      name: "Instance One",
      agentName: "Agent-1",
      worktreePath: "/path/to/worktree",
      workspaceId: "ws-1",
      branch: "main",
    })

    await fetch(`http://localhost:${port}/api/state/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })

    const writtenData = JSON.parse(mockWriteFile.mock.calls[0][1] as string) as {
      exportedAt: string
      instances: Array<{ id: string; name: string; agentName: string; status: string }>
    }
    expect(writtenData.exportedAt).toBeDefined()
    expect(writtenData.instances).toHaveLength(1)
    expect(writtenData.instances[0].id).toBe("inst-1")
    expect(writtenData.instances[0].name).toBe("Instance One")
    expect(writtenData.instances[0].agentName).toBe("Agent-1")
    expect(writtenData.instances[0].status).toBe("stopped")
  })

  it("exports multiple instances", async () => {
    registry.create({
      id: "inst-1",
      name: "Instance One",
      agentName: "Agent-1",
      worktreePath: null,
      workspaceId: null,
      branch: null,
    })
    registry.create({
      id: "inst-2",
      name: "Instance Two",
      agentName: "Agent-2",
      worktreePath: null,
      workspaceId: null,
      branch: null,
    })

    await fetch(`http://localhost:${port}/api/state/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })

    const writtenData = JSON.parse(mockWriteFile.mock.calls[0][1] as string) as {
      instances: Array<{ id: string }>
    }
    expect(writtenData.instances).toHaveLength(2)
    expect(writtenData.instances[0].id).toBe("inst-1")
    expect(writtenData.instances[1].id).toBe("inst-2")
  })

  it("exports empty instances when none exist", async () => {
    await fetch(`http://localhost:${port}/api/state/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })

    const writtenData = JSON.parse(mockWriteFile.mock.calls[0][1] as string) as {
      instances: Array<unknown>
    }
    expect(writtenData.instances).toEqual([])
  })

  it("returns correct response format on success", async () => {
    const beforeTime = Date.now()

    const response = await fetch(`http://localhost:${port}/api/state/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    const data = (await response.json()) as { ok: boolean; savedAt: number }

    const afterTime = Date.now()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.savedAt).toBeGreaterThanOrEqual(beforeTime)
    expect(data.savedAt).toBeLessThanOrEqual(afterTime)
  })

  it("returns 500 when mkdir fails", async () => {
    mockMkdir.mockRejectedValue(new Error("Permission denied"))

    const response = await fetch(`http://localhost:${port}/api/state/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toEqual({ ok: false, error: "Permission denied" })
  })

  it("returns 500 when writeFile fails", async () => {
    mockWriteFile.mockRejectedValue(new Error("Disk full"))

    const response = await fetch(`http://localhost:${port}/api/state/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toEqual({ ok: false, error: "Disk full" })
  })

  it("returns generic error message for non-Error exceptions", async () => {
    mockWriteFile.mockRejectedValue("something unexpected")

    const response = await fetch(`http://localhost:${port}/api/state/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toEqual({ ok: false, error: "Failed to export state" })
  })
})
